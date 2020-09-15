import net from 'net';
import os from 'os';
import _ from 'lodash';
import B from 'bluebird';
import { plist, fs } from 'appium-support';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import UsbmuxDecoder from './transformer/usbmux-decoder.js';
import UsbmuxEncoder from './transformer/usbmux-encoder.js';
import path from 'path';
import PlistService from '../plist-service';
import { Lockdown, LOCKDOWN_PORT } from '../lockdown';
import { BaseServiceSocket } from '../base-service';
import { MB } from '../constants';


const MAX_FRAME_SIZE = 1 * MB;

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
const DEFAULT_USBMUXD_PORT = 27015;
const DEFAULT_USBMUXD_HOST = '127.0.0.1';
const PROG_NAME = name;
const CLIENT_VERSION_STRING = `${name}-${version}`;

function swap16 (val) {
  return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

/**
 * @typedef {Object} SocketOptions
 * @property {?string} socketPath [/var/run/usbmuxd] The full path to the usbmuxd Unix socket
 * @property {?number} socketPort [27015] The port number to connect to if running on Windows
 * or in WSL1 mode
 * @property {?string} socketHost [127.0.0.1] The host name to connect to if running on Windows
 * or in WSL1 mode
 * @property {?number} timeout [5000] The number of milliseconds to wait until
 * the socket is connected
 */

/**
 * Connects a socket to usbmuxd service
 *
 * @param {?SocketOptions} opts
 * @throws {Error} If there was an error while accessing the socket or
 * a connection error happened
 * @throws {B.TimeoutError} if connection timeout happened
 * @returns {net.Socket} Connected socket instance
 */
async function getDefaultSocket (opts = {}) {
  const {
    socketPath = DEFAULT_USBMUXD_SOCKET,
    socketPort = DEFAULT_USBMUXD_PORT,
    socketHost = DEFAULT_USBMUXD_HOST,
    timeout = 5000,
  } = opts;

  let socket;
  if (await fs.exists(socketPath)) {
    socket = net.createConnection(socketPath);
  } else if (process.platform === 'win32'
      || (process.platform === 'linux' && /microsoft/i.test(os.release()))) {
    // Connect to usbmuxd when running on WSL1
    socket = net.createConnection(socketPort, socketHost);
  } else {
    throw new Error(`The usbmuxd socket at '${socketPath}' does not exist or is not accessible`);
  }

  return await new B((resolve, reject) => {
    socket.once('error', reject);
    socket.once('connect', () => resolve(socket));
  }).timeout(timeout);
}


class Usbmux extends BaseServiceSocket {
  constructor (socketClient) {
    super(socketClient);

    this._decoder = new UsbmuxDecoder();
    this._splitter = new LengthBasedSplitter({
      readableStream: socketClient,
      littleEndian: true,
      maxFrameLength: MAX_FRAME_SIZE,
      lengthFieldOffset: 0,
      lengthFieldLength: 4,
      lengthAdjustment: 0,
    });
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new UsbmuxEncoder();
    this._encoder.pipe(this._socketClient);
    this._assignClientFailureHandlers(this._encoder);

    this._tag = 0;
    this._responseCallbacks = {};
    this._decoder.on('data', this._handleData.bind(this));
  }

  _handleData (data) {
    const cb = this._responseCallbacks[data.header.tag] || _.noop;
    cb(data); // eslint-disable-line promise/prefer-await-to-callbacks
  }

  /**
   * Returns the BUID of the host computer from usbmuxd
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {string}
   */
  async readBUID (timeout = 5000) {
    const {tag, receivePromise} = this._receivePlistPromise(timeout, (data) => {
      if (data.payload.BUID) {
        return data.payload.BUID;
      }
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    });

    this._sendPlist({
      tag,
      payload: {
        MessageType: 'ReadBUID',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    return await receivePromise;
  }

  /**
   * Reads the pair record of a device. It will return null if it doesn't exists
   * @param {string} udid the udid of the device
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {?Object}
   */
  async readPairRecord (udid, timeout = 5000) {
    const {tag, receivePromise} = this._receivePlistPromise(timeout, (data) => {
      if (!data.payload.PairRecordData) {
        return null;
      }
      try {
        return plist.parsePlist(data.payload.PairRecordData);
      } catch (err) {
        throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
      }
    });

    this._sendPlist({
      tag,
      payload: {
        MessageType: 'ReadPairRecord',
        PairRecordID: udid,
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });
    return await receivePromise;
  }

  _sendPlist (json) {
    this._encoder.write(json);
  }

  _receivePlistPromise (timeout = 5000, responseCallback) {
    const tag = this._tag++;
    const receivePromise = new B((resolve, reject) => {
      this._responseCallbacks[tag] = (data) => {
        try {
          resolve(responseCallback(data));
        } catch (e) {
          reject(e);
        }
      };
      setTimeout(() => reject(new Error(`Failed to receive any data within the timeout: ${timeout}`)), timeout);
    });
    return {tag, receivePromise};
  }

  /**
   * Lists all devices connected to the host
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {Array}
   */
  async listDevices (timeout = 5000) {
    const {tag, receivePromise} = this._receivePlistPromise(timeout, (data) => {
      if (data.payload.DeviceList) {
        return data.payload.DeviceList;
      }
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    });

    this._sendPlist({
      tag,
      payload: {
        MessageType: 'ListDevices',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    return await receivePromise;
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
    const socket = await this.connect(device.Properties.DeviceID, LOCKDOWN_PORT, timeout);
    return new Lockdown(new PlistService(socket));
  }

  /**
   * Connects to a certain port on the device
   * @param {string} deviceID the device id which can be retrieved from the properties of a device
   * @param {number} port the port number that wants to be connected
   * @param {number} [timeout=5000] the timeout of receiving a response from usbmuxd
   * @returns {net.Socket|Object} The socket or the object returned in the callback if the callback function exists
   */
  async connect (deviceID, port, timeout = 5000) {
    const {tag, receivePromise} = this._receivePlistPromise(timeout, (data) => {
      if (data.payload.MessageType !== 'Result') {
        throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
      }
      if (data.payload.Number === USBMUX_RESULT.OK) {
        this._splitter.shutdown();
        this._socketClient.unpipe(this._splitter);
        this._splitter.unpipe(this._decoder);
        return this._socketClient;
      } else if (data.payload.Number === USBMUX_RESULT.CONNREFUSED) {
        throw new Error(`Connection was refused to port ${port}`);
      } else {
        throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
      }
    });

    this._sendPlist({
      tag,
      payload: {
        MessageType: 'Connect',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING,
        DeviceID: deviceID,
        PortNumber: swap16(port)
      }
    });

    return await receivePromise;
  }
}

export { Usbmux, getDefaultSocket };
export default Usbmux;
