import { default as Usbmux } from './lib/usbmux/usbmux';
import { getConnectedDevices, getOSVersion, startLockdownSession, startSyslogService, connectPort } from './lib/utilities';


export { Usbmux, getConnectedDevices, getOSVersion, startLockdownSession, startSyslogService, connectPort };
export default Usbmux;
