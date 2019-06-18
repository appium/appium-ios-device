import Usbmux from './usbmux/usbmux';
import _ from 'lodash';


async function getConnectedDevices (socket) {
  const usbmux = new Usbmux(socket);
  try {
    const devices = await usbmux.listDevices();
    const udids = devices.map((device) => device.Properties.SerialNumber);
    return _.uniq(udids);
  } finally {
    usbmux.close();
  }
}

export { getConnectedDevices };
