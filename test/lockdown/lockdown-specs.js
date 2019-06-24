import { Lockdown } from '../../lib/lockdown';
import { PlistService } from '../../lib/plist-service';
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

  it('should lockdown get value', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_GET_VALUE_OS_VERSION));
    const lockdown = new Lockdown(new PlistService(socket));

    await lockdown.getValue({ Key: 'ProductName'});
  });

  it('should fail due to timeout', async function () {
    ({server, socket} = await getServerWithFixtures());
    const lockdown = new Lockdown(new PlistService(socket));
    await lockdown.getValue({ Key: 'ProductName'}, -1).should.eventually.be.rejected;
  });

  it('should get lockdown query type', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_QUERY_TYPE));
    const lockdown = new Lockdown(new PlistService(socket));

    await lockdown.queryType();
  });

  it('should get device time', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_GET_VALUE_TIME));
    const lockdown = new Lockdown(new PlistService(socket));
    const epochValue = await lockdown.getValue({ Key: 'TimeIntervalSince1970' });
    const date = new Date(0); // The 0 there is the key, which sets the date to the epoch
    date.setUTCSeconds(epochValue);
    date.getUTCFullYear().should.be.eq(2019);
  });
});
