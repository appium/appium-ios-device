import {archive, unarchive} from './transformer/nskeyed';
import plistlib from 'bplist-parser';
import _ from 'lodash';

const DTX_MESSAGE_PAYLOAD_HEADER_LENGTH = 16;
const DTX_MESSAGE_HEADER_LENGTH = 32;
const DTX_MESSAGE_HEADER_MAGIC = 0x1F3D5B79;
const DTX_MESSAGE_HEADER_MAGIC_LEN = 4;
const DTX_MESSAGE_AUX_HEADER = 0x01F0;
const DTX_AUXILIARY_MAGIC = 0xa;

const FLAG_TYPES = Object.freeze({
  push: 0,
  recv: 1,
  send: 2,
  reply: 3
});

const AUX_TYPES = Object.freeze({
  Text: 1,
  NSKeyed: 2,
  UInt32LE: 3,
  BigUInt64LE: 4,
  BigInt64LE: 6
});

/**
 * DTXMessageHeader length 32
 * struct DTXMessageHeader {
 *     u32 magic DTX_MESSAGE_HEADER_MAGIC
 *     u32 headerLength
 *     u16 fragmentId   packet number
 *     u16 fragmentCount  packets total number
 *     u32 payloadLength
 *     u32 identifier
 *     u32 conversationIndex
 *     u32 channel
 *     u32 expectsReply
 *     }
 */

/**
 * @typedef {Object} DTXMessageOptions
 * @property {any} selector
 * @property {number} identifier packet transmission sequence, this value is incremented for each request
 * @property {number} channelCode the data transmission of the service will use this channel code.
 * Each service has a separate channel
 * @property {number?} payloadLength DTXMessageAuxBuffer.length(nullable) + selectorBuffer.length(nullable)
 * @property {boolean} expectsReply if true reply a ack message
 * @property {number} conversationIndex  raw data +1 indicate a reply message
 * @property {number} flags message status
 */

class DTXMessageHeader {
  /**
   * @param {Partial<DTXMessageOptions>} data
   * @returns {Buffer} DTXMessageHeaderBuffer
   */
  static build (data) {
    const messageHeader = Buffer.alloc(DTX_MESSAGE_HEADER_LENGTH);
    messageHeader.writeUInt32LE(DTX_MESSAGE_HEADER_MAGIC, 0);
    messageHeader.writeUInt32LE(DTX_MESSAGE_HEADER_LENGTH, 4);
    messageHeader.writeUInt16LE(0, 8);
    messageHeader.writeUInt16LE(1, 10);
    messageHeader.writeUInt32LE(data.payloadLength ?? 0, 12);
    messageHeader.writeUInt32LE(data.identifier ?? 0, 16);
    messageHeader.writeUInt32LE(data.conversationIndex ?? 0, 20);
    messageHeader.writeUInt32LE(data.channelCode ?? 0, 24);
    messageHeader.writeUInt32LE(+(data.expectsReply ?? false), 28);
    return messageHeader;
  }

  /**
   * @param headerBuffer DTXMessageHeaderBuffer
   * @returns {Object}
   */
  static parse (headerBuffer) {
    return {
      magic: headerBuffer.readUInt32LE(0),
      headerLength: headerBuffer.readUInt32LE(4),
      fragmentId: headerBuffer.readUInt16LE(8),
      fragmentCount: headerBuffer.readUInt16LE(10),
      payloadLength: headerBuffer.readUInt32LE(12),
      identifier: headerBuffer.readUInt32LE(16),
      conversationIndex: headerBuffer.readUInt32LE(20),
      channel: headerBuffer.readUInt32LE(24),
      expectsReply: headerBuffer.readUInt32LE(28),
    };
  }
}

/**
 * DTXMessagePayloadHeader length 16
 * struct DTXMessageHeader {
 *     u32 flags FLAG_TYPES
 *     u32 auxLength
 *     u64 totalLength
 *     }
 */

/**
 * @typedef {Object} DTXMessagePayloadHeaderObject
 * @property {number} flags message status
 * @property {number} auxLength DTXMessageAuxBuffer.length(nullable)
 * @property {bigint} totalLength DTXMessageAuxBuffer.length(nullable) + selectorBuffer.length
 */
class DTXMessagePayloadHeader {
  /**
   * @param data {DTXMessagePayloadHeaderObject}
   * @returns {Buffer} DTXMessagePayloadHeaderBuffer
   */
  static build (data) {
    const messageHeader = Buffer.alloc(DTX_MESSAGE_PAYLOAD_HEADER_LENGTH);
    messageHeader.writeUInt32LE(data.flags, 0);
    messageHeader.writeUInt32LE(data.auxLength, 4);
    messageHeader.writeBigUInt64LE(data.totalLength, 8);
    return messageHeader;
  }

  /**
   * @param headerBuffer
   * @returns {DTXMessagePayloadHeaderObject}
   */
  static parse (headerBuffer) {
    return {
      flags: headerBuffer.readUInt32LE(0),
      auxLength: headerBuffer.readUInt32LE(4),
      totalLength: headerBuffer.readBigInt64LE(8)
    };
  }
}


