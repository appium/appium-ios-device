import { connectPort, connectPortSSL, startLockdownSession, getOSVersion } from './utilities';
import { SyslogService, SYSLOG_SERVICE_NAME } from './syslog';
import { SimulateLocationService, SIMULATE_LOCATION_SERVICE_NAME } from './simulatelocation';
import { WebInspectorService, WEB_INSPECTOR_SERVICE_NAME } from './webinspector';
import { InstallationProxyService, INSTALLATION_PROXY_SERVICE_NAME } from './installation-proxy';
import { AfcService, AFC_SERVICE_NAME } from './afc';
import { NotificationProxyService, NOTIFICATION_PROXY_SERVICE_NAME } from './notification-proxy';
import { HouseArrestService, HOUSE_ARREST_SERVICE_NAME } from './house-arrest';
import PlistService from './plist-service';
import semver from 'semver';


async function startSyslogService (udid, opts = {}) {
  const socket = await startService(udid, SYSLOG_SERVICE_NAME, opts.socket);
  return new SyslogService(socket);
}

async function startSimulateLocationService (udid, opts = {}) {
  const socket = await startService(udid, SIMULATE_LOCATION_SERVICE_NAME, opts.socket);
  return new SimulateLocationService(socket);
}

async function startWebInspectorService (udid, opts = {}) {
  const osVersion = opts.osVersion || await getOSVersion(udid, opts.socket);
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

async function startInstallationProxyService (udid, opts = {}) {
  const socket = await startService(udid, INSTALLATION_PROXY_SERVICE_NAME, opts.socket);
  return new InstallationProxyService(new PlistService(socket));
}

async function startAfcService (udid, opts = {}) {
  const socket = await startService(udid, AFC_SERVICE_NAME, opts.socket);
  return new AfcService(socket);
}

async function startNotificationProxyService (udid, opts = {}) {
  const socket = await startService(udid, NOTIFICATION_PROXY_SERVICE_NAME, opts.socket);
  return new NotificationProxyService(socket);
}

async function startHouseArrestService (udid, opts = {}) {
  const socket = await startService(udid, HOUSE_ARREST_SERVICE_NAME, opts.socket);
  return new HouseArrestService(socket);
}

async function startService (udid, serviceName, socket) {
  const lockdown = await startLockdownSession(udid, socket);
  try {
    const service = await lockdown.startService(serviceName);
    if (service.EnableServiceSSL) {
      return await connectPortSSL(udid, service.Port, socket);
    } else {
      return await connectPort(udid, service.Port, socket);
    }
  } finally {
    lockdown.close();
  }
}

export {
  startSyslogService, startWebInspectorService,
  startInstallationProxyService, startSimulateLocationService,
  startAfcService, startNotificationProxyService,
  startHouseArrestService
};
