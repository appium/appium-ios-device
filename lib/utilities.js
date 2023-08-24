import Usbmux, { getDefaultSocket } from './usbmux';
import { upgradeToSSL, enableSSLHandshakeOnly } from './ssl-helper';
import _ from 'lodash';
import log from './logger';
import { findDeveloperImage } from './imagemounter/utils/list_developer_image';

// https://github.com/samdmarshall/iOS-Internals/blob/master/lockbot/lockbot/lockdown_keys.h
const LOCKDOWN_REQUEST = {
  DEVICE_TIME: { Key: 'TimeIntervalSince1970' },
  DEVICE_UTC_OFFSET: { Key: 'TimeZoneOffsetFromUTC' },
  DEVICE_TIME_ZONE: { Key: 'TimeZone' },
  DEVICE_VERSION: { Key: 'ProductVersion' },
  DEVICE_NAME: { Key: 'DeviceName' }
};


/**
 * Retrieves the udids of the connected devices
 *
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<string[]>} The list of device serial numbers (udid) or
 * an empty list if no devices are connected
 */
async function getConnectedDevices(socket = null) {
  let usbmux;
  try {
    usbmux = new Usbmux(socket || await getDefaultSocket());
  } catch (e) {
    log.debug(e);
    return [];
  }
  try {
    const devices = await usbmux.listDevices();
    const udids = devices.map((device) => device.Properties.SerialNumber);
    return _.uniq(udids);
  } finally {
    usbmux.close();
  }
}

/**
 * Retrieves the os version of the device
 *
 * @param {string} udid Device UDID
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<string>}
 */
async function getOSVersion(udid, socket = null) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    // lockdown doesn't need to be closed since it uses the same socket usbmux uses
    const lockdown = await usbmux.connectLockdown(udid);
    return await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_VERSION);
  } finally {
    usbmux.close();
  }
}

/**
 * Retrieves the name of the device
 *
 * @param {string} udid Device UDID
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<string>}
 */
async function getDeviceName(udid, socket = null) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    // lockdown doesn't need to be closed since it uses the same socket usbmux uses
    const lockdown = await usbmux.connectLockdown(udid);
    return await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_NAME);
  } finally {
    usbmux.close();
  }
}

/**
 * Returns all available device values
 * @param {string} udid Device UDID
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<any>} Returns available default device values via lockdown.
 * e.g.
 * {
 *   "BasebandCertId"=>3840149528,
 *   "BasebandKeyHashInformation"=>
 *     {"AKeyStatus"=>2,
 *     "SKeyHash"=>{
 *       "type"=>"Buffer",
 *       "data"=>[187, 239, ....]},
 *     "SKeyStatus"=>0},
 *   "BasebandSerialNumber"=>{"type"=>"Buffer", "data"=>[...]},
 *   "BasebandVersion"=>"11.01.02",
 *   "BoardId"=>2,
 *   "BuildVersion"=>"19C56",
 *   "CPUArchitecture"=>"arm64",
 *   "ChipID"=>32768,
 *   "DeviceClass"=>"iPhone",
 *   "DeviceColor"=>"#c8caca",
 *   "DeviceName"=>"kazu",
 *   "DieID"=>1111111111111,
 *   "HardwareModel"=>"N69uAP",
 *   "HasSiDP"=>true,
 *   "PartitionType"=>"GUID_partition_scheme",
 *   "ProductName"=>"iPhone OS",
 *   "ProductType"=>"iPhone8,4",
 *   "ProductVersion"=>"15.2",
 *   "ProductionSOC"=>true,
 *   "ProtocolVersion"=>"2",
 *   "SupportedDeviceFamilies"=>[1],
 *   "TelephonyCapability"=>true,
 *   "UniqueChipID"=>1111111111111,
 *   "UniqueDeviceID"=>"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
 *   "WiFiAddress"=>"00:00:00:00:00:00"
 * }
 */
async function getDeviceInfo(udid, socket = null) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    const lockdown = await usbmux.connectLockdown(udid);
    return await lockdown.getValue();
  } finally {
    usbmux.close();
  }
}

/**
 * @typedef {Object} DeviceTime
 *
 * @property {number} timestamp Unix timestamp in seconds since 1970-01-01T00:00:00Z
 * @property {number} utcOffset The difference in minutes between the UTC time and the local device time.
 * Can be negative.
 * @property {string} timeZone Time zone name configured on the device, for example `Europe/Paris`
 */

