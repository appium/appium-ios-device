import Stream from 'stream';
import { createPlist } from '../../util/plist';

const HEADER_LENGTH = 16;

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
    let payloadBuffer = Buffer.from(createPlist(data.payload, false));

    let header = data.header ? data.header : {};
    header.length = HEADER_LENGTH + payloadBuffer.length;
    header.version = header.version ? header.version : 1;
    header.type = header.type ? header.type : 8;
    header.tag = header.tag ? header.tag : this.tag++;

    let headerBuffer = Buffer.alloc(HEADER_LENGTH);
    headerBuffer.writeUInt32LE(header.length, 0);
    headerBuffer.writeUInt32LE(header.version, 4);
    headerBuffer.writeUInt32LE(header.type, 8);
    headerBuffer.writeUInt32LE(header.tag, 12);

    this.push(Buffer.concat([headerBuffer, payloadBuffer]));
  }
}

export { UsbmuxEncoder};
export default UsbmuxEncoder;