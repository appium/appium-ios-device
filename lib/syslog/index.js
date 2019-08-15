/* eslint-disable promise/prefer-await-to-callbacks */
import SyslogDecoder from './transformer/syslog-decoder';
import { KB } from '../constants';

//We just need to write any data to the client. It doesn't matter what we send
const SYSLOG_SERVICE_NAME = 'com.apple.syslog_relay';
const START_MESSAGE = 'start';

class SyslogService {

  constructor (socketClient) {
    this._socketClient = socketClient;
    this._decoder = new SyslogDecoder(5 * KB);
    this._socketClient.pipe(this._decoder);

  }
  /** The callback function which will be called during log listening
   * @name LogCallback
   * @function
   * @param {string} log The log that is sent from the phone
  */

  /**
   * Start recieving logs from the phone. The callback when a log is recieved
   * @param {LogCallback} callback
   */
  start (callback) {
    this._decoder.on('data', callback);
    this._socketClient.write(START_MESSAGE);
  }

  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    this._socketClient.destroy();
  }

}

export { SyslogService, SYSLOG_SERVICE_NAME };
export default SyslogService;