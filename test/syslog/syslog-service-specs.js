import { fs } from 'appium-support';
import path from 'path';
import net from 'net';
import B from 'bluebird';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import SyslogService from '../../lib/syslog/syslog-service';


chai.should();
chai.use(chaiAsPromised);

let syslogFixtures;

describe('syslog', function () {
  before(async function () {
    const syslogMessages = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'syslogmessages.bin');
    syslogFixtures = await fs.readFile(syslogMessages);
  });
  beforeEach(function () {
    this.server = net.createServer();
    this.server.listen();
    let socket = net.connect(this.server.address());
    this.syslogService = new SyslogService(socket);
  });
  afterEach(function () {
    this.syslogService.close();
    this.server.close();
  });

  it('should wait for first syslog message', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(syslogFixtures);
    });
    await new B((resolve) => {
      this.syslogService.start((log) => {
        resolve(log);
      });
    });
  });
});