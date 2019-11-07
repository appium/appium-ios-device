/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import _ from 'lodash';
import log from '../../logger';


const MIN_PRINTABLE_CHAR = 32;
const MAX_PRINTABLE_CHAR = 126;

class StreamLogger extends Stream.Transform {
  constructor (direction, verbose = false) {
    super();

    this._direction = direction;
    this._verbose = verbose;
  }

  _transform (data, encoding, callback) {
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
    callback();
  }

  _log (data) {
    log.debug(`Data ${this._direction === StreamLogger.SEND ? 'sent' : 'received'}, length: ${data.length}`);
    let i = 0;
    while (i < data.length) {
      let buf = [], str = [];
      for (let j = 0; j < 19; j++) {
        if (i >= data.length) {
          // fill in the charcode section with blanks, for formatting
          str[j] = '  ';
          continue;
        }
        const ch = data[i++];
        str[j] = _.padStart(ch.toString(16).toUpperCase(), 2, '0');
        buf[j] = ch < MIN_PRINTABLE_CHAR || ch > MAX_PRINTABLE_CHAR ? '.' : String.fromCharCode(ch);
      }
      log.debug(`${str.join(' ')} ${buf.join('')}`);
    }
  }
}

StreamLogger.SEND = 0;
StreamLogger.RECEIVE = 1;

export { StreamLogger };
export default StreamLogger;
