import { default as Usbmux } from './lib/usbmux';
import { getConnectedDevices, getOSVersion, startLockdownSession,
         startSyslogService, startWebInspectorService, connectPort } from './lib/utilities';


export { Usbmux, getConnectedDevices, getOSVersion, startLockdownSession,
  startSyslogService, startWebInspectorService, connectPort };
export default Usbmux;
