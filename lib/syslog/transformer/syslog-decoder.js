import Stream from 'stream';

const NEW_LINE_CODE = 0x0A;
const NULL_DELIMETER_CODE = 0x00;
const BACKSLASH_CODE = '\\'.codePointAt(0);
const SHIFTS_MAPPING = {
  '-': 0x80,
  '^': 0x40,
};
const ESCAPE_TOKEN_LEN = 4;
const ESCAPE_TOKEN_PATTERN = /\\M(-|\^)(.)/;


function toUtf8Byte (escapedChar, modifier) {
  const shift = SHIFTS_MAPPING[modifier];
  return isNaN(shift) ? null : escapedChar.codePointAt(0) + shift;
}

/**
 * Unescapes utf8-encoded characters, so the output looks
 * like a valid string. See https://github.com/appium/appium/issues/14476
 * for more details.
 *
 * @param {Buffer} logBuffer A single escaped log line
 * @returns {string} The unescaped string or the same string if no unescaping
 * is necessary.
 */
function unescape (logBuffer) {
  const parseUtf8Chars = (start) => {
    let cursor = start;
    const token = new Uint8Array(ESCAPE_TOKEN_LEN);
    const utf8CharsAsBytes = [];
    while (cursor <= logBuffer.length - ESCAPE_TOKEN_LEN) {
      logBuffer.copy(token, 0, cursor, cursor + ESCAPE_TOKEN_LEN);
      const tokenStr = Buffer.from(token).toString('latin1');
      const tokenMatch = ESCAPE_TOKEN_PATTERN.exec(tokenStr);
      if (!tokenMatch) {
        break;
      }
      const byte = toUtf8Byte(tokenMatch[2], tokenMatch[1]);
      if (byte === null) {
        break;
      }
      utf8CharsAsBytes.push(byte);
      cursor += ESCAPE_TOKEN_LEN;
    }
    return utf8CharsAsBytes.length
      ? [cursor, Buffer.from(utf8CharsAsBytes).toString('utf8')]
      : [start, null];
  };

  let index = 0;
  let result = '';
  const bytesView = new Uint8Array(logBuffer);
  while (index < bytesView.length) {
    if (bytesView[index] === BACKSLASH_CODE) {
      const [newIndex, chars] = parseUtf8Chars(index);
      if (newIndex > index) {
        result += chars;
        index = newIndex;
        continue;
      }
    }
    result += String.fromCharCode(bytesView[index++]);
  }

  return result;
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
          this.push(unescape(stringBuffer), 'utf8');
          this.bufferIndex = 0;
        }
        continue;
      }
      this.buffer[this.bufferIndex] = data[i];
      this.bufferIndex++;
    }
  }
}

export { SyslogDecoder, unescape };
export default SyslogDecoder;
