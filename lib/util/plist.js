import bplistParser from 'bplist-parser';
import _ from 'lodash';
import bplistCreator from 'bplist-creator';
import plist from 'plist';

const BPLIST_IDENTIFIER = {
  BUFFER: Buffer.from('bplist00'),
  TEXT: 'bplist00'
};
const PLIST_IDENTIFIER = {
  BUFFER: Buffer.from('<'),
  TEXT: '<'
};

function getTextPlist (data) {
  if (_.isString(data) && data.startsWith(PLIST_IDENTIFIER.TEXT)) {
    return data;
  }
  if (_.isBuffer(data) && PLIST_IDENTIFIER.BUFFER.compare(data, 0, PLIST_IDENTIFIER.BUFFER.length) === 0) {
    return data.toString();
  }
  return null;
}

function getBinaryPlist (data) {
  if (_.isString(data) && data.startsWith(BPLIST_IDENTIFIER.TEXT)) {
    return Buffer.from(data);
  }

  if (_.isBuffer(data) && BPLIST_IDENTIFIER.BUFFER.compare(data, 0, BPLIST_IDENTIFIER.BUFFER.length) === 0) {
    return data;
  }
  return null;
}

function createPlist (object, binary = false) {
  if (binary) {
    return bplistCreator(object);
  } else {
    return plist.build(object);
  }
}

function parse (data) {
  let textPlist = getTextPlist(data);
  if (textPlist) {
    return plist.parse(textPlist);
  }

  let binaryPlist = getBinaryPlist(data);
  if (binaryPlist) {
    return bplistParser.parseBuffer(binaryPlist)[0];
  }

  throw new Error(`Unknown type of plist, data: ${data.toString()}`);
}
export { parse, createPlist };