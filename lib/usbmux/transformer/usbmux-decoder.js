import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 16;

class UsbmuxDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    this._decode(data);
    onData();
  }

  _decode (data) {
    const header = {
      length: data.readUInt32LE(0),
      version: data.readUInt32LE(4),
      type: data.readUInt32LE(8),
      tag: data.readUInt32LE(12)
    };

    let payload = data.slice(HEADER_LENGTH, data.length);
    this.push({ header, payload: plist.parsePlist(payload) });
  }

}

export { UsbmuxDecoder };
export default UsbmuxDecoder;
