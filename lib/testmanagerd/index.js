
import {BaseServiceSocket} from '../base-service';
import {DTXMessage, FLAG_TYPES} from '../instrument/headers';
import {DTXEncoder} from '../instrument/transformer/dtx-encode';
import {DTXDecoder} from '../instrument/transformer/dtx-decode';
import {defaultDict} from '../instrument';
import events from 'events';
import _ from 'lodash';
import {waitForCondition} from 'asyncbox';

const CHECK_FREQ_MS = 500;
const WAIT_REPLY_TIME_MS = 10000;
const EMPTY_MESSAGE_SIZE = 16;
const CHANNEL_CANCELED = '_channelCanceled';
const CHANNEL_OFFSET = 2 ** 32;

const TESTMANAGERD_SERVICE_NAME_VERSION_14 = 'com.apple.testmanagerd.lockdown.secure';
const TESTMANAGERD_SERVICE_NAME = 'com.apple.testmanagerd.lockdown';

const TESTMANAGERD_CHANNEL = Object.freeze({
  DAEMON_CONNECTION_INTERFACE: 'dtxproxy:XCTestManager_IDEInterface:XCTestManager_DaemonConnectionInterface',
});

class TestmanagerdService extends BaseServiceSocket {
  constructor (socketClient, event) {
    super(socketClient);
    this._undefinedCallback = event;
    this._callbacks = new events.EventEmitter();
    this._channelCallbacks = new events.EventEmitter();
    this._replyQueues = defaultDict(() => []);
    this._channels = {};
    this._nextIdentifier = 1;
    this._encoder = new DTXEncoder();
    this._encoder.pipe(this._socketClient);
    this._assignClientFailureHandlers(this._encoder);
    this._decoder = new DTXDecoder();
    this._socketClient.pipe(this._decoder);
    this._decoder.on('data', this._handleData.bind(this));
  }

  /**
   * If the selector is registered, The message of the selector event will be returned. refer to this._handleData
   * @param {string} selector  Listen for return DTXMessage.selector data
   * @param {DTXCallback} event
   */
  registerSelectorCallback (selector, event) {
    this._callbacks.addListener(selector, event);
  }

  /**
   * If the event is registered, all unregistered messages will be returned to event. refer to this._handleData
   * @param {DTXCallback} event
   */
  registerUndefinedCallback (event) {
    this._undefinedCallback = event;
  }

  /**
   * If the event is registered, this channel {CHANNEL} messages will be returned to event. refer to this._handleData
   * It's actually listening for int channelCode. In this._channel object to record channel key and int value
   * @param {string} channel testmanagerd service channel e.g: TESTMANAGERD_CHANNEL.DAEMON_CONNECTION_INTERFACE.
   * @param {DTXCallback} event
   */
  async registerChannelCallback (channel, event) {
    const channelId = await this.makeChannel(channel);
    this._channelCallbacks.addListener(channelId, event);
  }

  /**
   * Create a service channel, data transmission of the service will use this channelCode
   * @param {string} channel  testmanagerd service channel e.g: TESTMANAGERD_CHANNEL.DAEMON_CONNECTION_INTERFACE
   * @returns {Promise<number|*>} testmanagerd service channel code for data transmission
   */
  async makeChannel (channel) {
    if (channel in this._channels) {
      return this._channels[channel];
    }
    const channelCode = Object.keys(this._channels).length + 1;
    await this._callChannel(true, 0, '_requestChannelWithCode:identifier:', channelCode, channel);
    this._channels[channel] = channelCode;
    return channelCode;
  }

  /**
   * In general, we call this method to start the testmanagerd dtx service
   * @param {string} channel testmanagerd dtx service e.g: TESTMANAGERD_CHANNEL.DAEMON_CONNECTION_INTERFACETESTMANAGERD_CHANNEL.DAEMON_CONNECTION_INTERFACE
   * @param {string} selector testmanagerd service method name (reflection calls)
   * @param {...any} auxiliaries parameters required by selector
   * @returns {Promise<DTXMessage>}
   * example：
   * TestmanagerdService.callChannel(TESTMANAGERD_CHANNEL.DAEMON_CONNECTION_INTERFACE,
        'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:', '',
        bundleID, {}, [], {'StartSuspendedKey': 0, 'KillExisting': 1}
   */
  async callChannel (channel, selector, ...auxiliaries) {
    const channelCode = await this.makeChannel(channel);
    return await this._callChannel(true, channelCode, selector, ...auxiliaries);
  }

  async _callChannel (sync, channelCode, selector, ...auxiliaries) {
    const identifier = this._nextIdentifier;
    this._encoder.write({sync, channelCode, selector, auxiliaries, identifier});
    ++this._nextIdentifier;
    if (sync) {
      try {
        return await waitForCondition(() => {
          const queue = this._replyQueues[identifier];
          const data = queue.shift();
          if (!_.isUndefined(data)) {
            return data;
          }
        }, {waitMs: WAIT_REPLY_TIME_MS, intervalMs: CHECK_FREQ_MS, error: 'reply channel data timeout'});
      } catch (err) {
        this.close();
        throw new Error(err);
      }
    }
  }

  /**
   * Handling registered asynchronous message callbacks
   * @param {DTXMessage} data
   * @private
   */
  _handleData (data) {
    if (_.includes(data.selector, CHANNEL_CANCELED)) {
      this.close();
    }
    if (data.conversationIndex === 1) {
      this._replyQueues[data.identifier].push(data);
    } else if (this._channelCallbacks.listenerCount(CHANNEL_OFFSET - data.channelCode) > 0) {
      this._channelCallbacks.emit(CHANNEL_OFFSET - data.channelCode, data);
    } else {
      const selector = data.selector;
      if (_.isString(selector) && this._callbacks.listenerCount(selector) > 0) {
        this._callbacks.emit(selector, data);
      } else if (this._undefinedCallback) {
        this._undefinedCallback(data);
      }
      if (data.expectsReply) {
        this._replyAck(data);
      }
    }
  }

  /**
   * return a empty ack message
   * @param {DTXMessage} data
   */
  _replyAck (data) {
    const reply = new DTXMessage({
      identifier: data.identifier,
      channelCode: data.channelCode,
      selector: Buffer.alloc(EMPTY_MESSAGE_SIZE),
      conversationIndex: data.conversationIndex + 1,
      flags: FLAG_TYPES.reply
    });
    this._socketClient.write(reply.build());
  }
}

export { TestmanagerdService, TESTMANAGERD_SERVICE_NAME_VERSION_14, TESTMANAGERD_SERVICE_NAME, TESTMANAGERD_CHANNEL };
