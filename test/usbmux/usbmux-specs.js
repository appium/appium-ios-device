import fs from 'fs';
import path from 'path';
import net from 'net';
import Usbmux from '../../lib/usbmux/usbmux';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.should();
chai.use(chaiAsPromised);

describe('usbmux', function () {
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

  it('read usbmux message', async function () {
    let content = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin'));
    this.server.on('connection', function (socketClient) {
      socketClient.write(content);
    });
    let devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
  });

  it('read concatanated message', async function () {
    let content = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin'));
    let doubleContent = Buffer.concat([content, content]);
    this.server.on('connection', function (socketClient) {
      socketClient.write(doubleContent);
    });
    let devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
    devices = await this.usbmux.listDevices();
    devices.length.should.be.equal(1);
  });

  it('find correct device', async function () {
    let content = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin'));
    this.server.on('connection', function (socketClient) {
      socketClient.write(content);
    });
    let udid = '63c3d055c4f83e960e5980fa68be0fbf7d4ba74c';
    let device = await this.usbmux.findDevice(udid);
    device.Properties.SerialNumber.should.be.equal(udid);
  });
});