class DTXMessageAux {
  /**
   * @param {any[] | DTXMessageAuxBuffer} data
   */
  constructor (data = []) {
    this.data = data;
  }

  /**
   * JS Array to Apple NSKeyed Buffer
   * @returns {Buffer}
   */
  build () {
    if (this.data instanceof DTXMessageAuxBuffer) {
      return this.data.getBytes();
    }
    const messageAux = new DTXMessageAuxBuffer();
    let buf = Buffer.alloc(0);
    for (const arg of this.data) {
      if (arg instanceof DTXMessageAuxBuffer) {
        buf = Buffer.concat([buf, arg.getBytes()]);
      } else if (_.isNumber(arg)) {
        messageAux.appendInt(arg);
      } else if (typeof arg == 'bigint') {
        messageAux.appendLong(arg);
      } else {
        messageAux.appendObject(arg);
      }
    }
    return Buffer.concat([buf, messageAux.getBytes()]);
  }

  /**
   * Parses nskeyed Buffer into js array
   * @param {Buffer} headerBuffer
   * @param {DTXMessagePayloadHeaderObject} payloadHeader
   * @returns {any[]}
   */
  static parse (headerBuffer, payloadHeader) {
    let cursor = 0;
    const data = [];
    const length = headerBuffer.readBigInt64LE(8);
    cursor += 16;
    while (cursor <= length) {
      if (payloadHeader.flags !== FLAG_TYPES.push) {
        const m = headerBuffer.readUInt32LE(cursor);
        cursor += 4;
        if (m !== DTX_AUXILIARY_MAGIC) {
          throw new Error(`incorrect auxiliary magic: ${m}`);
        }
      }
      const type = headerBuffer.readUInt32LE(cursor);
      cursor += 4;
      switch (type) {
        case AUX_TYPES.Text: {
          const strLen = headerBuffer.readUInt32LE(cursor);
          cursor += 4;
          data.push(headerBuffer.slice(cursor, cursor + strLen));
          cursor += strLen;
          break;
        }
        case AUX_TYPES.NSKeyed: {
          const strLen = headerBuffer.readUInt32LE(cursor);
          cursor += 4;
          const archived_data = headerBuffer.slice(cursor, cursor + strLen);
          data.push(unarchive(archived_data));
          cursor += strLen;
          break;
        }
        case AUX_TYPES.UInt32LE:
          data.push(headerBuffer.readUInt32LE(cursor));
          cursor += 4;
          break;
        case AUX_TYPES.BigUInt64LE:
          data.push(headerBuffer.readBigUInt64LE(cursor));
          cursor += 8;
          break;
        case AUX_TYPES.BigInt64LE:
          data.push(headerBuffer.readBigInt64LE(cursor));
          cursor += 8;
          break;
        default:
          throw new Error(`Unknown type ${type}`);
      }
    }
    return data;
  }
}

class InstrumentRPCParseError {
  constructor (data) {
    this.data = data;
  }
}

class DTXMessageAuxBuffer {
  constructor () {
    this._buf = Buffer.alloc(0);
  }

  /**
   * @param {number} value
   */
  appendInt (value) {
    const buf = Buffer.alloc(12);
    buf.writeUInt32LE(DTX_AUXILIARY_MAGIC, 0);
    buf.writeUInt32LE(3, 4);
    buf.writeUInt32LE(value, 8);
    this._buf = Buffer.concat([this._buf, buf]);
  }

  /**
   * @param {bigint} value
   */
  appendLong (value) {
    const buf = Buffer.alloc(16);
    buf.writeUInt32LE(DTX_AUXILIARY_MAGIC, 0);
    buf.writeUInt32LE(4, 4);
    buf.writeBigUInt64LE(value, 8);
    this._buf = Buffer.concat([this._buf, buf]);
  }

  /**
   * @param {number} value
   */
  appendSignedInt (value) {
    const buf = Buffer.alloc(12);
    buf.writeUInt32LE(DTX_AUXILIARY_MAGIC, 0);
    buf.writeUInt32LE(3, 4);
    buf.writeInt32LE(value, 8);
    this._buf = Buffer.concat([this._buf, buf]);
  }

  /**
   * @param {bigint} value
   */
  appendSignedLong (value) {
    const buf = Buffer.alloc(16);
    buf.writeUInt32LE(DTX_AUXILIARY_MAGIC, 0);
    buf.writeUInt32LE(6, 4);
    buf.writeBigInt64LE(value, 8);
    this._buf = Buffer.concat([this._buf, buf]);
  }

  /**
   * @param {Object} value
   */
  appendObject (value) {
    const buf = archive(value);
    const buf2 = Buffer.alloc(12);
    buf2.writeUInt32LE(DTX_AUXILIARY_MAGIC, 0);
    buf2.writeUInt32LE(2, 4);
    buf2.writeUInt32LE(buf.length, 8);
    this._buf = Buffer.concat([this._buf, buf2, buf]);
  }

