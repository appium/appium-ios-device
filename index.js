import { default as Usbmux } from './lib/usbmux';
import { getConnectedDevices, getOSVersion, getDeviceTime, startLockdownSession,
         startSyslogService, startWebInspectorService, connectPort } from './lib/utilities';


export { Usbmux, getConnectedDevices, getOSVersion, getDeviceTime, startLockdownSession,
  startSyslogService, startWebInspectorService, connectPort };
export default Usbmux;
