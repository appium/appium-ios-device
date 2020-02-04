import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 16;
const VERSION = 1;
const TYPE = 8;

class UsbmuxEncoder extends Stream.Transform {
  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    this._encode(data);
    onData();
  }

  _encode (data) {
    const payloadBuffer = Buffer.from(plist.createPlist(data.payload, false));

    const header = {
      length: HEADER_LENGTH + payloadBuffer.length,
      version: VERSION,
      type: TYPE,
      tag: data.tag
    };

    const headerBuffer = Buffer.allocUnsafe(HEADER_LENGTH);
    headerBuffer.writeUInt32LE(header.length, 0);
    headerBuffer.writeUInt32LE(header.version, 4);
    headerBuffer.writeUInt32LE(header.type, 8);
    headerBuffer.writeUInt32LE(header.tag, 12);

    this.push(Buffer.concat([headerBuffer, payloadBuffer], headerBuffer.length + payloadBuffer.length));
  }
}

export { UsbmuxEncoder};
export default UsbmuxEncoder;
