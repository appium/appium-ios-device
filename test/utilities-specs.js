import { getConnectedDevices } from '..';
import { fs } from 'appium-support';
import path from 'path';
import net from 'net';
import chai from 'chai';


chai.should();



describe('usbmux', function () {
  let server;
  let socket;

  before(async function () {
    const file = path.resolve(__dirname, '..', '..', 'test', 'fixtures', 'usbmuxlistdevicemessage.bin');
    const deviceListFixture = await fs.readFile(file);

    server = net.createServer();
    server.listen();
    server.on('connection', function (socketClient) {
      socketClient.write(deviceListFixture);
    });

    socket = net.connect(server.address());
  });
  after(function () {
    server.close();
  });

  it('should get unique udids', async function () {
    const udids = await getConnectedDevices(socket);
    udids.length.should.be.equal(1);
  });
});
