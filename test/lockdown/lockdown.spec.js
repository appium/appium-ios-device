import {Lockdown} from '../../lib/lockdown';
import {PlistService} from '../../lib/plist-service';
import {getServerWithFixtures, fixtures} from '../fixtures';
import {describe, it, afterEach} from 'node:test';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('lockdown', function () {
  let server;
  let socket;
  let lockdown;

  afterEach(async function () {
    if (lockdown) {
      try {
        lockdown.close();
      } catch {}
      lockdown = null;
    }

    if (socket && !socket.destroyed) {
      socket.destroy();
    }
    socket = null;

    // Avoid races where the client connect attempt fails after teardown
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (server) {
      try {
        server.close();
      } catch {}
      server = null;
    }
  });

  it('should lockdown get value', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_GET_VALUE_OS_VERSION));
    lockdown = new Lockdown(new PlistService(socket));

    await lockdown.getValue({Key: 'ProductName'});
  });

  it('should fail due to timeout', async function () {
    ({server, socket} = await getServerWithFixtures());
    lockdown = new Lockdown(new PlistService(socket));
    await expect(lockdown.getValue({Key: 'ProductName'}, -1)).to.eventually.be.rejectedWith();
  });

  it('should get lockdown query type', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_QUERY_TYPE));
    lockdown = new Lockdown(new PlistService(socket));

    await lockdown.queryType();
  });

  it('should get device time', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.LOCKDOWN_GET_VALUE_TIME));
    lockdown = new Lockdown(new PlistService(socket));
    const epochValue = await lockdown.getValue({Key: 'TimeIntervalSince1970'});
    const date = new Date(0); // The 0 there is the key, which sets the date to the epoch
    date.setUTCSeconds(epochValue);
    expect(date.getUTCFullYear()).to.be.eq(2019);
  });
});
