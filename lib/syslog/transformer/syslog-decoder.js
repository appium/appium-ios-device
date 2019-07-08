/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';

class SyslogDecoder extends Stream.Transform {

  constructor (bufferLength) {
    super({ objectMode: true });
    this.bufferReadableLength = 0;
    this.buffer = Buffer.allocUnsafe(bufferLength);
  }

  _transform (data, encoding, callback) {
    data.copy(this.buffer, this.bufferReadableLength, 0, data.length);
    this.bufferReadableLength += data.length;
    const consumed = this._decode(this.buffer, 0, this.bufferReadableLength);
    if (consumed !== this.bufferReadableLength - 1) {
      const leftover = this.buffer.slice(consumed, this.bufferReadableLength);
      this.bufferReadableLength = leftover.length;
      leftover.copy(this.buffer, 0, 0, leftover.length);
    }
    callback();
  }

  _decode (data, pos, length) {
    let consumed = pos;
    // We start with i=1 to avoid situations that the phone sends an empty log
    for (let i = 1; i < length; i++) {
      // Syslog daemon sends all the messages with a null delimeter or a line delimeter
      if (data[i] === 10) {
        // We can ignore the new line byte
        const end = i - 1;
        // We can ignore the null delimeter byte if it exists
        const start = data[consumed] === 0 ? consumed + 1 : consumed;
        this.push(data.toString('utf8', start, end), 'utf8');
        consumed = i;
      }
    }
    return consumed;
  }
}

export { SyslogDecoder };
export default SyslogDecoder;