/**
 * Retrieves the local time from the device under test
 *
 * @param {string} udid Device UDID
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<DeviceTime>}
 */
async function getDeviceTime(udid, socket = null) {
  const lockdown = await startLockdownSession(udid, socket);
  try {
    return {
      timestamp: await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_TIME),
      // Apple returns utcOffset in seconds which doesnt comply with the general standard
      utcOffset: await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_UTC_OFFSET) / 60,
      timeZone: await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_TIME_ZONE),
    };
  } finally {
    lockdown.close();
  }
}

/**
 * Starts a lockdown session on the given device
 *
 * @param {string} udid Device UDID
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<import('./lockdown').Lockdown>}
 */
async function startLockdownSession(udid, socket = null) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    const pairRecord = await usbmux.readPairRecord(udid);
    if (!pairRecord) {
      throw new Error(`Could not find a pair record for device '${udid}'. Please first pair with the device`);
    }
    // lockdown doesn't need to be closed since it uses the same socket usbmux uses
    const lockdown = await usbmux.connectLockdown(udid);
    await lockdown.startSession(pairRecord.HostID, pairRecord.SystemBUID);
    lockdown.enableSessionSSL(pairRecord.HostPrivateKey, pairRecord.HostCertificate);
    return lockdown;
  } catch (e) {
    usbmux.close();
    throw e;
  }
}

/**
 * Connects to a given port with the certs and keys used in the pairing process
 *
 * @param {string} udid Device UDID
 * @param {number} port Port to connect
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @param {boolean} handshakeOnly only handshake and return the initial socket
 * @returns {Promise<import('tls').TLSSocket|Object>} The socket or the object returned in the callback if the callback function exists
 */
async function connectPortSSL(udid, port, socket = null, handshakeOnly = false) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    const device = await usbmux.findDevice(udid);
    if (!device) {
      throw new Error(`Could not find the expected device '${udid}'`);
    }
    const pairRecord = await usbmux.readPairRecord(udid);
    if (!pairRecord) {
      throw new Error(`Could not find a pair record for device '${udid}'. Please first pair with the device`);
    }
    const socket = await usbmux.connect(device.Properties.DeviceID, port, undefined);
    return handshakeOnly ?
      await enableSSLHandshakeOnly(socket, pairRecord.HostPrivateKey, pairRecord.HostCertificate) :
      upgradeToSSL(socket, pairRecord.HostPrivateKey, pairRecord.HostCertificate);
  } catch (e) {
    usbmux.close();
    throw e;
  }
}

/**
 * Connects to a given port
 *
 * @param {string} udid Device UDID
 * @param {number} port Port to connect
 * @param {import('net').Socket?} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Promise<NodeJS.Socket|Object>} The socket or the object returned in the callback if the callback function exists
 */
async function connectPort(udid, port, socket = null) {
  const usbmux = new Usbmux(socket || await getDefaultSocket());
  try {
    const device = await usbmux.findDevice(udid);
    if (!device) {
      throw new Error(`Could not find the expected device ${udid}`);
    }
    return await usbmux.connect(device.Properties.DeviceID, port, undefined);
  } catch (e) {
    usbmux.close();
    throw e;
  }
}

/**
 * Search developer image for device based on given repo. If certain file was found, this would automatic download,
 * unzip and return the path of developer image and signature file.
 *
 * Developer images and signature files should be put into a zip file that matches this regular expression:
 * `\d+\.\d+(\(([\w_|.()])+\))?.zip`. The image file should be named to `DeveloperDiskImage.dmg`,
 *  and the signature file should be named to `DeveloperDiskImage.dmg.signature`.
 * Both files should be placed into same folder.
 * @param {string} udid
 * @param {import('./imagemounter/utils/list_developer_image').ImageFromGithubRepo} opts
 * github repo option, `githubRepo` .
 * @returns {Promise<import('./imagemounter/utils/list_developer_image').ImagePath>}
 * @throws If opts error or failed on searching image
 */
async function fetchImageFromGithubRepo(udid, opts) {
  const osVersion = await getOSVersion(udid);
  if (!opts.githubRepo) {
    throw new TypeError(`Mount option should contains local path or github repo, got ${JSON.stringify(opts)} instead`);
  }
  return await findDeveloperImage(osVersion, opts);
}


export {
  getConnectedDevices, getOSVersion, getDeviceName, getDeviceTime,
  startLockdownSession, connectPort, connectPortSSL, getDeviceInfo,
  fetchImageFromGithubRepo
};
