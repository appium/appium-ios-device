/* eslint-disable promise/prefer-await-to-callbacks */
import WebInspectorDecoder from './transformer/webinspector-decoder';
import WebInspectorEncoder from './transformer/webinspector-encoder';
import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';

const WEB_INSPECTOR_SERVICE_NAME = 'com.apple.webinspector';

const PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION = 11;

class WebInspectorService {

  constructor (version, socketClient) {
    this._socketClient = socketClient;

    if (version.major < PARTIAL_MESSAGE_SUPPORT_DEPRECATION_VERSION) {
      // 1MB as buffer for bulding webinspector full messages. We can increase the value if more buffer is needed
      this._decoder = new WebInspectorDecoder(1024 * 1024);
      this._plistDecoder = new PlistServiceDecoder();
      this._splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
      this._socketClient.pipe(this._splitter).pipe(this._plistDecoder).pipe(this._decoder);

      this._encoder = new WebInspectorEncoder();
      this._plistEncoder = new PlistServiceEncoder();
      this._encoder.pipe(this._plistEncoder).pipe(this._socketClient);
    } else {
      this._decoder = new PlistServiceDecoder();
      this._splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
      this._socketClient.pipe(this._splitter).pipe(this._decoder);

      this._encoder = new PlistServiceEncoder();
      this._encoder.pipe(this._socketClient);
    }
  }

  sendMessage (rpcObject) {
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