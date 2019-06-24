import { utilities } from '..';
import chai from 'chai';
import { getServerWithFixtures, fixtures, UDID } from './fixtures';


chai.should();

describe('utilities', function () {
  let server;
  let socket;

  afterEach(function () {
    if (server) {
      server.close();
    }
  });

  it('should get unique udids', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST));
    const udids = await utilities.getConnectedDevices(socket);
    udids.length.should.be.equal(1);
    udids[0].should.eql(UDID);
  });

  it('should get product version', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.DEVICE_CONNECT, fixtures.LOCKDOWN_GET_VALUE_OS_VERSION));
    const osVersion = await utilities.getOSVersion(UDID, socket);
    osVersion.should.be.equal('12.3.1');
  });
});
