import B from 'bluebird';
import { upgradeToSSL } from '../ssl-helper';
import PlistServiceEncoder from './transformer/plist-service-encoder';
import PlistServiceDecoder from './transformer/plist-service-decoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { BaseServiceSocket } from '../base-service';
import { MB } from '../constants';


const MAX_FRAME_SIZE = 1 * MB;

const CHECK_FREQ_MS = 50;

class PlistService extends BaseServiceSocket {
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
    this._encoder.unpipe(this._socketClient);
    this._socketClient = upgradeToSSL(this._socketClient, hostPrivateKey, hostCertificate);
    this._encoder.pipe(this._socketClient);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);
  }
}

export { PlistService };
export default PlistService;
