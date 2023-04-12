import SyslogDecoder from './transformer/syslog-decoder';
import { KB } from '../constants';
import { BaseServiceSocket } from '../base-service';


//We just need to write any data to the client. It doesn't matter what we send
const SYSLOG_SERVICE_NAME = 'com.apple.syslog_relay';
const START_MESSAGE = 'start';

class SyslogService extends BaseServiceSocket {
  constructor (socketClient) {
    super(socketClient);

    this._decoder = new SyslogDecoder(5 * KB);
    this._socketClient.pipe(this._decoder);
    this._assignClientFailureHandlers(this._decoder);
  }
  /** The callback function which will be called during log listening
   * @callback LogCallback
   * @param {string} log The log that is sent from the phone
  */

  /**
   * Start recieving logs from the phone. The callback when a log is recieved
   * @param {LogCallback} onData
   */
  start (onData) {
    this._decoder.on('data', onData);
    this._socketClient.write(START_MESSAGE);
  }
}

export { SyslogService, SYSLOG_SERVICE_NAME };
export default SyslogService;
