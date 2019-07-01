/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 4;

class PlistServiceEncoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    callback(null, this._encode(data));
  }

  _encode (data) {
    let payloadBuffer = plist.createPlist(data, true);
    const headerBuffer = Buffer.alloc(HEADER_LENGTH);
    headerBuffer.writeUInt32BE(payloadBuffer.length, 0);
    return Buffer.concat([headerBuffer, payloadBuffer], headerBuffer.length + payloadBuffer.length);
  }

}

export { PlistServiceEncoder };
export default PlistServiceEncoder;