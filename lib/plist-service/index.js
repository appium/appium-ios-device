import B from 'bluebird';
import { upgradeToSSL } from '../ssl-helper';
import PlistServiceEncoder from './transformer/plist-service-encoder';
import PlistServiceDecoder from './transformer/plist-service-decoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';

const CHECK_FREQ_MS = 50;

class PlistService {
  constructor (socketClient) {
    this._socketClient = socketClient;
    this._decoder = new PlistServiceDecoder();
    this._splitter = new LengthBasedSplitter(false, 1000000, 0, 4, 4);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder.pipe(this._socketClient);

    this.replyQueue = [];
    this._decoder.on('data', (data) => this.replyQueue.push(data));
  }

  async sendPlistAndReceive (json, timeout = 5000) {
    this.sendPlist(json);
    return await this.receivePlist(timeout);
  }

  sendPlist (json) {
    if (!json) {
      throw new Error('Cant send a null a object');
    }
    this._encoder.write(json);
  }

  async receivePlist (timeout = 5000) {
    return await new B((resolve, reject) => {
      const queue = this.replyQueue;
      const data = queue.shift();
      if (data) {
        resolve(data);
        return;
      }
      const checkExist = setInterval(() => {
        const data = queue.shift();
        if (!data) {
          return;
        }
        clearInterval(checkExist);
        resolve(data);
      }, CHECK_FREQ_MS);
      setTimeout(() => {
        clearInterval(checkExist);
        reject(new Error(`Failed to receive any data within the timeout: ${timeout}`));
      }, timeout);
    });
  }

  enableSessionSSL (hostPrivateKey, hostCertificate) {
    this._socketClient.unpipe(this._splitter);
    this._splitter.unpipe(this._decoder);
    this._encoder.unpipe(this._socketClient);
    this._socketClient = upgradeToSSL(this._socketClient, hostPrivateKey, hostCertificate);
    this._encoder.pipe(this._socketClient);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);
  }

  close () {
    this._socketClient.destroy();
  }
}

export { PlistService };
export default PlistService;