/* eslint-disable promise/prefer-await-to-callbacks */
import { parse } from '../../util/plist';
import Stream from 'stream';

const HEADER_LENGTH = 16;

class UsbmuxDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    this._decode(data);
    callback();
  }

  _decode (data) {
    const header = {
      length: data.readUInt32LE(0),
      version: data.readUInt32LE(4),
      type: data.readUInt32LE(8),
      tag: data.readUInt32LE(12)
    };

    let payload = data.slice(HEADER_LENGTH, data.length);
    this.push({ header, payload: parse(payload) });
  }

}

export { UsbmuxDecoder };
export default UsbmuxDecoder;
