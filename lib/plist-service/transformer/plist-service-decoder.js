/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 4;

class PlistServiceDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    this._decode(data);
    callback();
  }

  _decode (data) {
    let payload = data.slice(HEADER_LENGTH, data.length);
    this.push(plist.parsePlist(payload));
  }
}

export { PlistServiceDecoder };
export default PlistServiceDecoder;