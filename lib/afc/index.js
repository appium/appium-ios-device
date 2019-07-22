/* eslint-disable promise/prefer-await-to-callbacks */
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { Operations, operationCode, Errors, errorCode, FileModes } from './protocol';
import { AfcWritableFileStream, AfcReadableFileStream } from './streams';
import AfcEncoder from './transformer/afcencoder';
import AfcDecoder from './transformer/afcdecoder';
import B from 'bluebird';
import _ from 'lodash';

const AFC_SERVICE_NAME = 'com.apple.afc';

const NULL_DELIMETER_CODE = 0x00;

const KB = 1024;
const MB = KB * KB;

class AfcService {

  constructor (socketClient) {
    this._socketClient = socketClient;
    this._splitter = new LengthBasedSplitter(true, MB, 8, 8, -8);
    this._decoder = new AfcDecoder();
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new AfcEncoder();
    this._encoder.pipe(this._socketClient);

    this._responseCallbacks = {};

    this._packetNumber = 0;
    this._decoder.on('data', this._handleData.bind(this));
  }

  _handleData (data) {
    const cb = this._responseCallbacks[data.packetNumber];
    if (!_.isFunction(cb)) {
      return;
    }
    cb(data);
  }

  async createDirectory (path) {
    const {packetNumber, response} = this.createPacketPromise();

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
    const {packetNumber, response} = this.createPacketPromise();

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
    const {packetNumber, response} = this.createPacketPromise();

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

    return this.parseArray(res.content);
  }

  async openFile (path, mode) {
    const {packetNumber, response} = this.createPacketPromise();

    const pathPayload = Buffer.from(path);
    const fileModePayload = Buffer.alloc(8);
    fileModePayload.writeUInt32LE(mode, 0);

    const data = {
      opCode: Operations.FILE_OPEN,
      packetNumber,
      headerPayload: Buffer.concat([fileModePayload, pathPayload])
    };
    this._encoder.write(data);
    const res = await response;
    if (res.opCode !== Operations.FILE_OPEN_RES) {
      this.checkStatus(res);
    }

    return res.headerPayload.readUInt32LE(0);
  }

  async createWriteStream (filePath, options) {
    const fileHandle = await this.openFile(filePath, FileModes.w);
    return new AfcWritableFileStream(fileHandle, this, options);
  }

  async createReadStream (filePath, options) {
    const fileHandle = await this.openFile(filePath, FileModes.r);
    return new AfcReadableFileStream(fileHandle, this, options);
  }

  async closeFileHandle (fileHande) {
    const {packetNumber, response} = this.createPacketPromise();

    const fileModePayload = Buffer.alloc(8);
    fileModePayload.writeUInt32LE(fileHande, 0);

    const data = {
      opCode: Operations.FILE_CLOSE,
      packetNumber,
      headerPayload: fileModePayload
    };
    this._encoder.write(data);
    const res = await response;
    this.checkStatus(res);
  }

  async writeFile (fileHande, buffer) {
    const {packetNumber, response} = this.createPacketPromise();

    const headerPayload = Buffer.alloc(8);
    headerPayload.writeUInt32LE(fileHande, 0);

    const data = {
      opCode: Operations.FILE_WRITE,
      packetNumber,
      headerPayload,
      content: buffer
    };
    this._encoder.write(data);
    const res = await response;
    this.checkStatus(res);
  }

  async readFile (fileHande, length) {
    const {packetNumber, response} = this.createPacketPromise();

    const headerPayload = Buffer.alloc(16);
    headerPayload.writeUInt32LE(fileHande, 0);
    headerPayload.writeUInt32LE(length, 8);

    const data = {
      opCode: Operations.FILE_READ,
      packetNumber,
      headerPayload
    };
    this._encoder.write(data);
    const res = await response;
    if (res.opCode !== Operations.DATA) {
      this.checkStatus(res);
    }
    return res.content;
  }

  async getFileInfo (path) {
    const {packetNumber, response} = this.createPacketPromise();

    const data = {
      opCode: Operations.GET_FILE_INFO,
      packetNumber,
      headerPayload: Buffer.from(path)
    };
    this._encoder.write(data);
    const res = await response;
    if (res.opCode !== Operations.DATA) {
      this.checkStatus(res);
    }
    return this.parseObject(res.content);
  }

  checkStatus (res) {
    if (res.opCode !== Operations.STATUS) {
      throw new Error(`Unexpected response ${operationCode(res.opCode)}`);
    }
    if (_.isEmpty(res.headerPayload)) {
      throw new Error('Header payload cant be empty for a status response');
    }
    if (res.headerPayload[0] !== Errors.SUCCESS) {
      throw new Error(`Unexpected response ${errorCode(res.headerPayload[0])}`);
    }
  }

  parseArray (buffer) {
    const items = [];
    let start = 0;
    for (let end = 0; end < buffer.length; end++) {
      if (buffer[end] !== NULL_DELIMETER_CODE) {
        continue;
      }
      const item = buffer.toString('utf8', start, end);
      items.push(item);
      // We skip the null delimeter
      start = end + 1;
    }
    return items;
  }

  parseObject (buffer) {
    const items = {};
    let start = 0;
    let currentKey;
    for (let end = 0; end < buffer.length; end++) {
      if (buffer[end] !== NULL_DELIMETER_CODE) {
        continue;
      }
      const item = buffer.toString('utf8', start, end);
      if (_.isNil(currentKey)) {
        currentKey = item;
      } else {
        items[currentKey] = item;
        currentKey = null;
      }
      // We skip the null delimeter
      start = end + 1;
    }
    if (currentKey) {
      throw new Error(`Failed to parse correctly ${buffer}. Please investigate`);
    }
    return items;
  }

  createPacketPromise (timeout = 10000) {
    const packetNumber = this._packetNumber++;
    const response = new B((resolve, reject) => {
      this._responseCallbacks[packetNumber] = (data) => resolve(data);
      setTimeout(() => reject(new Error(`Failed to receive any data within the timeout: ${timeout}`)), timeout);
    });
    return { packetNumber, response };
  }

  close () {
    this._socketClient.destroy();
  }
}

export default AfcService;
export { AfcService, AFC_SERVICE_NAME };
