import {BaseServicePlist} from '../base-service';
import {fs, plist} from '@appium/support';


const MC_INSTALL_SERVICE_NAME = 'com.apple.mobile.MCInstall';
const ACKNOWLEDGED = 'Acknowledged';

function checkACK (res, name) {
  if (res.Status !== ACKNOWLEDGED) {
    throw new Error(`${name} error: ${JSON.stringify(res)}`);
  }
  return res;
}

class MCInstallProxyService extends BaseServicePlist {
  constructor (socketClient) {
    super(socketClient);
  }

  /**
   * @typedef {Object} ProfileList
   * @property {any[]} OrderedIdentifiers list of all profile ident
   * @property {Object} ProfileManifest
   * @property {Object} ProfileMetadata
   * @property {String} Status
   */

  /**
   * Get all profiles of iOS devices
   * @returns {Promise<ProfileList>}
   * e.g.
   * {
   *   OrderedIdentifiers: [ '2fac1c2b3d684843189b2981c718b0132854a847a' ],
   *   ProfileManifest: {
   *     '2fac1c2b3d684843189b2981c718b0132854a847a': {
   *       Description: 'Charles Proxy CA (7 Dec 2020, MacBook-Pro.local)',
   *       IsActive: true
   *     }
   *   },
   *   ProfileMetadata: {
   *     '2fac1c2b3d684843189b2981c718b0132854a847a': {
   *       PayloadDisplayName: 'Charles Proxy CA (7 Dec 2020, MacBook-Pro.local)',
   *       PayloadRemovalDisallowed: false,
   *       PayloadUUID: 'B30005CC-BC73-4E42-8545-8DA6C44A8A71',
   *       PayloadVersion: 1
   *     }
   *   },
   *   Status: 'Acknowledged'
   * }
   */
  async getProfileList () {
    const res = await this._plistService.sendPlistAndReceive({RequestType: 'GetProfileList'});
    return checkACK(res, 'getProfileList');
  }

  /**
   * Install profile to iOS device
   * @param {String} path  must be a certificate file .PEM .CER and more formats
   * e.g: /Downloads/charles-certificate.pem
   * @returns {Promise<Record<any, any>>} e.g. {Status: 'Acknowledged'}
   */
  async installProfile (path) {
    const payload = await fs.readFile(path);
    const res = await this._plistService.sendPlistAndReceive({'RequestType': 'InstallProfile', 'Payload': payload});
    return checkACK(res, 'installProfile');
  }

  /**
   * Remove profile from iOS device
   * @param {String} ident  Query identifier list through getProfileList method
   * @returns {Promise<Record<any, any>>} e.g. {Status: 'Acknowledged'}
   */
  async removeProfile (ident) {
    const profiles = await this.getProfileList();
    const meta = profiles.ProfileMetadata[ident];
    if (!meta) {
      throw new Error(`not find installed profile ident:${ident}`);
    }
    const data = plist.createBinaryPlist({'PayloadType': 'Configuration',
                                          'PayloadIdentifier': ident,
                                          'PayloadUUID': meta.PayloadUUID,
                                          'PayloadVersion': meta.PayloadVersion});
    const res = await this._plistService.sendPlistAndReceive({'RequestType': 'RemoveProfile', 'ProfileIdentifier': data});
    return checkACK(res, 'removeProfile');
  }
}

export { MCInstallProxyService, MC_INSTALL_SERVICE_NAME };
export default MCInstallProxyService;
