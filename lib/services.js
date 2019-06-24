import { connectPort, connectPortSSL, startLockdownSession } from './utilities';
import { SyslogService, SYSLOG_SERVICE_NAME } from './syslog';
import { WebInspectorService, WEB_INSPECTOR_SERVICE_NAME } from './webinspector';
import { InstallationProxyService, INSTALLATION_PROXY_SERVICE_NAME } from './installation-proxy';
import PlistService from './plist-service';

async function startSyslogService (udid, socket) {
  return new SyslogService(await startService(udid, SYSLOG_SERVICE_NAME, socket));
}

async function startWebInspectorService (udid, socket) {
  return new WebInspectorService(await startService(udid, WEB_INSPECTOR_SERVICE_NAME, socket));
}

async function startInstallationProxyService (udid, socket) {
  return new InstallationProxyService(new PlistService(await startService(udid, INSTALLATION_PROXY_SERVICE_NAME, socket)));
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

export { startSyslogService, startWebInspectorService, startInstallationProxyService };
