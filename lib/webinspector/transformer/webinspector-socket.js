/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import _ from 'lodash';


const CHUNK_SIZE = 1000;

class WebInspectorSocket extends Stream.Transform {
  constructor (socketClient, opts = {}) {
    super({ objectMode: true });

    this._socketClient = socketClient;

    this._socketClient.setNoDelay(true);
    this._socketClient.setKeepAlive(true);

    this.isSimulator = !!opts.isSimulator;
  }

  _transform (data, encoding, callback) {
    if (!this.isSimulator && (_.isBuffer(data) || _.isString(data))) {
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
