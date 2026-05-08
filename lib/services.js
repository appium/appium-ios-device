import {connectPort, connectPortSSL, startLockdownSession, getOSVersion} from './utilities';
import {SyslogService, SYSLOG_SERVICE_NAME} from './syslog';
import {SimulateLocationService, SIMULATE_LOCATION_SERVICE_NAME} from './simulatelocation';
import {WebInspectorService, WEB_INSPECTOR_SERVICE_NAME} from './webinspector';
import {InstallationProxyService, INSTALLATION_PROXY_SERVICE_NAME} from './installation-proxy';
import {AfcService, AFC_SERVICE_NAME} from './afc';
import {NotificationProxyService, NOTIFICATION_PROXY_SERVICE_NAME} from './notification-proxy';
import {HouseArrestService, HOUSE_ARREST_SERVICE_NAME} from './house-arrest';
import {
  InstrumentService,
  INSTRUMENT_SERVICE_NAME_VERSION_14,
  INSTRUMENT_SERVICE_NAME,
} from './instrument';
import {
  TestmanagerdService,
  TESTMANAGERD_SERVICE_NAME_VERSION_14,
  TESTMANAGERD_SERVICE_NAME,
} from './testmanagerd';
import {MCInstallProxyService, MC_INSTALL_SERVICE_NAME} from './mcinstall';
import {ImageMounter, MOBILE_IMAGE_MOUNTER_SERVICE_NAME} from './imagemounter';
import {PlistService} from './plist-service';
import * as semver from 'semver';

const CRASH_LOG_SERVICE_NAME = 'com.apple.crashreportcopymobile';
const INSTRUMENT_HANDSHAKE_VERSION = 14;
const TESTMANAGERD_HANDSHAKE_VERSION = 14;

/**
 * Starts the syslog service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<SyslogService>}
 */
export async function startSyslogService(udid, opts = {}) {
  const socket = await startService(udid, SYSLOG_SERVICE_NAME, opts.socket);
  return new SyslogService(socket);
}

/**
 * Starts the simulate-location service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<SimulateLocationService>}
 */
export async function startSimulateLocationService(udid, opts = {}) {
  const socket = await startService(udid, SIMULATE_LOCATION_SERVICE_NAME, opts.socket);
  return new SimulateLocationService(socket);
}

/**
 * Starts the web inspector service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<WebInspectorService>}
 */
export async function startWebInspectorService(udid, opts = {}) {
  const osVersion = opts.osVersion || (await getOSVersion(udid, opts.socket));
  const isSimulator = !!opts.isSimulator;
  const verbose = !!opts.verbose;
  const verboseHexDump = !!opts.verboseHexDump;
  const socketChunkSize = opts.socketChunkSize;
  const maxFrameLength = opts.maxFrameLength;
  const semverVersion = semver.coerce(osVersion);
  if (!semverVersion) {
    throw new Error(`Could not create a semver version out of '${osVersion}'`);
  }
  if (opts.socket) {
    return new WebInspectorService({
      majorOsVersion: semverVersion.major,
      isSimulator,
      socketChunkSize,
      verbose,
      verboseHexDump,
      socketClient: opts.socket,
      maxFrameLength,
    });
  }
  const socket = await startService(udid, WEB_INSPECTOR_SERVICE_NAME, undefined);
  return new WebInspectorService({
    majorOsVersion: semverVersion.major,
    isSimulator,
    socketChunkSize,
    verbose,
    verboseHexDump,
    socketClient: socket,
    maxFrameLength,
  });
}

/**
 * Starts the installation proxy service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<InstallationProxyService>}
 */
export async function startInstallationProxyService(udid, opts = {}) {
  const socket = await startService(udid, INSTALLATION_PROXY_SERVICE_NAME, opts.socket);
  return new InstallationProxyService(new PlistService(socket));
}

/**
 * Starts the AFC service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<AfcService>}
 */
export async function startAfcService(udid, opts = {}) {
  const socket = await startService(udid, AFC_SERVICE_NAME, opts.socket);
  return new AfcService(socket);
}

/**
 * Starts the crash log service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<AfcService>}
 */
export async function startCrashLogService(udid, opts = {}) {
  const socket = await startService(udid, CRASH_LOG_SERVICE_NAME, opts.socket);
  return new AfcService(socket);
}

/**
 * Starts the notification proxy service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<NotificationProxyService>}
 */
export async function startNotificationProxyService(udid, opts = {}) {
  const socket = await startService(udid, NOTIFICATION_PROXY_SERVICE_NAME, opts.socket);
  return new NotificationProxyService(socket);
}

/**
 * Starts the house arrest service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<HouseArrestService>}
 */
export async function startHouseArrestService(udid, opts = {}) {
  const socket = await startService(udid, HOUSE_ARREST_SERVICE_NAME, opts.socket);
  return new HouseArrestService(socket);
}

/**
 * Starts the instrument service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<InstrumentService>}
 */
export async function startInstrumentService(udid, opts = {}) {
  const osVersion = opts.osVersion || (await getOSVersion(udid, opts.socket));
  return new InstrumentService(
    parseInt(osVersion.split('.')[0], 10) < INSTRUMENT_HANDSHAKE_VERSION
      ? await startService(udid, INSTRUMENT_SERVICE_NAME, opts.socket, true)
      : await startService(udid, INSTRUMENT_SERVICE_NAME_VERSION_14, opts.socket),
  );
}

/**
 * Starts the testmanagerd service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<TestmanagerdService>}
 */
export async function startTestmanagerdService(udid, opts = {}) {
  const osVersion = opts.osVersion || (await getOSVersion(udid, opts.socket));
  return new TestmanagerdService(
    parseInt(osVersion.split('.')[0], 10) < TESTMANAGERD_HANDSHAKE_VERSION
      ? await startService(udid, TESTMANAGERD_SERVICE_NAME, opts.socket, true)
      : await startService(udid, TESTMANAGERD_SERVICE_NAME_VERSION_14, opts.socket),
  );
}

/**
 * Starts the MCInstall proxy service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<MCInstallProxyService>}
 */
export async function startMCInstallService(udid, opts = {}) {
  const socket = await startService(udid, MC_INSTALL_SERVICE_NAME, opts.socket);
  return new MCInstallProxyService(new PlistService(socket));
}

/**
 * Starts the image mounter service.
 * @param {string} udid
 * @param {ServiceOpts=} opts
 * @returns {Promise<ImageMounter>}
 */
export async function startImageMounterService(udid, opts = {}) {
  const socket = await startService(udid, MOBILE_IMAGE_MOUNTER_SERVICE_NAME, opts.socket, false);
  return new ImageMounter(new PlistService(socket));
}

/**
 * @param {string} udid
 * @param {string} serviceName
 * @param {import('net').Socket=} socket
 * @param {boolean=} handshakeOnly
 * @returns {Promise<import('net').Socket>}
 */
async function startService(udid, serviceName, socket, handshakeOnly = false) {
  const lockdown = await startLockdownSession(udid, socket);
  try {
    const service = await lockdown.startService(serviceName);
    if (service.EnableServiceSSL) {
      return await connectPortSSL(udid, service.Port, socket, handshakeOnly);
    } else {
      return await connectPort(udid, service.Port, socket);
    }
  } finally {
    lockdown.close();
  }
}

/**
 * @typedef {Object} ServiceOpts
 * @property {import('net').Socket=} socket
 * @property {string=} osVersion
 * @property {boolean=} isSimulator
 * @property {boolean=} verbose
 * @property {boolean=} verboseHexDump
 * @property {number=} socketChunkSize
 * @property {number=} maxFrameLength
 */
