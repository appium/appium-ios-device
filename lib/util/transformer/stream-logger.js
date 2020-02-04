import Stream from 'stream';
import _ from 'lodash';
import log from '../../logger';


const MIN_PRINTABLE_CHAR = 32;
const MAX_PRINTABLE_CHAR = 126;

const CHARACTERS_PER_LINE = 19;

class StreamLogger extends Stream.Transform {
  constructor (direction, verbose = false) {
    super({ objectMode: true });

    this._direction = direction;
    this._verbose = verbose;
  }

  _transform (data, encoding, onData) {
    if (this._verbose) {
      try {
        this._log(data);
      } catch (err) {
        // in case something goes wrong, log it so we can fix the parsing
        // and also allow everything to continue without interruption
        log.debug(`Error logging data: ${err.message}`);
      }
    }

    this.push(data);
    onData();
  }

  _log (data) {
    log.debug(`Data ${this._direction === StreamLogger.SEND ? 'sent' : 'received'}, length: ${data.length}`);

    // format as used by ios-webkit-debug-proxy as well as tools like socat
    // print out the data in two sections, one the hexadecimal renderings of the characters,
    // the other the printable characters (with '.' for unprintable characters).
    let i = 0;
    while (i < data.length) {
      let hex = [], char = [];
      // create each line of text to output
      for (let j = 0; j < CHARACTERS_PER_LINE; j++) {
        if (i >= data.length) {
          // fill in the charcode section with blanks, for formatting,
          // when there is no more data
          hex[j] = '  ';
          continue;
        }
        const charCode = data[i++];
        // hexadecimal representation, forced into 2 places
        hex[j] = _.padStart(charCode.toString(16).toUpperCase(), 2, '0');
        // character representation, with '.' when unprintable
        char[j] = charCode < MIN_PRINTABLE_CHAR || charCode > MAX_PRINTABLE_CHAR
          ? '.'
          : String.fromCharCode(charCode);
      }
      log.debug(`${hex.join(' ')} ${char.join('')}`);
    }
  }
}

StreamLogger.SEND = 0;
StreamLogger.RECEIVE = 1;

export { StreamLogger };
export default StreamLogger;
