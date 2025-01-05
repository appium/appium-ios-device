import stream from 'stream';
import _ from 'lodash';
import { log } from '../logger';

export class AfcReadableFileStream extends stream.Readable {

  constructor (fileHandle, afcService, options) {
    super(options);
    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._autoDestroy = !!options.autoDestroy;
    this._destroyed = false;
  }

  _read (size) {
    (async () => {
      try {
        const data = await this._afcService.readFile(this._fileHandle, size);
        if (!this._destroyed) {
          this.push(_.isEmpty(data) ? null : data);
        }
      } catch (e) {
        if (this._autoDestroy) {
          this.destroy(e);
        } else {
          this.emit('error', e);
        }
      }
    })();
  }

  _destroy (err, done) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    this.push(null);
    (async () => {
      try {
        await this._afcService.closeFileHandle(this._fileHandle);
        done(err);
      } catch (e) {
        if (err) {
          log.debug(e);
        } else {
          err = e;
        }
        done(err);
      }
    })();
  }
}

export class AfcWritableFileStream extends stream.Writable {

  constructor (fileHandle, afcService, options) {
    super(options);
    this._fileHandle = fileHandle;
    this._afcService = afcService;
    this._autoDestroy = !!options.autoDestroy;
    this._destroyed = false;
  }

  _write (chunk, encoding, next) {
    (async () => {
      try {
        await this._afcService.writeFile(this._fileHandle, chunk);
        next();
      } catch (e) {
        if (this._autoDestroy) {
          this.destroy(e);
        }
        next(e);
      }
    })();
  }

  _destroy (err, done) {
    if (this._destroyed) {
      return;
    }
    this._destroyed = true;
    (async () => {
      try {
        await this._afcService.closeFileHandle(this._fileHandle);
        done(err);
      } catch (e) {
        if (err) {
          log.debug(e);
        } else {
          err = e;
        }
        done(err);
      }
    })();
  }
}
