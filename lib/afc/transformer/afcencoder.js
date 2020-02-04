import Stream from 'stream';
import { MAGIC_NUMBER, AFC_PACKET_HEADER_SIZE } from '../protocol';


class AfcEncoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    onData(null, this._encode(data));
  }

  _encode (data) {
    data.content = data.content ? data.content : Buffer.alloc(0);

    const thisLength = AFC_PACKET_HEADER_SIZE + data.headerPayload.length;
    const messageLength = thisLength + data.content.length;

    const buffer = Buffer.alloc(messageLength);
    MAGIC_NUMBER.copy(buffer);
    this.writeUInt64LE(buffer, 8, messageLength);
    this.writeUInt64LE(buffer, 16, thisLength);
    this.writeUInt64LE(buffer, 24, data.packetNumber);
    this.writeUInt64LE(buffer, 32, data.opCode);
    data.headerPayload.copy(buffer, AFC_PACKET_HEADER_SIZE);
    data.content.copy(buffer, thisLength);
    return buffer;
  }

  writeUInt64LE (buffer, index, content) {
    // Ignore the first 4 bytes since we don't do anything with longs
    buffer.writeUInt32LE(content, index);
    buffer.writeUInt32LE(0, index + 4);
  }

}

export { AfcEncoder };
export default AfcEncoder;
