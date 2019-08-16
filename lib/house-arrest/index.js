import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { KB } from '../constants';
import AfcService from '../afc';
import B from 'bluebird';

const HOUSE_ARREST_SERVICE_NAME = 'com.apple.mobile.house_arrest';

class HouseArrestService {
  constructor (socketClient) {
    this._socketClient = socketClient;
    this._decoder = new PlistServiceDecoder();
    this._splitter = new LengthBasedSplitter(false, KB, 0, 4, 4);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder.pipe(this._socketClient);
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

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    this._socketClient.destroy();
  }
}

export { HouseArrestService, HOUSE_ARREST_SERVICE_NAME };
export default HouseArrestService;

