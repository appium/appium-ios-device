/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';

class SyslogDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    let consumed = this._decode(data, 0);
    if (consumed < data.length - 1) {
      this.unshift(data.slice(consumed, data.length));
    }
    callback();
  }

  _decode (data, pos) {
    let consumed = pos;
    // We start with i=1 to avoid situations that the phone sends an empty log
    for (let i = 1; i < data.length; i++) {
      // Syslog daemon sends all the messages with a null delimeter or a line delimeter
      if (data[i] === 0) {
        // We can ignore the null delimeter byte
        let end = i - 1;
        this.push(data.toString('utf8', consumed, end), 'utf8');
        consumed = i;
      } else if (data[i] === 10) {
        // We can keep the line delimeter byte
        let end = i;
        this.push(data.toString('utf8', consumed, end), 'utf8');
        consumed = i;
      }
    }
    return consumed;
  }
}

export { SyslogDecoder };
export default SyslogDecoder;
