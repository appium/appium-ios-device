import Usbmux from './usbmux';
import { upgradeToSSL } from './ssl-helper';
import _ from 'lodash';

const LOCKDOWN_REQUEST = {
  DEVICE_TIME: { Key: 'TimeIntervalSince1970' },
  DEVICE_NAME: { Key: 'ProductVersion' }
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
    return await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_NAME);
  } finally {
    usbmux.close();
  }
}

async function getDeviceTime (udid, socket) {
  const lockdown = await startLockdownSession(udid, socket);
  try {
    const epochValue = await lockdown.getValue(LOCKDOWN_REQUEST.DEVICE_TIME);
    const date = new Date(0); // The 0 there is the key, which sets the date to the epoch
    date.setUTCSeconds(epochValue);
    return date;
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

export { getConnectedDevices, getOSVersion, getDeviceTime, startLockdownSession, connectPort, connectPortSSL };
