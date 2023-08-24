import Stream from 'stream';
import {DTXMessage, DTXMessageAux} from '../headers';


class DTXEncoder extends Stream.Transform {

  constructor () {
    super({ objectMode: true });
  }

  _transform (data, encoding, onData) {
    this.push(this._encode(data), 'binary');
    onData();
  }

  _encode (data) {
    const {sync, channelCode, selector, auxiliaries, identifier} = data;
    const dtx = new DTXMessage({
      identifier,
      channelCode,
      selector,
      expectsReply: sync
    });
    if (auxiliaries instanceof DTXMessageAux) {
      dtx.auxiliaries = auxiliaries;
    } else {
      dtx.auxiliaries.data = auxiliaries;
    }
    return dtx.build();
  }
}

export { DTXEncoder };
