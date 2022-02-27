import plistlib from 'bplist-parser';
import bplistCreate from 'bplist-creator';
import {parse as uuidParse, stringify as uuidStringify} from 'uuid';
import _ from 'lodash';

const NSKEYED_ARCHIVE_VERSION = 100_000;
const NULL_UID = new plistlib.UID(0);
const CYCLE_TOKEN = 'CycleToken';
const PRIMITIVE_TYPES = ['Number', 'String', 'Boolean', 'UID', 'Buffer'];
const NON_ENCODABLE_TYPES = ['number', 'boolean'];
const NSKEYEDARCHIVER = 'NSKeyedArchiver';
const UNIX2APPLE_TIMESTAMP_SECOND = 978307200;


class ArchivedObject {
  /**
   * Stateful wrapper around Archive for an object being archived.
   * @param {Object} object
   * @param {Unarchive} unarchiver
   * @constructor
   */
  constructor (object, unarchiver) {
    this.object = object;
    this._unarchiver = unarchiver;
  }

  decodeIndex (index) {
    return this._unarchiver.decodeObject(index);
  }

  decode (key) {
    return this._unarchiver.decodeKey(this.object, key);
  }
}

class ArchivingObject {
  /**
   * Stateful wrapper around Unarchive for an archived object
   * @param {Object} object
   * @param {Archive} archiver
   * @constructor
   */
  constructor (object, archiver) {
    this._archiveObj = object;
    this._archiver = archiver;
  }

  encode (key, val) {
    this._archiveObj[key] = this._archiver.encode(val);
  }
}

/**
 * This class must be inherited when creating an archive/unarchive subclass
 * And you need to call `updateNSKeyedArchiveClass` add subclass to archive/unarchive object
 */
class BaseArchiveHandler {
  /**
   * @param {ArchivedObject} archive
   */
  // eslint-disable-next-line no-unused-vars
  decodeArchive (archive) {
    throw new Error(`Did not know how to decode the object`);
  }

  /**
   * @param {Object} obj  an instance of this class
   * @param {ArchivingObject} archive
   */
  // eslint-disable-next-line no-unused-vars
  encodeArchive (obj, archive) {
    throw new Error(`Did not know how to encode the object`);
  }
}

/**
 * "Delegate for packing/unpacking NS(Mutable)Dictionary objects"
 */
class DictArchive extends BaseArchiveHandler {
  decodeArchive (archive) {
    const keyUids = archive.decode('NS.keys');
    const valUids = archive.decode('NS.objects');
    const d = {};
    for (let i = 0; i < keyUids.length ; i++) {
      const key = archive.decodeIndex(keyUids[i]);
      d[key] = archive.decodeIndex(valUids[i]);
    }
    return d;
  }
}

/**
 * Delegate for packing/unpacking NS(Mutable)Array objects
 */
class ListArchive extends BaseArchiveHandler {
  decodeArchive (archive) {
    const uids = archive.decode('NS.objects');
    return uids.map(archive.decodeIndex.bind(archive));
  }
}

class DTTapMessagePlist extends BaseArchiveHandler {
  decodeArchive (archive) {
    return archive.decode('DTTapMessagePlist');
  }
}

class NSError extends BaseArchiveHandler {
  decodeArchive (archive) {
    return {
      '$class': 'NSError',
      'domain': archive.decode('NSDomain'),
      'userinfo': archive.decode('NSUserInfo'),
      'code': archive.decode('NSCode')
    };
  }
}

class NSException extends BaseArchiveHandler {
  decodeArchive (archive) {
    return {
      '$class': 'NSException',
      'reason': archive.decode('NS.reason'),
      'userinfo': archive.decode('userinfo'),
      'name': archive.decode('NS.name')
    };
  }
}

class NSURL extends BaseArchiveHandler {
  /**
   * @param {*} base
   * @param {string} relative usually ios device relative path e.g: file://xx/
   */
  constructor (base, relative) {
    super();
    this._base = base;
    this._relative = relative;
  }

  decodeArchive (archive) {
    return {$class: 'NSURL', base: archive.decode('NS.base'), relative: archive.decode('NS.relative')};
  }

  encodeArchive (obj, archive) {
    archive.encode('NS.base', obj._base);
    archive.encode('NS.relative', obj._relative);
  }
}

class NSDate extends BaseArchiveHandler {
  /**
   * @param {number} data timestamp in seconds
   */
  constructor (data) {
    super();
    this._data = data;
  }

  decodeArchive (archive) {
    return UNIX2APPLE_TIMESTAMP_SECOND + archive.decode('NS.time');
  }

