import { Lockdown } from '../../lib/lockdown/lockdown';
import { PlistService } from '../../lib/plist-service/plist-service';
import { fs } from 'appium-support';
import path from 'path';
import net from 'net';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';


chai.should();
chai.use(chaiAsPromised);
let getValueFixture;
let queryTypeFixture;

describe('lockdown', function () {
  before(async function () {
    const getValueFile = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'lockdowngetvaluemessage.bin');
    getValueFixture = await fs.readFile(getValueFile);
    const queryTypeFile = path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', 'lockdownquerytypemessage.bin');
    queryTypeFixture = await fs.readFile(queryTypeFile);
  });
  beforeEach(function () {
    this.server = net.createServer();
    this.server.listen();
    let socket = net.connect(this.server.address());
    this.lockdown = new Lockdown(new PlistService(socket));
  });
  afterEach(function () {
    this.lockdown.close();
    this.server.close();
  });

  it('lockdown get value', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(getValueFixture);
    });
    await this.lockdown.getValue({ Key: 'ProductName'});
  });

  it('lockdown query type', async function () {
    this.server.on('connection', function (socketClient) {
      socketClient.write(queryTypeFixture);
    });
    await this.lockdown.queryType();
  });
});