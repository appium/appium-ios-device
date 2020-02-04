import Stream from 'stream';
import { plist } from 'appium-support';

const WEBINSPECTOR_PARTIAL_PACKET_CHUNK_SIZE = 8096;

class WebInspectorEncoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    let payloadBuffer = plist.createPlist(data, true);
    for (let i = 0; i < payloadBuffer.length; i += this._encode(payloadBuffer, i)) {}
    onData();
  }

  _encode (data, pos) {
    const messageLength = Math.min(data.length - pos, WEBINSPECTOR_PARTIAL_PACKET_CHUNK_SIZE);
    if (messageLength < WEBINSPECTOR_PARTIAL_PACKET_CHUNK_SIZE) {
      this.push({WIRFinalMessageKey: data.slice(pos, messageLength + pos)});
    } else {
      this.push({WIRPartialMessageKey: data.slice(pos, messageLength + pos)});
    }
    return messageLength;
  }

}

export { WebInspectorEncoder };
export default WebInspectorEncoder;
