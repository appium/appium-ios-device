/* eslint-disable promise/prefer-await-to-callbacks */
import WebInspectorDecoder from './transformer/webinspector-decoder';
import WebInspectorEncoder from './transformer/webinspector-encoder';
import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';

const WEB_INSPECTOR_SERVICE_NAME = 'com.apple.webinspector';

const PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION = 11;

class WebInspectorService {

  /**
   * The main service for communication with the webinspectord
   * @param {number} majorOsVersion The major version of the os version
   * @param {*} socketClient The socket client where the communication will happen
   */
  constructor (majorOsVersion, socketClient) {
    this._socketClient = socketClient;

    if (majorOsVersion < PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION) {
      // 1MB as buffer for bulding webinspector full messages. We can increase the value if more buffer is needed
      this._decoder = new WebInspectorDecoder(1024 * 1024);
      const plistDecoder = new PlistServiceDecoder();
      const splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
      this._socketClient.pipe(splitter).pipe(plistDecoder).pipe(this._decoder);

      this._encoder = new WebInspectorEncoder();
      const plistEncoder = new PlistServiceEncoder();
      this._encoder.pipe(plistEncoder).pipe(this._socketClient);
    } else {
      this._decoder = new PlistServiceDecoder();
      const splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
      this._socketClient.pipe(splitter).pipe(this._decoder);

      this._encoder = new PlistServiceEncoder();
      this._encoder.pipe(this._socketClient);
    }
  }

  sendMessage (rpcObject) {
    if (!rpcObject) {
      throw new Error('Cant send a null object');
    }
    this._encoder.write(rpcObject);
  }

  listenMessage (callback) {
    this._decoder.on('data', callback);
  }

  close () {
    this._socketClient.destroy();
  }

}

export { WebInspectorService, WEB_INSPECTOR_SERVICE_NAME };
export default WebInspectorService;