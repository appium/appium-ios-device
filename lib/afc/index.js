/* eslint-disable promise/prefer-await-to-callbacks */
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { Operations, operationCode, Errors, errorCode } from './protocol';
import AfcEncoder from './transformer/afcencoder';
import AfcDecoder from './transformer/afcdecoder';
import B from 'bluebird';

const AFC_SERVICE_NAME = 'com.apple.afc';

const NULL_DELIMETER_CODE = 0x00;

class AfcService {

  constructor (socketClient) {
    this._socketClient = socketClient;
    this._splitter = new LengthBasedSplitter(true, 1000000, 8, 8, -8);
    this._decoder = new AfcDecoder();
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new AfcEncoder();
    this._encoder.pipe(this._socketClient);

    this._responseCallbacks = {};

    this._packetNumber = 0;
    this._decoder.on('data', this.handleData.bind(this));
  }

  handleData (data) {
    const cb = this._responseCallbacks[data.packetNumber];
    if (!cb) {
      return;
    }
    cb(data);
  }

  async createDirectory (path) {
    const packetNumber = this._packetNumber++;
    const response = this.createPacketPromise(packetNumber);

    const data = {
      opCode: Operations.MAKE_DIR,
      packetNumber,
      headerPayload: Buffer.from(path)
    };
    this._encoder.write(data);
    const res = await response;
    this.checkStatus(res);
  }

  async deleteDirectory (path) {
    const packetNumber = this._packetNumber++;
    const response = this.createPacketPromise(packetNumber);

    const data = {
      opCode: Operations.REMOVE_PATH_AND_CONTENTS,
      packetNumber,
      headerPayload: Buffer.from(path)
    };
    this._encoder.write(data);
    const res = await response;
    this.checkStatus(res);
  }

  async listDirectory (path) {
    const packetNumber = this._packetNumber++;
    const response = this.createPacketPromise(packetNumber);

    const data = {
      opCode: Operations.READ_DIR,
      packetNumber,
      headerPayload: Buffer.from(path)
    };
    this._encoder.write(data);
    const res = await response;
    if (res.opCode !== Operations.DATA) {
      this.checkStatus(res);
    }

    return this.split(res.content);
  }

  checkStatus (res) {
    if (res.opCode !== Operations.STATUS) {
      throw new Error(`Unexpected response ${operationCode(res.opCode)}`);
    }
    if (res.headerPayload[0] !== Errors.SUCCESS) {
      throw new Error(`Unexpected response ${errorCode(res.headerPayload[0])}`);
    }
  }

  split (buffer) {
    const items = [];
    let start = 0;
    for (let end = 0; end < buffer.length; end++) {
      if (buffer[end] === NULL_DELIMETER_CODE) {
        const item = buffer.toString('utf8', start, end);
        items.push(item);
        // We skip the null delimeter
        start = end + 1;
      }
    }
    return items;
  }

  createPacketPromise (packetNumber) {
    return new B((resolve) => this._responseCallbacks[packetNumber] = (data) => resolve(data));
  }

  close () {
    this._socketClient.destroy();
  }
}

export default AfcService;
export { AfcService, AFC_SERVICE_NAME };
