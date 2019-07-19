/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';

const NEW_LINE_CODE = 0x0A;
const NULL_DELIMETER_CODE = 0x00;

class SyslogDecoder extends Stream.Transform {

  constructor (bufferLength) {
    super({ objectMode: true });
    this.bufferIndex = 0;
    this.buffer = Buffer.allocUnsafe(bufferLength);
  }

  _transform (data, encoding, callback) {
    this._decode(data);
    callback();
  }

  _decode (data) {
    for (let i = 0; i < data.length; i++) {
      // Don't store the null delimeter messages
      if (data[i] === NULL_DELIMETER_CODE) {
        continue;
      }
      // Push the data when new line is sent
      if (data[i] === NEW_LINE_CODE) {
        if (this.bufferIndex !== 0) {
          const stringBuffer = Buffer.allocUnsafe(this.bufferIndex);
          this.buffer.copy(stringBuffer, 0, 0, this.bufferIndex);
          this.push(stringBuffer.toString('utf8'), 'utf8');
          this.bufferIndex = 0;
        }
        continue;
      }
      this.buffer[this.bufferIndex] = data[i];
      this.bufferIndex++;
    }
  }
}

export { SyslogDecoder };
export default SyslogDecoder;
