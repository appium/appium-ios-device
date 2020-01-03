/* eslint-disable promise/catch-or-return */
/* eslint-disable promise/prefer-await-to-then */
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

  _read (size) {
    this._afcService.readFile(this._fileHandle, size)
      .then((data) => {
        if (!this._destroyed) {
          this.push(_.isEmpty(data) ? null : data);
        }
      })
      .catch((e) => {
        if (this._autoDestroy) {
          this.destroy(e);
        } else {
          this.emit('error', e);
        }
      });
  }

  _destroy (err, cb) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.push(null);
    this._afcService.closeFileHandle(this._fileHandle)
      .catch((e) => {
        err = err || e;
      })
      .finally(() => cb(err));
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

  _write (chunk, encoding, cb) {
    this._afcService.writeFile(this._fileHandle, chunk)
      .then(() => cb())
      .catch((e) => {
        if (this._autoDestroy) {
          this.destroy(e);
        } else {
          cb(e);
        }
      });
  }

  _destroy (err, cb) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this._afcService.closeFileHandle(this._fileHandle)
      .catch((e) => {
        err = err || e;
      })
      .finally(() => cb(err));
  }
}

export { AfcReadableFileStream, AfcWritableFileStream };