import tls from 'tls';
import B from 'bluebird';
import PlistServiceEncoder from './transformer/plist-service-encoder';
import PlistServiceDecoder from './transformer/plist-service-decoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';

const TLS_VERSION = 'TLSv1_method';

class PlistService {
  constructor (socketClient) {
    this._socketClient = socketClient;
    this._decoder = new PlistServiceDecoder();
    this._splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder.pipe(this._socketClient);

  }

  async sendPlistAndReceive (json, timeout = 5000) {
    this.sendPlist(json);
    return await this.receivePlist(timeout);
  }

  sendPlist (json) {
    this._encoder.write(json);
  }

  async receivePlist (timeout = 5000) {
    this._splitter.resume();
    return await new B((resolve, reject) => {
      setTimeout(function () { reject(`Failed to receive any data within the timeout: ${timeout}`); }, timeout);
      this._decoder.once('data', (data) => resolve(data));
    });
  }

  enableSessionSSL (hostPrivateKey, hostCertificate) {
    this._socketClient.unpipe(this._splitter);
    this._splitter.unpipe(this._decoder);
    this._encoder.unpipe(this._socketClient);
    this._socketClient = new tls.TLSSocket(this._socketClient, {
      secureContext: tls.createSecureContext({
        key: hostPrivateKey,
        cert: hostCertificate,
        rejectUnauthorized: false,
        secureProtocol: TLS_VERSION
      })
    });
    this._encoder.pipe(this._socketClient);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);
  }

  close () {
    this._socketClient.destroy();
  }
}

export { PlistService };
export default PlistService;