// Adapted from https://github.com/YueChen-C/py-ios-device

import { BaseServiceSocket } from '../base-service';
import { DTXMessage, DTXMessageAuxBuffer, FLAG_TYPES } from './headers';
import { DTXEncoder } from './transformer/dtx-encode';
import { DTXDecoder } from './transformer/dtx-decode';
import events from 'events';
import _ from 'lodash';
import { waitForCondition } from 'asyncbox';

const CHECK_FREQ_MS = 500;
const WAIT_REPLY_TIME_MS = 10000;
const CHANNEL_CANCELED = '_channelCanceled';
const CHANNEL_OFFSET = 2 ** 32;

const INSTRUMENT_SERVICE_NAME_VERSION_14 = 'com.apple.instruments.remoteserver.DVTSecureSocketProxy';
const INSTRUMENT_SERVICE_NAME = 'com.apple.instruments.remoteserver';

export const INSTRUMENT_CHANNEL = Object.freeze({
  DEVICE_INFO: 'com.apple.instruments.server.services.deviceinfo',
  PROCESS_CONTROL: 'com.apple.instruments.server.services.processcontrol',
  SYSMONTAP: 'com.apple.instruments.server.services.sysmontap',
  NETWORKING: 'com.apple.instruments.server.services.networking',
  MOBILE_NOTIFICATIONS: 'com.apple.instruments.server.services.mobilenotifications',
  GRAPHICS_OPENGL: 'com.apple.instruments.server.services.graphics.opengl',
  APPLICATION_LISTING: 'com.apple.instruments.server.services.device.applictionListing',
  CONDITION_INDUCER: 'com.apple.instruments.server.services.ConditionInducer'
});

function defaultDict(createValue) {
  return Proxy.revocable(Object.create(null), {
    get(storage, property) {
      if (!(property in storage)) {
        storage[property] = createValue(property);
      }
      return storage[property];
    }
  });
}

/** The callback function which will be called during the data transmission in instrument serve
 * @callback DTXCallback
 * @param {DTXMessage} object
*/

class InstrumentService extends BaseServiceSocket {
  /**
   * @param {import('net').Socket} socketClient  DTXMessage.selector
   * @param {DTXCallback?} event if empty will ignore any messages
   */
  constructor(socketClient, event = null) {
    super(socketClient);
    this._undefinedCallback = event;
    this._callbacks = new events.EventEmitter();
    this._channelCallbacks = new events.EventEmitter();
    const { proxy, revoke } = defaultDict(() => []);
    this._replyQueues = proxy;
    this._replyQueuesRevoker = revoke;
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
  registerSelectorCallback(selector, event) {
    this._callbacks.addListener(selector, event);
  }

  /**
   * If the event is registered, all unregistered messages will be returned to event. refer to this._handleData
   * @param {DTXCallback} event
   */
  registerUndefinedCallback(event) {
    this._undefinedCallback = event;
  }

  /**
   * If the event is registered, this channel {CHANNEL} messages will be returned to event. refer to this._handleData
   * It's actually listening for int channelCode. In this._channel object to record channel key and int value
   * @param {string} channel instruments service channel e.g: INSTRUMENT_CHANNEL.DEVICE_INFO.
   * @param {DTXCallback} event
   */
  async registerChannelCallback(channel, event) {
    const channelId = await this.makeChannel(channel);
    this._channelCallbacks.addListener(channelId, event);
  }

  /**
   * Event will be registered to socket client lifecycle
   * @param {string} eventName
   * @param {(message: any | null) => void} event
   */
  registerLifecycleCallback(eventName, event) {
    this._socketClient.on(eventName, event);
  }

  /**
   * Create a service channel, data transmission of the service will use this channelCode
   * @param {string} channel  instruments service channel e.g: INSTRUMENT_CHANNEL.DEVICE_INFO
   * @returns {Promise<number|*>} instruments service channel code for data transmission
   */
  async makeChannel(channel) {
    if (channel in this._channels) {
      return this._channels[channel];
    }
    const channelCode = Object.keys(this._channels).length + 1;
    await this._callChannel(true, 0, '_requestChannelWithCode:identifier:', channelCode, channel);
    this._channels[channel] = channelCode;
    return channelCode;
  }

  /**
   * In general, we call this method to start the instrument dtx service
   * @param {string} channel instrument dtx service e.g: INSTRUMENT_CHANNEL.DEVICE_INFO
   * @param {string} selector instrument service method name (reflection calls)
   * @param {...any | DTXMessageAuxBuffer} auxiliaries parameters required by selector. If auxiliaries are passed in using
   * the DTXMessageAuxBuffer type, all the variables should be manually assembled into only one DTXMessageAuxBuffer instance.
   * @returns {Promise<DTXMessage>}
   * example：
   * instrumentService.callChannel(INSTRUMENT_CHANNEL.PROCESS_CONTROL,
        'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:', '',
        bundleID, {}, [], {'StartSuspendedKey': 0, 'KillExisting': 1}
   */
  async callChannel(channel, selector, ...auxiliaries) {
    const channelCode = await this.makeChannel(channel);
    return await this._callChannel(true, channelCode, selector, ...auxiliaries);
  }

  async _callChannel(sync, channelCode, selector, ...auxiliaries) {
    const identifier = this._nextIdentifier;
    this._encoder.write({
      sync,
      channelCode,
      selector,
      auxiliaries: (auxiliaries.length === 1 && auxiliaries[0] instanceof DTXMessageAuxBuffer) ? auxiliaries[0] : auxiliaries,
      identifier
    });
    ++this._nextIdentifier;
    if (sync) {
      try {
        return await waitForCondition(() => {
          const queue = this._replyQueues[identifier];
          const data = queue.shift();
          if (!_.isUndefined(data)) {
            return data;
          }
        }, { waitMs: WAIT_REPLY_TIME_MS, intervalMs: CHECK_FREQ_MS, error: 'reply channel data timeout' });
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
  _handleData(data) {
    if (_.includes(data.selector, CHANNEL_CANCELED)) {
      this.close();
    }
    if (data.conversationIndex === 1) {
      this._replyQueues[data.identifier].push(data);
    } else if (this._channelCallbacks.listenerCount(`${CHANNEL_OFFSET - data.channelCode}`) > 0) {
      this._channelCallbacks.emit(`${CHANNEL_OFFSET - data.channelCode}`, data);
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
  _replyAck(data) {
    const reply = new DTXMessage({
      identifier: data.identifier,
      channelCode: data.channelCode,
      conversationIndex: data.conversationIndex + 1,
      flags: FLAG_TYPES.reply
    });
    this._socketClient.write(reply.build());
  }

  dispose() {
    this._encoder.unpipe();
    this._decoder.removeAllListeners();
    this._callbacks.removeAllListeners();
    this._channelCallbacks.removeAllListeners();
    this._socketClient.removeAllListeners();
    this._socketClient.unpipe();
    this._replyQueuesRevoker();
  }
}

export { InstrumentService, INSTRUMENT_SERVICE_NAME_VERSION_14, INSTRUMENT_SERVICE_NAME };
