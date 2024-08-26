import Stream from 'stream';
import {
  DTX_MESSAGE_HEADER_LENGTH, DTX_MESSAGE_HEADER_MAGIC, DTX_MESSAGE_HEADER_MAGIC_LEN,
  DTXMessageHeader, DTXMessage,
} from '../headers';
import log from '../../logger';

class DTXDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
    this._dtxManager = {};
    this.buffer = Buffer.allocUnsafe(0);
    this.cursor = 0;
    this.header = undefined;
  }

  _transform (data, encoding, onData) {
    this._decode(data);
    onData();
  }

  _decode (data) {
    // Merge packets
    this.buffer = Buffer.concat([this.buffer.slice(this.cursor, this.buffer.length), data]);
    this.cursor = 0;
    while (this.cursor < this.buffer.length) {
      const magic = this._recv(DTX_MESSAGE_HEADER_MAGIC_LEN);
      if (!magic) { return; }
      this.cursor -= DTX_MESSAGE_HEADER_MAGIC_LEN;
      if (magic && magic.readUInt32LE(0) === DTX_MESSAGE_HEADER_MAGIC) {
        const headerBuffer = this._recv(DTX_MESSAGE_HEADER_LENGTH);
        if (!headerBuffer) { return; }
        this.header = DTXMessageHeader.parse(headerBuffer);
        if (this.header.fragmentId === 0) {
          // only the 0th fragment contains a message header
          if (!(this.header.channel in this._dtxManager)) {
            this._dtxManager[this.header.channel] = {headerBuffer, payloadBuffer: Buffer.allocUnsafe(0)};
          }
          if (this.header.fragmentCount > 1) {
            // Continue to get the next message fragments
            continue;
          }
        }
      }
      const bodyBuffer = this._recv(this.header.payloadLength);
      if (!bodyBuffer) { return; }
      if (this._dtxManager[this.header.channel]) {
        this._dtxManager[this.header.channel].payloadBuffer = Buffer.concat([this._dtxManager[this.header.channel].payloadBuffer, bodyBuffer]);
      }
      if (this.header.fragmentId === (this.header.fragmentCount - 1)) {
        data = this._dtxManager[this.header.channel];
        delete this._dtxManager[this.header.channel];
        if (data) {
          try {
            const dtxMessage = DTXMessage.parse(data.headerBuffer, data.payloadBuffer);
            this.push(dtxMessage);
          } catch (e) {
            log.debug(e.stack);
            log.error(`Skipped decoding of an unparseable DTXMessage: ${e.message}`);
          }
        }
      }
    }
    this.cursor = 0;
    this.buffer = Buffer.allocUnsafe(0);
  }

  _recv (length) {
    if (this.buffer.length < this.cursor + length) {
      return null;
    }
    const buf = this.buffer.slice(this.cursor, this.cursor + length);
    this.cursor += length;
    return buf;
  }
}

export { DTXDecoder };
