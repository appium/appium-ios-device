import { Usbmux } from '../..';
import chai from 'chai';
import { getServerWithFixtures, fixtures, UDID } from '../fixtures';


chai.should();

describe('usbmux', function () {
  let usbmux;
  let server;
  let socket;

  afterEach(function () {
    try {
      usbmux.close();
    } catch (ign) {}
    try {
      server.close();
    } catch (ign) {}
  });

  it('should read usbmux message', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST));
    usbmux = new Usbmux(socket);

    let devices = await usbmux.listDevices();
    devices.length.should.be.equal(1);
  });

  it('should fail due to timeout', async function () {
    ({server, socket} = await getServerWithFixtures());
    usbmux = new Usbmux(socket);

    await usbmux.listDevices(-1).should.eventually.be.rejected;
  });

  it('should read concatanated message', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.DEVICE_LIST_2));
    usbmux = new Usbmux(socket);

    let devices = await usbmux.listDevices();
    devices.length.should.be.equal(1);
    devices[0].DeviceID.should.be.equal(1);

    devices = await usbmux.listDevices();
    devices.length.should.be.equal(1);
    devices[0].DeviceID.should.be.equal(2);
  });

  it('should find correct device', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST));
    usbmux = new Usbmux(socket);

    let device = await usbmux.findDevice(UDID);
    device.Properties.SerialNumber.should.be.equal(UDID);
  });

  it('should connect to correct device', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.DEVICE_CONNECT));
    usbmux = new Usbmux(socket);

    await usbmux.connectLockdown(UDID);
  });
});
