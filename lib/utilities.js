import Usbmux from './usbmux/usbmux';
import _ from 'lodash';


async function getConnectedDevices (socket) {
  const usbmux = new Usbmux(socket);
  const devices = await usbmux.listDevices();
  usbmux.close();
  const udids = devices.map((device) => device.Properties.SerialNumber);
  return _.uniq(udids);
}

export { getConnectedDevices };
