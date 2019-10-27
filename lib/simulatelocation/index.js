import { BaseServiceSocket } from '../base-service';


const SIMULATE_LOCATION_SERVICE_NAME = 'com.apple.dt.simulatelocation';

const RESET_MESSAGE = Buffer.from([0, 0, 0, 1]);
const SET_LOCATION_MESSAGE = Buffer.from([0, 0, 0, 0]);

class SimulateLocationService extends BaseServiceSocket {
  /**
   * Reset the mock location to the phones original settings
   */
  resetLocation () {
    this._socketClient.write(RESET_MESSAGE);
  }

  /**
   * Set the mock location on the device
   * @param {string|number} lat The latitude that wants to be set on the device
   * @param {string|number} long The longitude that wants to be set on the device
   */
  setLocation (lat, long) {
    lat = `${lat}`;
    long = `${long}`;

    const lat_length = Buffer.alloc(4);
    lat_length.writeInt32BE(lat.length);

    const long_length = Buffer.alloc(4);
    long_length.writeInt32BE(long.length);

    this._socketClient.write(SET_LOCATION_MESSAGE);

    this._socketClient.write(lat_length);
    this._socketClient.write(lat);

    this._socketClient.write(long_length);
    this._socketClient.write(long);
  }
}

export { SimulateLocationService, SIMULATE_LOCATION_SERVICE_NAME };
export default SimulateLocationService;
