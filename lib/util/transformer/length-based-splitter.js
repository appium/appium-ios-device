import Stream from 'stream';
import log from '../../logger';

class LengthBasedSplitter extends Stream.Transform {
  constructor (opts) {
    super();

    const {
      readableStream,
      littleEndian,
      maxFrameLength,
      lengthFieldOffset,
      lengthFieldLength,
      lengthAdjustment,
    } = opts;

    this.readableStream = readableStream;
    this.littleEndian = littleEndian;
    this.maxFrameLength = maxFrameLength;
    this.lengthFieldOffset = lengthFieldOffset;
    this.lengthFieldLength = lengthFieldLength;
    this.lengthAdjustment = lengthAdjustment;

    this.isShutdown = false;
    this._frameBufferIndex = 0;
    this._frameBuffer = Buffer.allocUnsafeSlow(maxFrameLength);
  }

  _transform (data, encoding, onData) {
    for (let i = 0; i < data.length; i = this._decode(data, i)) {
      if (this.isShutdown) {
        return this._pushBack(i, data.length, data);
      }
    }
    onData();
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

    const messageLength = this._readLength(this._frameBuffer, this.lengthFieldOffset, this.littleEndian);
    if (messageLength > this.maxFrameLength) {
      throw new Error(`The frame is bigger than expected. Length: ${messageLength}, max: ${this.maxFrameLength}`);
    }

    const completeMessageLength = messageLength + this.lengthAdjustment + this.lengthFieldOffset;

    bytesToRead = completeMessageLength - this._frameBufferIndex;
    nBytesRead = bytesToRead === 0 ? 0 : this._readBytes(data, bufferMarker, this._frameBuffer, this._frameBufferIndex, bytesToRead);
    bufferMarker += nBytesRead;
    this._frameBufferIndex += nBytesRead;

    if (this._frameBufferIndex < completeMessageLength) {
      return bufferMarker;
    }

    const message = Buffer.allocUnsafe(this._frameBufferIndex);
    this._frameBuffer.copy(message, 0, 0, this._frameBufferIndex);

    this.push(message);
    this._resetBuffers();
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

  _pushBack (start, end, data) {
    if (start > end) {
      log.error('More data was read than the buffer size. This should not happen');
    }
    if (start === end) {
      return;
    }
    const leftover = Buffer.allocUnsafe(end - start);
    data.copy(leftover, 0, start, end);
    process.nextTick(() => this.readableStream.unshift(leftover));
  }

  shutdown () {
    this.isShutdown = true;
  }

  _readLength (data, index, littleEndian) {
    switch (this.lengthFieldLength) {
      case 4:
        return littleEndian ? data.readUInt32LE(index) : data.readUInt32BE(index);
      case 8:
        return littleEndian ? data.readUInt32LE(index) : data.readUInt32BE(index + 4);
      default:
        throw new Error(`${this.lengthFieldLength} is not supported. Only 4 and 8 are supported at the moment`);
    }
  }
}

export { LengthBasedSplitter};
export default LengthBasedSplitter;
