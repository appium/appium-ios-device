import { getConnectedDevices } from '..';
import { fs } from 'appium-support';
import path from 'path';
import net from 'net';
import chai from 'chai';


chai.should();
let deviceListFixture;


describe('usbmux', function () {


  before(async function () {
    const deviceListFile = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin');
    deviceListFixture = await fs.readFile(deviceListFile);
  });
  beforeEach(function () {
    this.server = net.createServer();
    this.server.listen();
    this.socket = net.connect(this.server.address());
  });
  afterEach(function () {
    this.server.close();
    this.socket.destroy();
  });

  it('should get unique udids', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(deviceListFixture);
    });
    const udids = await getConnectedDevices(this.socket);
    udids.length.should.be.equal(1);
  });
});
