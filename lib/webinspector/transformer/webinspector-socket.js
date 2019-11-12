/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import _ from 'lodash';


const CHUNK_SIZE = 5000; // bytes

class WebInspectorSocket extends Stream.Transform {
  constructor (socketClient, opts = {}) {
    super({ objectMode: true });

    this._socketClient = socketClient;
    this._socketClient.setNoDelay(true);
    this._socketClient.setKeepAlive(true);

    this._socketChunkSize = opts.socketChunkSize || CHUNK_SIZE;
  }

  /**
   * Send data to the socket client, making sure the socket is flushed after
   * each call
   *
   * @param {string|buffer|object} data - the data to send over the socket
   * @param {string} encoding - the type of data being sent
   */
  _socketSend (data, encoding) {
    this._socketClient.cork();
    try {
      this._socketClient.write(data, encoding);
    } finally {
      this._socketClient.uncork();
    }
  }

  _transform (data, encoding, callback) {
    if (_.isBuffer(data) || _.isString(data)) {
      let start = 0, end = this._socketChunkSize;
      while (start < data.length) {
        const chunkBuffer = data.slice(start, end);
        start = end;
        end += this._socketChunkSize;
        this._socketSend(chunkBuffer, encoding);
      }
    } else {
      this._socketSend(data, encoding);
    }

    this.push(data, encoding);
    callback();
  }
}

export { WebInspectorSocket };
export default WebInspectorSocket;
