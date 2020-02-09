import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { KB } from '../constants';
import AfcService from '../afc';
import B from 'bluebird';
import { BaseServiceSocket } from '../base-service';


const HOUSE_ARREST_SERVICE_NAME = 'com.apple.mobile.house_arrest';
const MAX_FRAME_SIZE = 1 * KB;

class HouseArrestService extends BaseServiceSocket {
  constructor (socketClient) {
    super(socketClient);

    this._decoder = new PlistServiceDecoder();
    this._splitter = new LengthBasedSplitter({
      readableStream: socketClient,
      littleEndian: false,
      maxFrameLength: MAX_FRAME_SIZE,
      lengthFieldOffset: 0,
      lengthFieldLength: 4,
      lengthAdjustment: 4,
    });
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder.pipe(this._socketClient);
    this._assignClientFailureHandlers(this._encoder);
  }

  /**
   * Vends into the application container and returns an AfcService
   * @param {string} bundleId The bundle id of the app container that we will enter to
   * @throws Will throw an error if house arrest fails to access the application's container
   * @returns {AfcService}
   */
  async vendContainer (bundleId) {
    const responsePromise = this._receivePlistPromise();
    this._encoder.write({
      Command: 'VendContainer',
      Identifier: bundleId,
    });
    const response = await responsePromise;
    if (response.Status !== 'Complete') {
      throw new Error(`Failed to vend into the application container. Error: ${response.Error}`);
    }
    this._socketClient.unpipe(this._splitter);
    this._splitter.unpipe(this._decoder);
    return new AfcService(this._socketClient);
  }

  /**
   * Vends into the application documents and returns an AfcService
   * @param {string} bundleId The bundle id of the app documents that we will enter to
   * @throws Will throw an error if house arrest fails to access the application's documents
   * @returns {AfcService}
   */
  async vendDocuments (bundleId) {
    const responsePromise = this._receivePlistPromise();
    this._encoder.write({
      Command: 'VendDocuments',
      Identifier: bundleId,
    });
    const response = await responsePromise;
    if (response.Status !== 'Complete') {
      throw new Error(`Failed to vend into the application documents. Error: ${response.Error}`);
    }
    this._socketClient.unpipe(this._splitter);
    this._splitter.unpipe(this._decoder);
    return new AfcService(this._socketClient);
  }

  _receivePlistPromise (timeout = 10000) {
    return new B((resolve, reject) => {
      this._decoder.once('data', resolve);
      setTimeout(() => reject(new Error(`Failed to receive any data within the timeout: ${timeout}`)), timeout);
    });
  }
}

export { HouseArrestService, HOUSE_ARREST_SERVICE_NAME };
export default HouseArrestService;
