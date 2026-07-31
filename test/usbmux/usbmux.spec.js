import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {describe, it, afterEach} from 'node:test';

import {plist} from '@appium/support';

import {Usbmux} from '../../lib/usbmux';
import {getServerWithFixtures, fixtures, UDID} from '../fixtures';

describe('usbmux', function () {
  let usbmux;
  let server;
  let socket;

  afterEach(async function () {
    if (usbmux) {
      try {
        usbmux.close();
      } catch {}
      usbmux = null;
    }

    // Add a small delay to avoid connection reset errors
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (server) {
      try {
        server.close();
      } catch {}
      server = null;
    }

    socket = null;
  });

  it('should read usbmux message', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST));
    usbmux = new Usbmux(socket);

    let devices = await usbmux.listDevices();
    assert.strictEqual(devices.length, 1);
  });

  it('should fail due to timeout', async function () {
    ({server, socket} = await getServerWithFixtures());
    usbmux = new Usbmux(socket);

    await assert.rejects(usbmux.listDevices(-1));
  });

  it.skip('should read concatenated message', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.DEVICE_LIST_2));
    usbmux = new Usbmux(socket);

    let devices = await usbmux.listDevices();
    assert.strictEqual(devices.length, 1);
    assert.strictEqual(devices[0].DeviceID, 1);

    devices = await usbmux.listDevices();
    assert.strictEqual(devices.length, 1);
    assert.strictEqual(devices[0].DeviceID, 2);
  });

  it('should find correct device', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST));
    usbmux = new Usbmux(socket);

    let device = await usbmux.findDevice(UDID);
    assert.strictEqual(device.Properties.SerialNumber, UDID);
  });

  it('should connect to correct device', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.DEVICE_CONNECT));
    usbmux = new Usbmux(socket);

    await usbmux.connectLockdown(UDID);
  });

  it('should switch decoders correctly', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.DEVICE_LIST, fixtures.USBMUX_TO_LOCKDOWN));
    usbmux = new Usbmux(socket);

    const lockdown = await usbmux.connectLockdown(UDID);
    await lockdown.getValue({Key: 'TimeIntervalSince1970'});
  });

  it('should parse pair record data returned by @appium/support', async function () {
    usbmux = new Usbmux(new PassThrough());
    const pairRecord = {HostID: 'host-id', SystemBUID: 'system-buid'};
    const pairRecordDataBase64 = plist.createBinaryPlist(pairRecord).toString('base64');
    const parsedBySupport = plist.parsePlist(
      `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
      <plist version="1.0">
        <dict>
          <key>PairRecordData</key>
          <data>${pairRecordDataBase64}</data>
        </dict>
      </plist>`,
    );
    const pairRecordData = /** @type {{PairRecordData: string}} */ (parsedBySupport).PairRecordData;
    usbmux._receivePlistPromise = (_, responseCallback) => ({
      tag: 0,
      receivePromise: (async () => {
        const data = {
          payload: {
            PairRecordData: pairRecordData,
          },
        };
        return responseCallback(data);
      })(),
    });
    usbmux._sendPlist = () => {};

    const result = await usbmux.readPairRecord(UDID);
    assert.deepStrictEqual(result, pairRecord);
  });
});
