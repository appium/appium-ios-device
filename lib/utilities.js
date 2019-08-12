import Usbmux from './usbmux';
import { upgradeToSSL } from './ssl-helper';
import _ from 'lodash';

const LOCKDOWN_REQUEST = {
  DEVICE_TIME: { Key: 'TimeIntervalSince1970' },
  DEVICE_UTC_OFFSET: { Key: 'TimeZoneOffsetFromUTC' },
  DEVICE_VERSION: { Key: 'ProductVersion' },
  DEVICE_NAME: { Key: 'DeviceName' }
};

async function getConnectedDevices (socket) {
  const usbmux = new Usbmux(socket);
  try {
    const devices = await usbmux.listDevices();
    const udids = devices.map((device) => device.Properties.SerialNumber);
    return _.uniq(udids);
  } finally {
    usbmux.close();
  }
}

async function getOSVersion (udid, socket) {
  const usbmux = new Usbmux(socket);
  try {
    // lockdown doesn't need to be closed since it uses the same socket usbmux uses
    const lockdown = await usbmux.connectLockdown(udid);
    return await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_VERSION);
  } finally {
    usbmux.close();
  }
}

async function getDeviceName (udid, socket) {
  const usbmux = new Usbmux(socket);
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
 * @property {number} utcOffset The difference in seconds between the UTC time and the local device time.
 * Can be negative.
 */

/**
 * Retrieves the local time from the device under test
 *
 * @param {string} udid Device UDID
 * @param {Object} socket
 * @returns {DeviceTime}
 */
async function getDeviceTime (udid, socket) {
  const lockdown = await startLockdownSession(udid, socket);
  try {
    const timestamp = await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_TIME);
    const utcOffset = await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_UTC_OFFSET);
    return {
      timestamp,
      utcOffset,
    };
  } finally {
    lockdown.close();
  }
}

async function startLockdownSession (udid, socket) {
  const usbmux = new Usbmux(socket);
  try {
    const pairRecord = await usbmux.readPairRecord(udid);
    if (!pairRecord) {
      throw new Error(`Couldn't find a pair record for device ${udid}. Please first pair with the device`);
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

async function connectPortSSL (udid, port, socket) {
  const usbmux = new Usbmux(socket);
  try {
    const device = await usbmux.findDevice(udid);
    if (!device) {
      throw new Error(`Couldn't find the expected device ${udid}`);
    }
    const pairRecord = await usbmux.readPairRecord(udid);
    if (!pairRecord) {
      throw new Error(`Couldn't find a pair record for device ${udid}. Please first pair with the device`);
    }
    const socket = await usbmux.connect(device.Properties.DeviceID, port);
    return upgradeToSSL(socket, pairRecord.HostPrivateKey, pairRecord.HostCertificate);
  } catch (e) {
    usbmux.close();
    throw e;
  }
}

async function connectPort (udid, port, socket) {
  const usbmux = new Usbmux(socket);
  try {
    const device = await usbmux.findDevice(udid);
    if (!device) {
      throw new Error(`Couldn't find the expected device ${udid}`);
    }
    return await usbmux.connect(device.Properties.DeviceID, port);
  } catch (e) {
    usbmux.close();
    throw e;
  }
}

export {
  getConnectedDevices, getOSVersion, getDeviceName, getDeviceTime,
  startLockdownSession, connectPort, connectPortSSL,
};
