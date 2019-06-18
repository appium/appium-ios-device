import net from 'net';
import _ from 'lodash';
import B from 'bluebird';
import { parse } from '../util/plist.js';
import LengthBasedSplitter from '../util/trasformer/length-based-splitter';
import UsbmuxDecoder from './transformer/usbmux-decoder.js';
import UsbmuxEncoder from './transformer/usbmux-encoder.js';

const DEFAULT_USBMUXD_SOCKET = '/var/run/usbmuxd';
const PROG_NAME = 'appium-ios-device';
const CLIENT_VERSION_STRING = 'appium-ios-device';

function swap16 (val) {
  return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

class Usbmux {

  constructor (socketClient = net.createConnection(DEFAULT_USBMUXD_SOCKET)) {
    this._socketClient = socketClient;

    this._decoder = new UsbmuxDecoder();
    this._splitter = new LengthBasedSplitter(true, 1000000, 0, 4);
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new UsbmuxEncoder();
    this._encoder.pipe(this._socketClient);
  }

  async readBUID () {
    this._encoder.write({
      payload: {
        MessageType: 'ReadBUID',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    this._splitter.resume();
    return await new B((resolve, reject) => {
      this._decoder.once('data', (data) => {
        if (data.payload.BUID) {
          resolve(data.payload.BUID);
        } else {
          reject(new Error(data));
        }
      });
    });
  }

  async readPairRecord (udid) {
    this._encoder.write({
      payload: {
        MessageType: 'ReadPairRecord',
        PairRecordID: udid,
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    this._splitter.resume();
    return await new B((resolve, reject) => {
      this._decoder.once('data', (data) => {
        if (data.payload.PairRecordData) {
          try {
            resolve(parse(data.payload.PairRecordData));
          } catch (err) {
            reject(new Error(data));
          }
        } else {
          resolve(null);
        }
      });
    });
  }

  async listDevices () {
    this._encoder.write({
      payload: {
        MessageType: 'ListDevices',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING
      }
    });

    this._splitter.resume();
    return await new B((resolve, reject) => {
      this._decoder.once('data', (data) => {
        if (data.payload.DeviceList) {
          resolve(data.payload.DeviceList);
        } else {
          reject(new Error(data));
        }
      });
    });
  }

  async findDevice (udid) {
    let devices = await this.listDevices();
    return _.find(devices, (device) => device.Properties.SerialNumber === udid);
  }

  async connect (deviceID, port) {
    this._encoder.write({
      payload: {
        MessageType: 'Connect',
        ProgName: PROG_NAME,
        ClientVersionString: CLIENT_VERSION_STRING,
        DeviceID: deviceID,
        PortNumber: swap16(port)
      }
    });

    this._splitter.resume();
    return await new B((resolve, reject) => {
      this._decoder.once('data', (data) => {
        if (data.payload.MessageType === 'Result' && data.payload.Number === 0) {
          this._socketClient.unpipe(this._splitter);
          this._socketClient.unpipe(this._decoder);

          resolve(this._socketClient);
        } else {
          reject(new Error(data));
        }
      });
    });
  }

  close () {
    this._socketClient.destroy();
  }
}

export { Usbmux };
export default Usbmux;