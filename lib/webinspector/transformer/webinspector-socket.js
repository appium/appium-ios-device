/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import _ from 'lodash';


const CHUNK_SIZE = 5000;

class WebInspectorSocket extends Stream.Transform {
  constructor (socketClient, opts = {}) {
    super({ objectMode: true });

    this._socketClient = socketClient;
    this._socketClient.setNoDelay(true);
    this._socketClient.setKeepAlive(true);

    this._socketChunkSize = opts.socketChunkSize || CHUNK_SIZE;
  }

  _transform (data, encoding, callback) {
    this._socketClient.cork();
    if (_.isBuffer(data) || _.isString(data)) {
      let start = 0, end = this._socketChunkSize;
      while (start < data.length) {
        const chunkBuffer = data.slice(start, end);
        start = end;
        end = end + this._socketChunkSize;
        this._socketClient.write(chunkBuffer, encoding);
      }
    } else {
      this._socketClient.write(data, encoding);
    }
    this._socketClient.uncork();

    this.push(data, encoding);
    callback();
  }
}

export { WebInspectorSocket };
export default WebInspectorSocket;
