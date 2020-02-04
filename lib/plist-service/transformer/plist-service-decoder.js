import _ from 'lodash';
import Stream from 'stream';
import { plist } from 'appium-support';

const HEADER_LENGTH = 4;

class PlistServiceDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    this._decode(data);
    onData();
  }

  _decode (data) {
    const payload = data.slice(HEADER_LENGTH, data.length);
    if (_.isEmpty(payload)) {
      return;
    }
    const object = plist.parsePlist(payload);
    if (!object) {
      return;
    }
    this.push(object);
  }
}

export { PlistServiceDecoder };
export default PlistServiceDecoder;
