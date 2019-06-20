/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';

class SyslogDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {

    let consumed = this._decode(data, 0);
    if (consumed < data.length) {
      this.unshift(data.slice(consumed, data.length));
    }
    callback();
  }

  _decode (data, pos) {
    let consumed = pos;
    for (let i = 0; i < data.length; i++) {
      // Syslog daemon sends all the messages with a null delimeter
      if (data[i] === 0) {
        this.push(data.toString('utf8', consumed, i - 1), 'utf8');
        consumed = i;
      }
    }
    return consumed;
  }
}

export { SyslogDecoder};
export default SyslogDecoder;
