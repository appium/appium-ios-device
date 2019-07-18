/* eslint-disable promise/prefer-await-to-callbacks */
import Stream from 'stream';
import { MAGIC_NUMBER, AFC_PACKET_HEADER_SIZE } from '../protocol';


class AfcDecoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, callback) {
    this._decode(data);
    callback();
  }

  _decode (data) {
    const magicNumber = data.slice(0, 8);
    if (magicNumber.compare(MAGIC_NUMBER) !== 0) {
      throw new Error(`Unexpected magic number: ${magicNumber}`);
    }
    const messageLength = this.readUInt64LE(data, 8);
    const thisLength = this.readUInt64LE(data, 16);
    const packetNumber = this.readUInt64LE(data, 24);
    const opCode = this.readUInt64LE(data, 32);

    const headerPayload = data.slice(AFC_PACKET_HEADER_SIZE, thisLength);
    const content = data.slice(thisLength, messageLength);

    this.push({ messageLength, packetNumber, opCode, headerPayload, content });
  }

  readUInt64LE (buffer, index) {
    // Ignore the first 4 bytes since we don't do anything with longs
    return buffer.readUInt32LE(index);
  }
}

export { AfcDecoder };
export default AfcDecoder;