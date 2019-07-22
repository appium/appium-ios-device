/* eslint-disable promise/prefer-await-to-callbacks */
import stream from 'stream';
import _ from 'lodash';

class AfcReadableFileStream extends stream.Readable {

  constructor (fileHandle, afcService, options) {
    super(options);

    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._destroyed = false;
  }

  async _read (size) {
    const data = await this._afcService.readFile(this._fileHandle, size);

    if (this._destroyed) {
      return;
    }

    if (_.isEmpty(data)) {
      await this._destroy();
      return;
    }

    this.push(data);
  }

  async _destroy () {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    await this._afcService.closeFileHandle(this._fileHandle);
    this.push(null);
  }
}

class AfcWritableFileStream extends stream.Writable {

  constructor (fileHandle, afcService, options) {
    super(options);
    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._destroyed = false;
  }

  async _write (chunk, encoding, callback) {
    await this._afcService.writeFile(this._fileHandle, chunk);
    callback();
  }

  async _destroy () {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    await this._afcService.closeFileHandle(this._fileHandle);
    this.emit('close');
  }
}

export { AfcReadableFileStream, AfcWritableFileStream };