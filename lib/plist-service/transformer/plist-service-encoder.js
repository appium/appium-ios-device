import Stream from 'stream';
import { plist } from '@appium/support';


const HEADER_LENGTH = 4;

class PlistServiceEncoder extends Stream.Transform {
  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    this.push(this._encode(data), 'binary');
    onData();
  }

  _encode (data) {
    const payloadBuffer = plist.createBinaryPlist(data);
    const headerBuffer = Buffer.alloc(HEADER_LENGTH);
    headerBuffer.writeUInt32BE(payloadBuffer.length, 0);
    return Buffer.concat([headerBuffer, payloadBuffer], headerBuffer.length + payloadBuffer.length);
  }
}

export { PlistServiceEncoder };
export default PlistServiceEncoder;
