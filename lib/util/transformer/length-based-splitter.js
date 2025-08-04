import Stream from 'stream';
import { log } from '../../logger';
import { util } from '@appium/support';

// Debug configuration
const DEBUG_CONFIG = {
  enableFrameSizeLogging: process.env.APPIUM_IOS_DEBUG_FRAME_SIZE === 'true',
  enableLargeFrameLogging: process.env.APPIUM_IOS_LOG_LARGE_FRAMES === 'true',
  largeFrameThreshold: parseInt(process.env.APPIUM_IOS_LARGE_FRAME_THRESHOLD || '10485760', 10), // 10MB
  enableMemoryMonitoring: process.env.APPIUM_IOS_MONITOR_MEMORY === 'true'
};

export class LengthBasedSplitter extends Stream.Transform {
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
    this.serviceName = this.constructor.name;

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

    // Debug logging for frame sizes
    if (DEBUG_CONFIG.enableFrameSizeLogging) {
      log.debug(`Frame size detected: ${messageLength} bytes, max allowed: ${this.maxFrameLength} bytes`);
    }

    // Log large frames for investigation
    if (DEBUG_CONFIG.enableLargeFrameLogging && messageLength > DEBUG_CONFIG.largeFrameThreshold) {
      this._logLargeFrame(messageLength);
    }

    if (messageLength > this.maxFrameLength) {
      throw this._makeFrameSizeError(messageLength);
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

  /**
   * Log information about large frames for debugging purposes
   * @param {number} messageLength - The size of the detected frame
   */
  _logLargeFrame(messageLength) {
    log.warn(`Large frame detected: ${util.toReadableSizeString(messageLength)}`);
    log.warn(`Service: ${this.serviceName}, Max allowed: ${util.toReadableSizeString(this.maxFrameLength)}`);

    // Log memory usage if monitoring is enabled
    if (DEBUG_CONFIG.enableMemoryMonitoring) {
      const memUsage = process.memoryUsage();
      log.warn(`Memory usage - RSS: ${util.toReadableSizeString(memUsage.rss)}, Heap: ${util.toReadableSizeString(memUsage.heapUsed)}`);
    }
  }

  /**
   * Create frame size error with enhanced debugging information
   * @param {number} messageLength - The size of the frame that exceeded the limit
   * @returns {Error} The constructed error object
   */
  _makeFrameSizeError(messageLength) {
    const errorMsg = `The frame is bigger than expected. ` +
      `Length: ${util.toReadableSizeString(messageLength)}, ` +
      `max: ${util.toReadableSizeString(this.maxFrameLength)}`;
    log.error(errorMsg);
    log.error(`Service: ${this.serviceName}, ` +
      `Frame offset: ${this.lengthFieldOffset}, ` +
      `Frame length: ${this.lengthFieldLength}`);

    // Only suggest debugging steps if debug mode is not already enabled
    if (!DEBUG_CONFIG.enableFrameSizeLogging) {
      log.error('To debug this issue, see: https://github.com/appium/appium-ios-device/blob/master/docs/DEBUG_FRAME_SIZE.md');
    }

    return new Error(errorMsg);
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

export default LengthBasedSplitter;
