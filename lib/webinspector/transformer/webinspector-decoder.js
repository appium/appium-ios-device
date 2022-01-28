import Stream from 'stream';
import { plist } from '@appium/support';


class WebInspectorDecoder extends Stream.Transform {
  constructor (maxLength) {
    super({ objectMode: true });
    this._frameBufferIndex = 0;
    this._frameBuffer = Buffer.allocUnsafeSlow(maxLength);
  }

  _transform (data, encoding, onData) {
    this._decode(data);
    onData();
  }

  _decode (data) {
    if (data.WIRFinalMessageKey) {
      const buffer = data.WIRFinalMessageKey;
      this._frameBufferIndex += this._readBytes(buffer, 0, this._frameBuffer, this._frameBufferIndex, buffer.length);
      const pref = plist.parsePlist(this._frameBuffer.slice(0, this._frameBufferIndex));
      this.push(pref);
      this._resetBuffers();
    } else {
      const buffer = data.WIRPartialMessageKey;
      this._frameBufferIndex += this._readBytes(buffer, 0, this._frameBuffer, this._frameBufferIndex, buffer.length);
    }
  }

  _readBytes (src, srcIndex, target, targetIndex, nBytesToBeRead) {
    let availableBytes = Math.min(nBytesToBeRead, src.length - srcIndex);
    src.copy(target, targetIndex, srcIndex, srcIndex + availableBytes);
    return availableBytes;
  }

  _resetBuffers () {
    this._frameBufferIndex = 0;
  }
}

export { WebInspectorDecoder };
export default WebInspectorDecoder;
