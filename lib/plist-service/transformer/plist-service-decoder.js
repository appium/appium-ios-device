import Stream from 'stream';
import { parse } from '../../util/plist';
import fs from 'fs';

const HEADER_LENGTH = 4;

class PlistServiceDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    fs.writeFileSync('/Users/umutuzgur/Desktop/lockdown.bin', data, {flag: 'a'});
    this._decode(data);
    callback();
  }

  _decode (data) {
    let payload = data.slice(HEADER_LENGTH, data.length);
    this.push(parse(payload));
  }
}

export { PlistServiceDecoder };
export default PlistServiceDecoder;