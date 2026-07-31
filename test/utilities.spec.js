import assert from 'node:assert/strict';
import {describe, it, afterEach} from 'node:test';

import * as utilities from '../lib/utilities';
import {getServerWithFixtures, fixtures, UDID} from './fixtures';

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
    assert.strictEqual(udids.length, 1);
    assert.deepStrictEqual(udids[0], UDID);
  });

  it('should get product version', async function () {
    ({server, socket} = await getServerWithFixtures(
      fixtures.DEVICE_LIST,
      fixtures.DEVICE_CONNECT,
      fixtures.LOCKDOWN_GET_VALUE_OS_VERSION,
    ));
    const osVersion = await utilities.getOSVersion(UDID, socket);
    assert.strictEqual(osVersion, '12.3.1');
  });
});
