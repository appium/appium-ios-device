import {utilities} from '..';
import {getServerWithFixtures, fixtures, UDID} from './fixtures';
import {describe, it, afterEach} from 'node:test';
import {expect} from 'chai';

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
    expect(udids.length).to.be.equal(1);
    expect(udids[0]).to.eql(UDID);
  });

  it('should get product version', async function () {
    ({server, socket} = await getServerWithFixtures(
      fixtures.DEVICE_LIST,
      fixtures.DEVICE_CONNECT,
      fixtures.LOCKDOWN_GET_VALUE_OS_VERSION,
    ));
    const osVersion = await utilities.getOSVersion(UDID, socket);
    expect(osVersion).to.be.equal('12.3.1');
  });
});
