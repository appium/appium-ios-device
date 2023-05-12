import Stream from 'stream';

const NEW_LINE_CODE = 0x0A;
const NULL_DELIMETER_CODE = 0x00;
const BACKSLASH_CODE = '\\'.codePointAt(0);
const M_CODE = 'M'.charCodeAt(0);
const DASH_CODE = '-'.charCodeAt(0);
const DASH_SHIFT = 0x80;
const ARROW_CODE = '^'.charCodeAt(0);
const ARROW_SHIFT = 0x40;
const ESCAPE_TOKEN_LEN = 4;


/**
 * Unescapes utf8-encoded characters, so the output looks
 * like a valid string. See https://github.com/appium/appium/issues/14476
 * for more details.
 *
 * @param {Buffer} logBuffer A single escaped log line
 * @returns {string} The unescaped string or the same string if no unescaping
 * is necessary.
 */
function toUtf8String(logBuffer) {
  const parseUtf8Bytes = (start) => {
    let cursor = start;
    const token = new Uint8Array(ESCAPE_TOKEN_LEN);
    const utf8CharsAsBytes = [];
    while (cursor <= logBuffer.length - ESCAPE_TOKEN_LEN) {
      logBuffer.copy(token, 0, cursor, cursor + ESCAPE_TOKEN_LEN);
      if (token[0] !== BACKSLASH_CODE && token[1] !== M_CODE && ![DASH_CODE, ARROW_CODE].includes(token[2])) {
        return [cursor, utf8CharsAsBytes];
      }
      const nextByte = token[3] + (token[2] === DASH_CODE ? DASH_SHIFT : ARROW_SHIFT);
      utf8CharsAsBytes.push(nextByte);
      cursor += ESCAPE_TOKEN_LEN;
    }
    return [cursor, utf8CharsAsBytes];
  };

  let index = 0;
  const bytesView = new Uint8Array(logBuffer);
  const utf8Codes = [];
  while (index < bytesView.length) {
    if (bytesView[index] === BACKSLASH_CODE) {
      const [newIndex, bytes] = parseUtf8Bytes(index);
      if (newIndex > index) {
        utf8Codes.push(...bytes);
        index = newIndex;
        continue;
      }
    }
    utf8Codes.push(bytesView[index++]);
  }
  return Buffer.from(utf8Codes).toString('utf8');
}


class SyslogDecoder extends Stream.Transform {

  constructor (bufferLength) {
    super({ objectMode: true });
    this.bufferIndex = 0;
    this.buffer = Buffer.allocUnsafe(bufferLength);
  }

  _transform (data, encoding, onData) {
    this._decode(data);
    onData();
  }

  _decode (data) {
    for (let i = 0; i < data.length; i++) {
      // Don't store the null delimeter messages
      if (data[i] === NULL_DELIMETER_CODE) {
        continue;
      }
      // Push the data when new line is sent
      if (data[i] === NEW_LINE_CODE) {
        if (this.bufferIndex > 0) {
          const stringBuffer = Buffer.allocUnsafe(this.bufferIndex);
          this.buffer.copy(stringBuffer, 0, 0, this.bufferIndex);
          this.push(toUtf8String(stringBuffer), 'utf8');
          this.bufferIndex = 0;
        }
        continue;
      }
      this.buffer[this.bufferIndex] = data[i];
      this.bufferIndex++;
    }
  }
}

export { SyslogDecoder, toUtf8String };
export default SyslogDecoder;
