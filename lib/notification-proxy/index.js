import PlistServiceEncoder from '../plist-service/transformer/plist-service-encoder';
import PlistServiceDecoder from '../plist-service/transformer/plist-service-decoder';
import LengthBasedSplitter from '../util/transformer/length-based-splitter';
import { KB } from '../constants';
import _ from 'lodash';
import { BaseServiceSocket } from '../base-service';


const NOTIFICATION_PROXY_SERVICE_NAME = 'com.apple.mobile.notification_proxy';
const MAX_FRAME_SIZE = 16 * KB;

const RELAY_NOTIFICATION = 'RelayNotification';
const PROXY_DEATH = 'ProxyDeath';

class NotificationProxyService extends BaseServiceSocket {
  constructor (socketClient) {
    super(socketClient);

    this._decoder = new PlistServiceDecoder();
    this._splitter = new LengthBasedSplitter({
      readableStream: socketClient,
      littleEndian: false,
      maxFrameLength: MAX_FRAME_SIZE,
      lengthFieldOffset: 0,
      lengthFieldLength: 4,
      lengthAdjustment: 4,
    });
    this._socketClient.pipe(this._splitter).pipe(this._decoder);

    this._encoder = new PlistServiceEncoder();
    this._encoder.pipe(this._socketClient);
    this._assignClientFailureHandlers(this._encoder);

    this._listeners = {};
    this._decoder.on('data', this._handleData.bind(this));
  }

  _handleData (data) {
    switch (data.Command) {
      case RELAY_NOTIFICATION: {
        const listener = this._listeners[data.Name];
        if (!listener) {
          return;
        }
        if (_.isFunction(listener.notification)) {
          listener.notification();
        }
        break;
      }
      case PROXY_DEATH: {
        const listener = this._listeners[data.Name];
        if (!listener) {
          return;
        }
        if (_.isFunction(listener.proxyDeath)) {
          listener.proxyDeath();
        }
        delete this._listeners[data.Name];
        break;
      }
      default:
        throw new Error(`Unknown data type ${JSON.stringify(data)}`);
    }
  }

  /**
   * The api to listen to notifications that the phone broadcasts
   * @param {string} notification The name of the notification which is desired to be observed
   * @param {Object} listener The listener object which will be invoked when there is a notification or if the proxy is dead
   */
  observeNotification (notification, listener) {
    if (this._listeners[notification]) {
      throw new Error(`Notification listener for ${notification} already exists. Another one can't be added`);
    }
    this._listeners[notification] = listener;
    this._encoder.write({
      Command: 'ObserveNotification',
      Name: notification
    });
  }

  /**
   * The api to broadcast notifications to the phone. This allows the client to talk to the daemons or apps on the phone
   * @param {*} notification The name of the notification which is desired notified
   */
  postNotification (notification) {
    this._encoder.write({
      Command: 'PostNotification',
      Name: notification
    });
  }

  /**
   * The api to shutdown the proxy. Consequently, all the notifications that are observing will recieve the proxyDeath response
   */
  shutdown () {
    this._encoder.write({
      Command: 'Shutdown',
    });
  }

  close () {
    this.shutdown();
    super.close();
  }
}

export default NotificationProxyService;
export { NotificationProxyService, NOTIFICATION_PROXY_SERVICE_NAME };
