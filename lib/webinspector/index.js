import WebInspectorDecoder from './transformer/webinspector-decoder';
import WebInspectorEncoder from './transformer/webinspector-encoder';
import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import StreamLogger from '../util/transformer/stream-logger';
import _ from 'lodash';
import { util } from '@appium/support';
import { MB } from '../constants';
import log from '../logger';
import { BaseServiceSocket } from '../base-service';


const WEB_INSPECTOR_SERVICE_NAME = 'com.apple.webinspector';
const MAX_FRAME_SIZE = 20 * MB;

const PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION = 11;

function cleanupRpcObject (obj) {
  const isArray = _.isArray(obj);
  if (!_.isPlainObject(obj) && !isArray) {
    return obj;
  }

  if (isArray) {
    return _.filter(obj, _.negate(_.isNil));
  }

  return _.reduce(obj, (result, value, key) => {
    if (!_.isNil(value)) {
      result[key] = cleanupRpcObject(value);
    }
    return result;
  }, {});
}

/**
 * @typedef {Object} WebInspectorServiceOptions
 *
 * @property {number} majorOsVersion The major version of the os version
 * @property {boolean} isSimulator Whether the device is a simulator
 * @property {number?} socketChunkSize Size, in bytes of the chunks to send to
 *                                     real device (only iOS 11+). Defaults to
 *                                     16384 bytes (the TLSSocket max).
 * @property {boolean} verbose Turn on logging of each message sent or received.
 *                             Defaults to false
 * @property {boolean} verboseHexDump Turn on logging of _all_ communication as
 *                                    hex dump. Defaults to false
 * @property {*} socketClient The socket client where the communication will happen
 * @property {number} maxFrameLength [20 * 1024 * 1024] - The maximum size
 *                                   in bytes of a single data frame
 *                                   in the device communication protocol
 */

class WebInspectorService extends BaseServiceSocket {
  /** @type {number|undefined} */
  _majorOsVersion;

  /**
   * The main service for communication with the webinspectord
   *
   * @param {Partial<WebInspectorServiceOptions>} opts
   */
  constructor (opts = {}) {
    const {
      majorOsVersion,
      isSimulator = false,
      socketChunkSize,
      verbose = false,
      verboseHexDump = false,
      socketClient,
      maxFrameLength = MAX_FRAME_SIZE,
    } = opts;

    super(socketClient);

    // set the largest fragment size for the socket, if the option is there
    if (_.isFunction(socketClient.setMaxSendFragment) && !_.isNil(socketChunkSize) && socketChunkSize > 0) {
      if (socketClient.setMaxSendFragment(socketChunkSize)) {
        log.debug(`Maximum TLS fragment size set to '${socketChunkSize}'`);
      } else {
        // anything over the _actual_ maximum will fail, and things will remain the same
        log.warn(`Unable to set TLS fragment size to '${socketChunkSize}'`);
      }
    }

    this._verbose = verbose;
    this._isSimulator = isSimulator;
    this._majorOsVersion = majorOsVersion;

    if (!isSimulator && !_.isNil(majorOsVersion) && majorOsVersion < PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION) {
      this._initializePartialMessageSupport(verboseHexDump, maxFrameLength);
    } else {
      this._initializeFullMessageSupport(verboseHexDump, maxFrameLength);
    }
  }

  /**
   * Intializes the data flow for iOS 11+.
   *
   * @param {boolean} verbose - whether to print out the hex dump for communication
   * @param {number} maxFrameLength - The maximum size in bytes of a single data frame
   *                                  in the device communication protocol
   */
  _initializeFullMessageSupport (verbose, maxFrameLength) {
    this._decoder = new PlistServiceDecoder();
    this._socketClient
      // log first, in case there is a problem in processing
      .pipe(new StreamLogger(StreamLogger.RECEIVE, verbose))
      .pipe(this._splitter = new LengthBasedSplitter({
        readableStream: this._socketClient,
        littleEndian: false,
        maxFrameLength,
        lengthFieldOffset: 0,
        lengthFieldLength: 4,
        lengthAdjustment: 4,
      }))
      .pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder
      .pipe(new StreamLogger(StreamLogger.SEND, verbose))
      .pipe(this._socketClient);
  }

  /**
   * Intializes the data flow for iOS < 11, where data is separated into partial
   * messages before sending.
   *
   * @param {boolean} verbose - whether to print out the hex dump for communication
   * @param {number} maxFrameLength - The maximum size in bytes of a single data frame
   *                                  in the device communication protocol
   */
  _initializePartialMessageSupport (verbose, maxFrameLength) {
    // 1MB as buffer for bulding webinspector full messages. We can increase the value if more buffer is needed
    this._decoder = new WebInspectorDecoder(MB);
    this._socketClient
      // log first, in case there is a problem in processing
      .pipe(new StreamLogger(StreamLogger.RECEIVE, verbose))
      .pipe(this._splitter = new LengthBasedSplitter({
        readableStream: this._socketClient,
        littleEndian: false,
        maxFrameLength,
        lengthFieldOffset: 0,
        lengthFieldLength: 4,
        lengthAdjustment: 4,
      }))
      .pipe(new PlistServiceDecoder())
      .pipe(this._decoder);

    this._encoder = new WebInspectorEncoder();
    this._encoder
      .pipe(new PlistServiceEncoder())
      .pipe(new StreamLogger(StreamLogger.SEND, verbose))
      .pipe(this._socketClient);
  }

  /**
   * Sends an object to the webinspectord socket
   * @param {Object} rpcObject The object that will be sent
   * @throws Will throw an error when the object is null or undefined
   */
  sendMessage (rpcObject) {
    if (_.isNil(rpcObject)) {
      throw new Error('Cannot send a null object');
    }

    let message = rpcObject;
    let lastError;
    try {
      try {
        // @ts-ignore _encoder must be present
        this._encoder.write(message);
      } catch (e) {
        // Workaround for https://github.com/joeferner/node-bplist-creator/issues/29
        if (e instanceof TypeError) {
          message = cleanupRpcObject(message);
          // @ts-ignore _encoder must be present
          this._encoder.write(message);
        } else {
          throw e;
        }
      }
    } catch (err) {
      lastError = err;
    }

    if (this._verbose || lastError) {
      log.debug('Sent message to Web Inspector:');
      log.debug(util.jsonStringify(message, null));
      if (!_.isEqual(message, rpcObject)) {
        log.debug('Original message:');
        log.debug(util.jsonStringify(rpcObject, null));
      }
    }

    if (lastError) {
      throw lastError;
    }

    // write an empty message, which on real devices ensures the actual message
    // gets sent to the device. without this it will periodically hang with
    // nothing sent
    // however, this causes webinspectord to crash on devices running iOS 10
    // @ts-ignore _majorOsVersion could be present
    if (!this._isSimulator && this._majorOsVersion >= PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION) {
      // @ts-ignore _encoder must be present
      this._encoder.write(' ');
    }
  }

  /** The callback function which will be called during message listening
   * @callback MessageCallback
   * @param {Object} object The rpc object that is sent from the webinspectord
   */

  /**
   * Listen to messages coming from webinspectord
   * @param {MessageCallback} onData
   */
  listenMessage (onData) {
    // @ts-ignore _decoder must be present
    this._decoder.on('data', (data) => {
      if (this._verbose) {
        log.debug('Received message from Web Inspector:');
        log.debug(util.jsonStringify(data, null));
      }
      onData(data);
    });
  }
}

export { WebInspectorService, WEB_INSPECTOR_SERVICE_NAME, cleanupRpcObject };
export default WebInspectorService;