  getBytes () {
    const out = Buffer.alloc(16);
    out.writeUInt32LE(DTX_MESSAGE_AUX_HEADER, 0);
    out.writeUInt32LE(this._buf.length, 8);
    return Buffer.concat([out, this._buf]);
  }
}



class DTXMessage {
  /**
   * @param {Partial<DTXMessageOptions>} opts
   */
  constructor (opts = {}) {
    const {
      identifier,
      channelCode,
      selector,
      expectsReply,
      conversationIndex = 0,
      flags = FLAG_TYPES.send
    } = opts;
    this._messageHeader = undefined;
    this._payloadHeader = undefined;
    this._identifier = identifier;
    this._channelCode = channelCode;
    this._expectsReply = expectsReply;
    this._selector = selector;
    this._conversationIndex = conversationIndex;
    this._flags = flags;
    this.auxiliaries = new DTXMessageAux();
  }

  /**
   * get DTXMessageHeader identifier. Packet transmission sequence
   * @returns {number}
   */
  get identifier () {
    return this._messageHeader?.identifier;
  }

  /**
   * get DTXMessageHeader channelCode.
   * Packet transmission channelCode. Use this value to distinguish when there are multiple channels
   * call this method `InstrumentService.registerChannelCallback` get the channel message
   * @returns {number}
   */
  get channelCode () {
    return this._messageHeader?.channel;
  }

  /**
   * get DTXMessageHeader expectsReply. Whether to need ack message
   * if expectsReply is true must reply ack message
   * @returns {boolean}
   */
  get expectsReply () {
    return this._messageHeader?.expectsReply;
  }

  /**
   * call this method `InstrumentService.registerSelectorCallback` get the selector message
   * @returns {*} Unknown data
   */
  get selector () {
    return this._selector;
  }

  /**
   * @param data
   */
  set selector (data) {
    this._selector = data;
  }

  /**
   * get DTXMessageHeader conversationIndex
   * @returns {number}
   */
  get conversationIndex () {
    return this._messageHeader?.conversationIndex;
  }

  /**
   * DTXMessage Buffer: DTXMessageHeader + PayloadHeader + DTXMessageAuxBuffer(nullable) + selector(nullable)
   * @returns {Buffer}
   */
  build () {
    const sel = this._selector ? archive(this._selector) : Buffer.alloc(0);
    const aux = this.auxiliaries.build();
    const payloadHeader = DTXMessagePayloadHeader.build({
      flags: this._flags,
      auxLength: aux.length,
      // need to convert to bigint in any case
      // eslint-disable-next-line no-undef
      totalLength: BigInt(aux.length + sel.length),
    });

    const messageHeader = DTXMessageHeader.build({
      payloadLength: DTX_MESSAGE_PAYLOAD_HEADER_LENGTH + aux.length + sel.length,
      identifier: this._identifier,
      conversationIndex: this._conversationIndex,
      channelCode: this._channelCode,
      expectsReply: this._expectsReply
    });
    return Buffer.concat([messageHeader, payloadHeader, aux, sel]);
  }

  /**
   * Parses DTX buffer into an js object. Returned in DTXDecoder Stream.Transform
   * @param {Buffer} headerBuf  DTXMessageHeader buffer
   * @param {Buffer} payloadBuf  PayloadHeaderBuffer + DTXMessageAuxBuffer(nullable) + selectorBuffer(nullable)
   * @returns {DTXMessage}
   */
  static parse (headerBuf, payloadBuf) {
    let cursor = 0;
    const ret = new DTXMessage();
    ret._messageHeader = DTXMessageHeader.parse(headerBuf);
    if (ret._messageHeader.payloadLength === 0) {
      return ret;
    }
    ret._payloadHeader = DTXMessagePayloadHeader.parse(payloadBuf.slice(cursor, DTX_MESSAGE_PAYLOAD_HEADER_LENGTH));
    cursor += DTX_MESSAGE_PAYLOAD_HEADER_LENGTH;
    // totalLength is bigint use 0n
    if (ret._payloadHeader.totalLength === 0n) {
      return ret;
    }
    if (ret._payloadHeader.auxLength > 0) {
      // @ts-ignore Not 100% sure if this ok
      ret.auxiliaries = DTXMessageAux.parse(payloadBuf.slice(cursor, cursor + ret._payloadHeader.auxLength), ret._payloadHeader);
      cursor += ret._payloadHeader.auxLength;
    }

    const data = payloadBuf.slice(cursor, cursor + payloadBuf.length);
    ret.selector = data;
    if (data.length > 0) {
      for (const fun of [unarchive, plistlib.parseBuffer]) {
        try {
          ret.selector = fun(data);
          break;
        } catch (e) {
          ret.selector = new InstrumentRPCParseError(data);
        }
      }
    }
    return ret;
  }
}

export { DTXMessageHeader, DTXMessagePayloadHeader, DTXMessageAuxBuffer, DTXMessageAux, DTXMessage,
  DTX_MESSAGE_PAYLOAD_HEADER_LENGTH, DTX_MESSAGE_HEADER_LENGTH, DTX_MESSAGE_HEADER_MAGIC, DTX_MESSAGE_HEADER_MAGIC_LEN,
  FLAG_TYPES};
