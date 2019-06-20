import { Lockdown } from '../../lib/lockdown/lockdown';
import { PlistService } from '../../lib/plist-service/plist-service';
import { getServerWithFixtures, fixtures } from '../fixtures';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';


chai.should();
chai.use(chaiAsPromised);

describe('lockdown', function () {
  let server;
  let socket;

  afterEach(function () {
    try {
      server.close();
    } catch (ign) {}
  });

  it('lockdown get value', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_GET_VALUE_OS_VERSION));
    const lockdown = new Lockdown(new PlistService(socket));

    await lockdown.getValue({ Key: 'ProductName'});
  });

  it('should fail due to timeout', async function () {
    ({server, socket} = await getServerWithFixtures());
    const lockdown = new Lockdown(new PlistService(socket));
    await lockdown.getValue({ Key: 'ProductName'}, -1).should.eventually.be.rejected;
  });

  it('lockdown query type', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_QUERY_TYPE));
    const lockdown = new Lockdown(new PlistService(socket));

    await lockdown.queryType();
  });
});
