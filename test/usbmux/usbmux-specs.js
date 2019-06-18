import { Usbmux } from '../..';
import { fs } from 'appium-support';
import path from 'path';
import net from 'net';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.should();
chai.use(chaiAsPromised);
let deviceListFixture;
let deviceConnectFixture;

describe('usbmux', function () {
  before(async function () {
    const deviceListFile = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin');
    deviceListFixture = await fs.readFile(deviceListFile);
    const deviceConnectFile = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'usbmuxconnectmessage.bin');
    deviceConnectFixture = await fs.readFile(deviceConnectFile);
  });
  beforeEach(function () {
    this.server = net.createServer();
    this.server.listen();
    let socket = net.connect(this.server.address());
    this.usbmux = new Usbmux(socket);
  });
  afterEach(function () {
    this.usbmux.close();
    this.server.close();
  });

  it('should read usbmux message', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(deviceListFixture);
    });
    let devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
  });

  it('should read concatanated message', async function () {
    let doubleContent = Buffer.concat([deviceListFixture, deviceListFixture]);
    this.server.on('connection', function (socketClient) {
      socketClient.write(doubleContent);
    });
    let devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
    devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
  });

  it('should find correct device', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(deviceListFixture);
    });
    let udid = '63c3d055c4f83e960e5980fa68be0fbf7d4ba74c';
    let device = await this.usbmux.findDevice(udid);
    device.Properties.SerialNumber.should.be.equal(udid);
  });

  it('should connect to correct device', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(deviceConnectFixture);
    });
    let udid = '63c3d055c4f83e960e5980fa68be0fbf7d4ba74c';
    await this.usbmux.connectLockdown(udid);
  });
});
