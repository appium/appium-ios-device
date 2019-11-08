/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import _ from 'lodash';


const CHUNK_SIZE = 1000;

class WebInspectorSocket extends Stream.Transform {
  constructor (socketClient) {
    super({ objectMode: true });

    this._socketClient = socketClient;

    this._socketClient.setNoDelay(true);
    this._socketClient.setKeepAlive(true);
  }

  _transform (data, encoding, callback) {
    if (_.isBuffer(data) || _.isString(data)) {
      let start = 0, end = CHUNK_SIZE;
      while (start < data.length) {
        const chunkBuffer = data.slice(start, end);
        start = end;
        end = end + 1000;
        this._socketClient.write(chunkBuffer, encoding);
      }
    } else {
      this._socketClient.write(data, encoding);
    }
    this.push(data, encoding);
    callback();
  }
}

export { WebInspectorSocket };
export default WebInspectorSocket;
