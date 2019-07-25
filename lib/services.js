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
  return new SyslogService(await startService(udid, SYSLOG_SERVICE_NAME, opts.socket));
}

async function startSimulateLocationService (udid, opts = {}) {
  return new SimulateLocationService(await startService(udid, SIMULATE_LOCATION_SERVICE_NAME, opts.socket));
}

async function startWebInspectorService (udid, opts = {}) {
  const osVersion = opts.osVersion || await getOSVersion(udid, opts.socket);
  const semverVersion = semver.coerce(osVersion);
  if (!semverVersion) {
    throw new Error(`Could not create a semver version out of '${osVersion}'`);
  }
  const socketClient = opts.socket || await startService(udid, WEB_INSPECTOR_SERVICE_NAME);
  return new WebInspectorService(semverVersion.major, socketClient);
}

async function startInstallationProxyService (udid, opts = {}) {
  return new InstallationProxyService(new PlistService(await startService(udid, INSTALLATION_PROXY_SERVICE_NAME, opts.socket)));
}

async function startAfcService (udid, opts = {}) {
  return new AfcService(await startService(udid, AFC_SERVICE_NAME, opts.socket));
}

async function startNotificationProxyService (udid, opts = {}) {
  return new NotificationProxyService(await startService(udid, NOTIFICATION_PROXY_SERVICE_NAME, opts.socket));
}

async function startHouseArrestService (udid, opts = {}) {
  return new HouseArrestService(await startService(udid, HOUSE_ARREST_SERVICE_NAME, opts.socket));
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
