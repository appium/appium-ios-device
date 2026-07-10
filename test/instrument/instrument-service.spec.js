import {InstrumentService, INSTRUMENT_CHANNEL} from '../../lib/instrument';
import {getServerWithFixtures, fixtures} from '../fixtures';
import {describe, it, afterEach} from 'node:test';
import {expect} from 'chai';

describe('instrument', function () {
  let server;
  let socket;
  let instrumentService;
  const pid = 6385;

  afterEach(function () {
    if (instrumentService) {
      instrumentService.close();
    }
    if (server) {
      server.close();
    }
  });

  it('should ios device launch app and return pid', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.INSTRUMENTS_LAUNCH_APP));
    const bundleID = 'com.apple.mobilesafari';
    instrumentService = new InstrumentService(socket);
    const data = await instrumentService.callChannel(
      INSTRUMENT_CHANNEL.PROCESS_CONTROL,
      'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:',
      '',
      bundleID,
      {},
      [],
      {StartSuspendedKey: 0, KillExisting: 1},
    );
    expect(data.selector).to.equal(pid);
  });

  it('should ios device kill app ', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.INSTRUMENTS_LAUNCH_APP));
    instrumentService = new InstrumentService(socket);
    await instrumentService.callChannel(
      INSTRUMENT_CHANNEL.PROCESS_CONTROL,
      'killPid:',
      pid.toString(),
    );
  });

  it('should ios device get fps', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.INSTRUMENTS_FPS));
    function message(res) {
      if (res.selector.CoreAnimationFramesPerSecond !== undefined) {
        data.push(res.selector.CoreAnimationFramesPerSecond);
      }
    }
    instrumentService = new InstrumentService(socket, message);
    const data = [];
    await instrumentService.callChannel(
      INSTRUMENT_CHANNEL.GRAPHICS_OPENGL,
      'startSamplingAtTimeInterval:',
      0,
    );
    await new Promise((resolve) => {
      setTimeout(() => {
        resolve(data);
      }, 2000);
    });
    expect(data).to.deep.equal([0, 51, 59, 60]);
  });
});
