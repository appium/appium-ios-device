/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 16;
const VERSION = 1;
const TYPE = 8;

class UsbmuxEncoder extends Stream.Transform {
  constructor () {
    super({ objectMode: true });

    this.tag = 0;
  }

  _transform (data, encoding, callback) {
    this._encode(data);
    callback();
  }

  _encode (data) {
    let payloadBuffer = Buffer.from(plist.createPlist(data, false));

    let header = {
      length: HEADER_LENGTH + payloadBuffer.length,
      version: VERSION,
      type: TYPE,
      tag: this.tag++
    };

    let headerBuffer = Buffer.alloc(HEADER_LENGTH);
    headerBuffer.writeUInt32LE(header.length, 0);
    headerBuffer.writeUInt32LE(header.version, 4);
    headerBuffer.writeUInt32LE(header.type, 8);
    headerBuffer.writeUInt32LE(header.tag, 12);

    this.push(Buffer.concat([headerBuffer, payloadBuffer], headerBuffer.length + payloadBuffer.length));
  }
}

export { UsbmuxEncoder};
export default UsbmuxEncoder;
