import net from 'net';
import _ from 'lodash';
import B from 'bluebird';
import { plist } from 'appium-support';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import UsbmuxDecoder from './transformer/usbmux-decoder.js';
import UsbmuxEncoder from './transformer/usbmux-encoder.js';
import path from 'path';
import PlistService from '../plist-service';
import { Lockdown, LOCKDOWN_PORT } from '../lockdown';

const USBMUX_RESULT = {
  OK: 0,
  BADCOMMAND: 1,
  BADDEV: 2,
  CONNREFUSED: 3,
};

let name, version;
try {
  // first try assuming this is in the `build` folder
  ({ name, version } = require(path.resolve(__dirname, '..', '..', '..', 'package.json')));
} catch (err) {
  // then try assuming it is not
  ({ name, version } = require(path.resolve(__dirname, '..', '..', 'package.json')));
}

const DEFAULT_USBMUXD_SOCKET = '/var/run/usbmuxd';
const PROG_NAME = name;
const CLIENT_VERSION_STRING = `${name}-${version}`;

function swap16 (val) {
  return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

class Usbmux {

  constructor (socketClient = net.createConnection(DEFAULT_USBMUXD_SOCKET)) {
    this._socketClient = socketClient;

    this._decoder = new UsbmuxDecoder();
    this._splitter = new LengthBasedSplitter(true, 1000000, 0, 4, 0);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new UsbmuxEncoder();
    this._encoder.pipe(this._socketClient);
  }

  /**
   * Returns the BUID of the host computer from usbmuxd
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {string}
   */
  async readBUID (timeout = 5000) {
    const receivePromise = this._receivePlistPromise(timeout);

    this._sendPlist({
      MessageType: 'ReadBUID',
      ProgName: PROG_NAME,
      ClientVersionString: CLIENT_VERSION_STRING
    });

    const data = await receivePromise;
    if (data.payload.BUID) {
      return data.payload.BUID;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Reads the pair record of a device. It will return null if it doesn't exists
   * @param {string} udid the udid of the device
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {?Object}
   */
  async readPairRecord (udid, timeout = 5000) {
    const receivePromise = this._receivePlistPromise(timeout);

    this._sendPlist({
      MessageType: 'ReadPairRecord',
      PairRecordID: udid,
      ProgName: PROG_NAME,
      ClientVersionString: CLIENT_VERSION_STRING
    });
    const data = await receivePromise;
    if (data.payload.PairRecordData) {
      try {
        return plist.parsePlist(data.payload.PairRecordData);
      } catch (err) {
        throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
      }
    } else {
      return null;
    }
  }

  _sendPlist (json) {
    this._encoder.write(json);
  }

  _receivePlistPromise (timeout = 5000) {
    return new B((resolve, reject) => {
      this._decoder.once('data', resolve);
      setTimeout(() => reject(new Error(`Failed to receive any data within the timeout: ${timeout}`)), timeout);
    });
  }

  /**
   * Lists all devices connected to the host
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {Array}
   */
  async listDevices (timeout = 5000) {
    const receivePromise = this._receivePlistPromise(timeout);

    this._sendPlist({
      MessageType: 'ListDevices',
      ProgName: PROG_NAME,
      ClientVersionString: CLIENT_VERSION_STRING
    });

    const data = await receivePromise;
    if (data.payload.DeviceList) {
      return data.payload.DeviceList;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  /**
   * Looks for a device with the passed udid. It will return undefined if the device is not found
   * @param {string} udid the udid of the device
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {?Object}
   */
  async findDevice (udid, timeout = 5000) {
    const devices = await this.listDevices(timeout);
    return _.find(devices, (device) => device.Properties.SerialNumber === udid);
  }

  /**
   * Connects to the lockdownd on the device and returns a Lockdown client
   * @param {string} udid the udid of the device
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {Lockdown}
   */
  async connectLockdown (udid, timeout = 5000) {
    const device = await this.findDevice(udid, timeout);
    if (!device) {
      throw new Error(`Could not find the expected device '${udid}'`);
    }
    const plistService = new PlistService(await this.connect(device.Properties.DeviceID, LOCKDOWN_PORT, timeout));
    return new Lockdown(plistService);
  }

  /**
   * Connects to a certain port on the device
   * @param {string} deviceID the device id which can be retrieved from the properties of a device
   * @param {number} port the port number that wants to be connected
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   */
  async connect (deviceID, port, timeout = 5000) {
    const receivePromise = this._receivePlistPromise(timeout);

    this._sendPlist({
      MessageType: 'Connect',
      ProgName: PROG_NAME,
      ClientVersionString: CLIENT_VERSION_STRING,
      DeviceID: deviceID,
      PortNumber: swap16(port)
    });

    const data = await receivePromise;
    if (data.payload.MessageType !== 'Result') {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
    if (data.payload.Number === USBMUX_RESULT.OK) {
      this._socketClient.unpipe(this._splitter);
      this._splitter.unpipe(this._decoder);
      return this._socketClient;
    } else if (data.payload.Number === USBMUX_RESULT.CONNREFUSED) {
      throw new Error(`Connection was refused to port ${port}`);
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }
  /**
   * Closes the underlying socket communicating to the usbmuxd
   */
  close () {
    this._socketClient.destroy();
  }
}

export { Usbmux };
export default Usbmux;
