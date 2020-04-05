import Usbmux, { getDefaultSocket } from './usbmux';
import { upgradeToSSL } from './ssl-helper';
import _ from 'lodash';
import log from './logger';

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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Array.<string>} The list of device serial numbers (udid) or
 * an empty list if no devices are connected
 */
async function getConnectedDevices (socket = null) {
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {string}
 */
async function getOSVersion (udid, socket = null) {
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {string}
 */
async function getDeviceName (udid, socket = null) {
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {DeviceTime}
 */
async function getDeviceTime (udid, socket = null) {
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {Lockdown}
 */
async function startLockdownSession (udid, socket = null) {
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {tls.TLSSocket|Object} The socket or the object returned in the callback if the callback function exists
 */
async function connectPortSSL (udid, port, socket = null) {
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
    return upgradeToSSL(socket, pairRecord.HostPrivateKey, pairRecord.HostCertificate);
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
 * @param {?net.Socket} socket the socket of usbmuxd. It will default to /var/run/usbmuxd if it is not passed
 * @returns {net.Socket|Object} The socket or the object returned in the callback if the callback function exists
 */
async function connectPort (udid, port, socket = null) {
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

export {
  getConnectedDevices, getOSVersion, getDeviceName, getDeviceTime,
  startLockdownSession, connectPort, connectPortSSL,
};
