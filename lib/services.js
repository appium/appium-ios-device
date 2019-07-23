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

async function startSyslogService (udid, socket) {
  return new SyslogService(await startService(udid, SYSLOG_SERVICE_NAME, socket));
}

async function startSimulateLocationService (udid, socket) {
  return new SimulateLocationService(await startService(udid, SIMULATE_LOCATION_SERVICE_NAME, socket));
}

async function startWebInspectorService (udid, socket) {
  const osVersion = await getOSVersion(udid, socket);
  const semverVersion = semver.coerce(osVersion);
  if (!semverVersion) {
    throw new Error(`Couldn't create a semver version out of ${osVersion}`);
  }
  return new WebInspectorService(semverVersion.major, await startService(udid, WEB_INSPECTOR_SERVICE_NAME, socket));
}

async function startInstallationProxyService (udid, socket) {
  return new InstallationProxyService(new PlistService(await startService(udid, INSTALLATION_PROXY_SERVICE_NAME, socket)));
}

async function startAfcService (udid, socket) {
  return new AfcService(await startService(udid, AFC_SERVICE_NAME, socket));
}

async function startNotificationProxyService (udid, socket) {
  return new NotificationProxyService(await startService(udid, NOTIFICATION_PROXY_SERVICE_NAME, socket));
}

async function startHouseArrestService (udid, socket) {
  return new HouseArrestService(await startService(udid, HOUSE_ARREST_SERVICE_NAME, socket));
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
