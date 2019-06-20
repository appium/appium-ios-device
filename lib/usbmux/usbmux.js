import net from 'net';
import _ from 'lodash';
import B from 'bluebird';
import { parse } from '../util/plist.js';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import UsbmuxDecoder from './transformer/usbmux-decoder.js';
import UsbmuxEncoder from './transformer/usbmux-encoder.js';
import path from 'path';
import PlistService from '../plist-service/plist-service';
import { Lockdown, LOCKDOWN_PORT } from '../lockdown/lockdown';


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

  async readBUID (timeout = 5000) {
    this.sendPlist({
      payload: {
        MessageType: 'ReadBUID',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    const data = await this.receivePlist(timeout);
    if (data.payload.BUID) {
      return data.payload.BUID;
    } else {
      throw new Error(data);
    }
  }

  async readPairRecord (udid, timeout = 5000) {
    this.sendPlist({
      payload: {
        MessageType: 'ReadPairRecord',
        PairRecordID: udid,
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });
    const data = await this.receivePlist(timeout);
    if (data.payload.PairRecordData) {
      try {
        return parse(data.payload.PairRecordData);
      } catch (err) {
        throw new Error(data);
      }
    } else {
      return null;
    }
  }

  sendPlist (json) {
    this._encoder.write(json);
  }

  receivePlist (timeout = 5000) {
    this._splitter.resume();
    return new B((resolve, reject) => {
      setTimeout(function () { reject(new Error(`Failed to receive any data within the timeout: ${timeout}`)); }, timeout);
      this._decoder.once('data', (data) => resolve(data));
    });
  }

  async listDevices (timeout = 5000) {
    this.sendPlist({
      payload: {
        MessageType: 'ListDevices',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    const data = await this.receivePlist(timeout);
    if (data.payload.DeviceList) {
      return data.payload.DeviceList;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  async findDevice (udid) {
    let devices = await this.listDevices();
    return _.find(devices, (device) => device.Properties.SerialNumber === udid);
  }

  async connectLockdown (udid) {
    let device = await this.findDevice(udid);
    if (!device) {
      throw new Error(`Could not find the expected device '${udid}'`);
    }
    let plistService = new PlistService(await this.connect(device.Properties.DeviceID, LOCKDOWN_PORT));
    return new Lockdown(plistService);
  }

  async connect (deviceID, port, timeout = 5000) {
    this.sendPlist({
      payload: {
        MessageType: 'Connect',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING,
        DeviceID: deviceID,
        PortNumber: swap16(port)
      }
    });

    const data = await this.receivePlist(timeout);
    if (data.payload.MessageType === 'Result' && data.payload.Number === 0) {
      this._socketClient.unpipe(this._splitter);
      this._splitter.unpipe(this._decoder);

      return this._socketClient;
    } else {
      throw new Error(`Unexpected data: ${JSON.stringify(data)}`);
    }
  }

  close () {
    this._socketClient.destroy();
  }
}

export { Usbmux };
export default Usbmux;
