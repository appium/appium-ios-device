/* eslint-disable promise/prefer-await-to-callbacks */
import stream from 'stream';
import _ from 'lodash';

class AfcReadableFileStream extends stream.Readable {

  constructor (fileHandle, afcService, options) {
    super(options);
    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._autoDestroy = !!options.autoDestroy;
    this._destroyed = false;
  }

  async _read (size) {
    try {
      const data = await this._afcService.readFile(this._fileHandle, size);

      if (this._destroyed) {
        return;
      }

      if (_.isEmpty(data)) {
        return this.push(null);
      }

      this.push(data);
    } catch (e) {
      if (this._autoDestroy) {
        this.destroy(e);
      } else {
        this.emit('error', e);
      }
    }
  }

  async _destroy (err, cb) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.push(null);
    try {
      await this._afcService.closeFileHandle(this._fileHandle);
    } catch (e) {
      err = err || e;
    }
    cb(err);
  }
}

class AfcWritableFileStream extends stream.Writable {

  constructor (fileHandle, afcService, options) {
    super(options);
    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._autoDestroy = !!options.autoDestroy;
    this._destroyed = false;
  }

  async _write (chunk, encoding, cb) {
    try {
      await this._afcService.writeFile(this._fileHandle, chunk);
      cb();
    } catch (e) {
      if (this._autoDestroy) {
        this.destroy(e);
      }
      cb(e);
    }
  }

  async _destroy (err, cb) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    try {
      await this._afcService.closeFileHandle(this._fileHandle);
    } catch (e) {
      err = err || e;
    }
    cb(err);
  }
}

export { AfcReadableFileStream, AfcWritableFileStream };