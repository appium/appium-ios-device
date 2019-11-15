/* eslint-disable promise/prefer-await-to-callbacks */
import WebInspectorDecoder from './transformer/webinspector-decoder';
import WebInspectorEncoder from './transformer/webinspector-encoder';
import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import StreamLogger from '../util/transformer/stream-logger';
import _ from 'lodash';
import { util } from 'appium-support';
import { MB } from '../constants';
import log from '../logger';
import { BaseServiceSocket } from '../base-service';


const WEB_INSPECTOR_SERVICE_NAME = 'com.apple.webinspector';

const PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION = 11;

const MAX_FRAME_SIZE = 20000000;

/**
 * @typedef {Object} WebInspectorServiceOptions
 *
 * @property {number} majorOsVersion The major version of the os version
 * @property {boolean} isSimulator Whether the device is a simulator
 * @property {?number} socketChunkSize Size, in bytes of the chunks to send to
 *                                     real device (only iOS 11+). Defaults to
 *                                     16384 bytes (the TLSSocket max).
 * @property {boolean} verbose Turn on logging of each message sent or received.
 *                             Defaults to false
 * @property {boolean} verboseHexDump Turn on logging of _all_ communication as
 *                                    hex dump. Defaults to false
 * @property {*} socketClient The socket client where the communication will happen
 */

class WebInspectorService extends BaseServiceSocket {
  /**
   * The main service for communication with the webinspectord
   *
   * @param {WebInspectorServiceOptions}
   */
  constructor (opts = {}) {
    const {
      majorOsVersion,
      isSimulator = false,
      socketChunkSize,
      verbose = false,
      verboseHexDump = false,
      socketClient,
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

    if (!isSimulator && majorOsVersion < PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION) {
      this._initializePartialMessageSupport(verboseHexDump);
    } else {
      this._initializeFullMessageSupport(verboseHexDump);
    }
  }

  /**
   * Intializes the data flow for iOS 11+.
   *
   * @param {boolean} verbose - whether to print out the hex dump for communication
   */
  _initializeFullMessageSupport (verbose) {
    this._decoder = new PlistServiceDecoder();
    this._socketClient
      // log first, in case there is a problem in processing
      .pipe(new StreamLogger(StreamLogger.RECEIVE, verbose))
      .pipe(new LengthBasedSplitter(false, MAX_FRAME_SIZE, 0, 4, 4))
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
   */
  _initializePartialMessageSupport (verbose) {
    // 1MB as buffer for bulding webinspector full messages. We can increase the value if more buffer is needed
    this._decoder = new WebInspectorDecoder(MB);
    this._socketClient
      // log first, in case there is a problem in processing
      .pipe(new StreamLogger(StreamLogger.RECEIVE, verbose))
      .pipe(new LengthBasedSplitter(false, MAX_FRAME_SIZE, 0, 4, 4))
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

    if (this._verbose) {
      log.debug('Sending message to Web Inspector:');
      log.debug(util.jsonStringify(rpcObject));
    }

    this._encoder.write(rpcObject);

    // write an empty message, which on real devices ensures the actual message
    // gets sent to the device. without this it will periodically hang with
    // nothing sent
    if (!this._isSimulator) {
      this._encoder.write(' ');
    }
  }

  /** The callback function which will be called during message listening
   * @name MessageCallback
   * @function
   * @param {Object} object The rpc object that is sent from the webinspectord
  */

  /**
   * Listen to messages coming from webinspectord
   * @param {MessageCallback} callback
   */
  listenMessage (onData) {
    this._decoder.on('data', (data) => {
      if (this._verbose) {
        log.debug('Received message from Web Inspector:');
        log.debug(util.jsonStringify(data));
      }
      onData(data);
    });
  }
}

export { WebInspectorService, WEB_INSPECTOR_SERVICE_NAME };
export default WebInspectorService;