  encodeArchive (obj, archive) {
    archive.encode('NS.time', obj._data - UNIX2APPLE_TIMESTAMP_SECOND);
  }
}

class NSMutableString extends BaseArchiveHandler {
  decodeArchive (archive) {
    return archive.decode('NS.string');
  }
}

class NSMutableData extends BaseArchiveHandler {
  decodeArchive (archive) {
    return archive.decode('NS.data');
  }
}

class NSUUID extends BaseArchiveHandler {
  /**
   * @param {string} data uuid format data e.g:00000000-0000-0000-0000-000000000000
   */
  constructor (data) {
    super();
    this._data = data;
  }

  decodeArchive (archive) {
    return uuidStringify(archive.decode('NS.uuidbytes'));
  }

  encodeArchive (obj, archive) {
    archive._archiveObj['NS.uuidbytes'] = Buffer.from(uuidParse(obj._data).buffer);
  }
}

class XCTCapabilities extends BaseArchiveHandler {
  decodeArchive (archive) {
    return archive.decode('capabilities-dictionary');
  }
}

class NSNull extends BaseArchiveHandler {
  decodeArchive () {
    return null;
  }
}

/**
 * decode and encode Archive of currently known data formats
 */
const UNARCHIVE_CLASS_MAP = {
  DTTapMessagePlist,
  DTSysmonTapMessage: DTTapMessagePlist,
  DTTapHeartbeatMessage: DTTapMessagePlist,
  DTTapMessageArchive: DTTapMessagePlist,
  DTKTraceTapMessage: DTTapMessagePlist,
  ErrorArchive: NSError,
  ExceptionArchive: NSException,
  NSDictionary: DictArchive,
  NSMutableDictionary: DictArchive,
  NSArray: ListArchive,
  NSMutableArray: ListArchive,
  NSMutableSet: ListArchive,
  NSSet: ListArchive,
  NSDate,
  NSError,
  NSException,
  NSMutableString,
  NSMutableData,
  NSNull,
  NSUUID,
  NSURL,
  XCTCapabilities
};

/**
 * Capable of unpacking an archived object tree in the NSKeyedArchive format.
 * Apple's implementation can be found here:
 * https://github.com/apple/swift-corelibs-foundation/blob/main/Sources/Foundation/NSKeyedUnarchiver.swift
 */
class Unarchive {
  constructor (inputBytes) {
    this.input = inputBytes;
    this.unpackedUids = {};
    this.topUID = NULL_UID;
    this.objects = [];
  }

  unpackArchiveHeader () {
    const plist = plistlib.parseBuffer(this.input)[0];
    if (plist.$archiver !== NSKEYEDARCHIVER) {
      throw new Error(`unsupported encoder: ${plist.$archiver}`);
    }
    if (plist.$version !== NSKEYED_ARCHIVE_VERSION) {
      throw new Error(`expected ${NSKEYED_ARCHIVE_VERSION}, got ${plist.$version }`);
    }
    const top = plist.$top;
    const topUID = top.root;
    if (!topUID) {
      throw new Error(`top object did not have a UID! dump: ${JSON.stringify(top)}`);
    }
    this.topUID = topUID;
    this.objects = plist.$objects;
  }

  /**
   * use the UNARCHIVE_CLASS_MAP to find the unarchiving delegate of a uid
   */
  classForUid (index) {
    const meta = this.objects[index.UID];
    const name = meta.$classname;
    const klass = UNARCHIVE_CLASS_MAP[name];
    if (!klass) {
      throw new Error(`no mapping for ${name} in UNARCHIVE_CLASS_MAP`);
    }
    return klass;
  }

  decodeKey (obj, key) {
    const val = obj[key];
    return _.isNil(val?.UID) ? val : this.decodeObject(val);
  }

  decodeObject (index) {
    if (index === NULL_UID) {
      return null;
    }
    const obj = this.unpackedUids[index];
    if (obj === CYCLE_TOKEN) {
      throw new Error(`archive has a cycle with ${index}`);
    }
    if (!_.isUndefined(obj)) {
      return obj;
    }
    const rawObj = this.objects[index.UID];
    this.unpackedUids[index.UID] = CYCLE_TOKEN;

    if (!rawObj?.$class) {
      this.unpackedUids[index.UID] = obj;
      return rawObj;
    }
    const klass = this.classForUid(rawObj.$class);
    const klassObj = new klass().decodeArchive(new ArchivedObject(rawObj, this));
    this.unpackedUids[index.UID] = klassObj;
    return klassObj;
  }

