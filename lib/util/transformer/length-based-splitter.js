/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';

class LengthBasedSplitter extends Stream.Transform {

  constructor (littleEndian, maxFrameLength, lengthFieldOffset, lengthFieldLength, lengthAdjustment) {
    super({ objectMode: true });
    this.littleEndian = littleEndian;
    this.maxFrameLength = maxFrameLength;
    this.lengthFieldOffset = lengthFieldOffset;
    this.lengthFieldLength = lengthFieldLength;
    this.lengthAdjustment = lengthAdjustment;

    this._frameBufferIndex = 0;
    this._frameBuffer = Buffer.allocUnsafeSlow(maxFrameLength);
  }

  _transform (data, encoding, callback) {
    let consumed = this._decode(data, 0);
    if (consumed < data.length) {
      this.pause();
      this.unshift(data.slice(consumed, data.length));
    }
    callback();
  }

  _decode (data, pos) {

    let bufferMarker = pos;

    let bytesToRead = Math.max((this.lengthFieldOffset + this.lengthFieldLength) - this._frameBufferIndex, 0);
    let nBytesRead = bytesToRead === 0 ? 0 : this._readBytes(data, bufferMarker, this._frameBuffer, this._frameBufferIndex, bytesToRead);
    bufferMarker += nBytesRead;
    this._frameBufferIndex += nBytesRead;

    if (this._frameBufferIndex < this.lengthFieldOffset) {
      return bufferMarker;
    }

    let completeMessageLength = this._readLength(this._frameBuffer, this.lengthFieldOffset, this.littleEndian);
    if (completeMessageLength > this.maxFrameLength) {
      throw new Error(`The frame is bigger than expected. Length: ${completeMessageLength}, max: ${this.maxFrameLength}`);
    }

    bytesToRead = (this.lengthAdjustment + completeMessageLength) - this._frameBufferIndex;
    nBytesRead = this._readBytes(data, bufferMarker, this._frameBuffer, this._frameBufferIndex, bytesToRead);
    bufferMarker += nBytesRead;
    this._frameBufferIndex += nBytesRead;

    if (this._frameBufferIndex < completeMessageLength) {
      return bufferMarker;
    }

    let message = Buffer.alloc(this._frameBufferIndex);
    this._frameBuffer.copy(message, 0, 0, this._frameBufferIndex);

    this._resetBuffers();

    this.push(message);
    return bufferMarker;
  }

  _readBytes (src, srcIndex, target, targetIndex, nBytesToBeRead) {
    let availableBytes = Math.min(nBytesToBeRead, src.length - srcIndex);
    src.copy(target, targetIndex, srcIndex, srcIndex + availableBytes);
    return availableBytes;
  }
  _resetBuffers () {
    this._frameBufferIndex = 0;
  }

  _readLength (data, index, littleEndian) {
    return littleEndian ? data.readUInt32LE(index) : data.readUInt32BE(index);
  }
}

export { LengthBasedSplitter};
export default LengthBasedSplitter;
