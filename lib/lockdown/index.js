const LOCKDOWN_PORT = 62078;
const LABEL = 'usbmuxd';
const PROTOCOL_VERSION = 2;

class Lockdown {

  constructor (plistService) {
    this.plistService = plistService;
  }

  /**
   * Makes a query type request to lockdown
   * @param {number} [timeout=5000] the timeout of receiving a response from lockdownd
   * @returns {Object}
   */
  async queryType (timeout = 5000) {
    const data = await this.plistService.sendPlistAndReceive({
      Label: LABEL,
      ProtocolVersion: PROTOCOL_VERSION,
      Request: 'QueryType'
    }, timeout);
    if (data.Request === 'QueryType' && data.Type === 'com.apple.mobile.lockdown') {
      return data;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Starts a lockdown session which allows to use certain apis
   * @param {string} hostID the host id which can be retrieved from the pair record
   * @param {string} systemBUID the host BUID which can be retrieved from the pair record
   * @param {number} [timeout=5000] the timeout of receiving a response from lockdownd
   * @returns {Object}
   */
  async startSession (hostID, systemBUID, timeout = 5000) {
    const data = await this.plistService.sendPlistAndReceive({
      Label: LABEL,
      ProtocolVersion: PROTOCOL_VERSION,
      Request: 'StartSession',
      HostID: hostID,
      SystemBUID: systemBUID
    }, timeout);

    if (data.Request === 'StartSession' && data.SessionID) {
      return { sessionID: data.SessionID, enableSessionSSL: data.EnableSessionSSL };
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Enables ssl in the underlying socket socket connection
   * @param {Buffer} hostPrivateKey the private key which can be retrieved from the pair record
   * @param {Buffer} hostCertificate the certificate which can be retrieved from the pair record
   */
  enableSessionSSL (hostPrivateKey, hostCertificate) {
    this.plistService.enableSessionSSL(hostPrivateKey, hostCertificate);
  }

  /**
  * @typedef {Object} Query
  *
  * @property {?string} key The key we want to access
  * @property {?string} domian The domain where we want to access
  */

  /**
   * Gets values from the device according to the query passed
   * @param {Query} query the query we want to send to lockdownd
   * @param {number} [timeout=5000] the timeout of receiving a response from lockdownd
   * @returns {Object}
   */
  async getValue (query = {}, timeout = 5000) {
    let plist = {
      Label: LABEL,
      ProtocolVersion: PROTOCOL_VERSION,
      Request: 'GetValue'
    };
    Object.assign(plist, query);
    const data = await this.plistService.sendPlistAndReceive(plist, timeout);
    if (data.Request === 'GetValue' && data.Value) {
      return data.Value;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Starts a service on the phone corresponding to the name
   * @param {string} serviceName the name of the service which we want to start
   * @param {number} [timeout=5000] the timeout of receiving a response from lockdownd
   * @returns {Object}
   */
  async startService (serviceName, timeout = 5000) {
    const data = await this.plistService.sendPlistAndReceive({
      Label: LABEL,
      ProtocolVersion: PROTOCOL_VERSION,
      Request: 'StartService',
      Service: serviceName,
    }, timeout);

    if (data.Error) {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    } else {
      return data;
    }
  }
  /**
   * Closes the underlying socket communicating with the phone
   */
  close () {
    this.plistService.close();
  }
}

export { Lockdown, LOCKDOWN_PORT };
export default Lockdown;