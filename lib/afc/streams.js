/* eslint-disable promise/prefer-await-to-then */
import stream from 'stream';
import _ from 'lodash';
import log from '../logger';

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

  _destroy (err, done) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.push(null);
    this._afcService.closeFileHandle(this._fileHandle)
      .then(() => done(err))
      .catch((e) => {
        if (err) {
          log.debug(e);
        } else {
          err = e;
        }
        done(err);
      });
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

  _write (chunk, encoding, next) {
    this._afcService.writeFile(this._fileHandle, chunk)
      .then(() => next())
      .catch((e) => {
        if (this._autoDestroy) {
          this.destroy(e);
        }
        next(e);
      });
  }

  _destroy (err, done) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this._afcService.closeFileHandle(this._fileHandle)
      .then(() => done(err))
      .catch((e) => {
        if (err) {
          log.debug(e);
        } else {
          err = e;
        }
        done(err);
      });
  }
}

export { AfcReadableFileStream, AfcWritableFileStream };