  toObject () {
    this.unpackArchiveHeader();
    return this.decodeObject(this.topUID);
  }
}

/**
 * Capable of packing an object tree into the NSKeyedArchive format.
 * Apple's implementation can be found here:
 * https://github.com/apple/swift-corelibs-foundation/blob/main/Sources/Foundation/NSKeyedArchiver.swift
 */
class Archive {
  constructor (inputObject) {
    this.input = inputObject;
    this.classMap = {};
    this.objects = ['$null']; // objects that go directly into the archive, always start with $null
  }

  uidForArchiver (archiver) {
    let val = this.classMap[archiver];
    if (val) {
      return new plistlib.UID(val);
    }
    this.classMap[archiver] = this.objects.length;
    val = new plistlib.UID(this.objects.length);
    this.objects.push({
      '$classes': [archiver],
      '$classname': archiver
    });
    return val;
  }

  archive (obj) {
    if (_.isUndefined(obj) || _.isNull(obj)) {
      return NULL_UID;
    }
    const index = new plistlib.UID(this.objects.length);
    if (PRIMITIVE_TYPES.includes(obj.constructor.name)) {
      this.objects.push(obj);
      return index;
    }
    const archiveObj = {};
    this.objects.push(archiveObj);
    this.encodeTopLevel(obj, archiveObj);
    return index;
  }

  encode (val) {
    if (NON_ENCODABLE_TYPES.includes(typeof val)) {
      return val;
    }
    return this.archive(val);
  }

  encodeTopLevel (obj, archiveObj) {
    if (obj instanceof Array) {
      return this.encodeArray(obj, archiveObj);
    } else if (obj instanceof Set) {
      return this.encodeSet(obj, archiveObj);
    } else if (obj instanceof Object) {
      const objName = obj.constructor.name;
      // Only special class instance are useful, such as NSURL, NSUUID, NSDate.
      // And this class must also have the encodeArchive method
      if (objName in UNARCHIVE_CLASS_MAP) {
        archiveObj.$class = this.uidForArchiver(objName);
        obj.encodeArchive(obj, new ArchivingObject(archiveObj, this));
      } else {
        return this.encodeDict(obj, archiveObj);
      }
    } else {
      throw Error(`Unable to encode types: ${typeof obj}`);
    }
  }

  encodeArray (objs, archiveObj) {
    archiveObj.$class = this.uidForArchiver('NSArray');
    archiveObj['NS.objects'] = objs.map(this.archive.bind(this));
  }

  encodeSet (objs, archiveObj) {
    archiveObj.$class = this.uidForArchiver('NSSet');
    archiveObj['NS.objects'] = objs.map(this.archive.bind(this));
  }

  encodeDict (obj, archiveObj) {
    archiveObj.$class = this.uidForArchiver('NSDictionary');
    archiveObj['NS.keys'] = _.keys(obj).map(this.archive.bind(this));
    archiveObj['NS.objects'] = _.values(obj).map(this.archive.bind(this));
  }

  toBytes () {
    if (this.objects.length === 1) {
      this.archive(this.input);
    }
    const d = {
      '$version': NSKEYED_ARCHIVE_VERSION,
      '$archiver': NSKEYEDARCHIVER,
      '$top': {'root': new plistlib.UID(1)},
      '$objects': this.objects
    };
    return bplistCreate(d);
  }
}

/**
 * Creates NSKeyed Buffer from an object
 * @param {Object} inputObject
 * @returns {Buffer} NSKeyed Buffer
 */
function archive (inputObject) {
  return new Archive(inputObject).toBytes();
}

/**
 * Parses NSKeyed Buffer into JS Object
 * @param {Buffer} inputBytes NSKeyed Buffer
 * @returns {Object} JS Object
 */
function unarchive (inputBytes) {
  return new Unarchive(inputBytes).toObject();
}

/**
 * Update unknown NSKeyedArchive types for packing/unpacking
 * @param {String} name packing/unpacking key name
 * @param {BaseArchiveHandler} subClass inherit from BaseArchiveHandler class
 */
function updateNSKeyedArchiveClass (name, subClass) {
  if (!_.isFunction(subClass.prototype?.decodeArchive) && !_.isFunction(subClass.prototype?.encodeArchive)) {
    throw Error('subClass must have decodeArchive or encodeArchive methods');
  }
  if (!(name in UNARCHIVE_CLASS_MAP)) {
    UNARCHIVE_CLASS_MAP[name] = subClass;
  }
}

export { updateNSKeyedArchiveClass, BaseArchiveHandler, NSURL, NSUUID, NSDate, unarchive, archive};
