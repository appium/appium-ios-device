import _ from 'lodash';

const MAGIC_NUMBER = Buffer.from('CFA6LPAA');

const AFC_PACKET_HEADER_SIZE = 40;

const Operations = {
  INVALID: 0x00000000,	// Invalid
  STATUS: 0x00000001,	// Status
  DATA: 0x00000002,	// Data
  READ_DIR: 0x00000003,	// ReadDir
  READ_FILE: 0x00000004,	// ReadFile
  WRITE_FILE: 0x00000005,	// WriteFile
  WRITE_PART: 0x00000006,	// WritePart
  TRUNCATE: 0x00000007,	// TruncateFile
  REMOVE_PATH: 0x00000008,	// RemovePath
  MAKE_DIR: 0x00000009,	// MakeDir
  GET_FILE_INFO: 0x0000000A,	// GetFileInfo
  GET_DEVINFO: 0x0000000B,	// GetDeviceInfo
  WRITE_FILE_ATOM: 0x0000000C,	// WriteFileAtomic (tmp file+rename)
  FILE_OPEN: 0x0000000D,	// FileRefOpen
  FILE_OPEN_RES: 0x0000000E,	// FileRefOpenResult
  FILE_READ: 0x0000000F,	// FileRefRead
  FILE_WRITE: 0x00000010,	// FileRefWrite
  FILE_SEEK: 0x00000011,	// FileRefSeek
  FILE_TELL: 0x00000012,	// FileRefTell
  FILE_TELL_RES: 0x00000013,	// FileRefTellResult
  FILE_CLOSE: 0x00000014,	// FileRefClose
  FILE_SET_SIZE: 0x00000015,	// FileRefSetFileSize (ftruncate)
  GET_CON_INFO: 0x00000016,	// GetConnectionInfo
  SET_CON_OPTIONS: 0x00000017,	// SetConnectionOptions
  RENAME_PATH: 0x00000018,	// RenamePath
  SET_FS_BS: 0x00000019,	// SetFSBlockSize (0x800000)
  SET_SOCKET_BS: 0x0000001A,	// SetSocketBlockSize (0x800000)
  FILE_LOCK: 0x0000001B,	// FileRefLock
  MAKE_LINK: 0x0000001C,	// MakeLink
  GET_FILE_HASH: 0x0000001D,	// GetFileHash
  SET_FILE_MOD_TIME: 0x0000001E,	// SetModTime
  GET_FILE_HASH_RANGE: 0x0000001F,	// GetFileHashWithRange
  FILE_SET_IMMUTABLE_HINT: 0x00000020,	// FileRefSetImmutableHint
  GET_SIZE_OF_PATH_CONTENTS: 0x00000021,	// GetSizeOfPathContents
  REMOVE_PATH_AND_CONTENTS: 0x00000022,	// RemovePathAndContents
  DIR_OPEN: 0x00000023,	// DirectoryEnumeratorRefOpen
  DIR_OPEN_RESULT: 0x00000024,	// DirectoryEnumeratorRefOpenResult
  DIR_READ: 0x00000025,	// DirectoryEnumeratorRefRead
  DIR_CLOSE: 0x00000026,	// DirectoryEnumeratorRefClose
  FILE_READ_OFFSET: 0x00000027,	// FileRefReadWithOffset
  FILE_WRITE_OFFSET:	0x00000028	// FileRefWriteWithOffset
};

const Operations_Code = _.invert(Operations);

function operationCode (code) {
  return Operations_Code[code];
}

const Errors = {
  SUCCESS: 0,
  UNKNOWN: 1,
  INVALID_HEADER: 2,
  NO_RESOURCES: 3,
  READ: 4,
  WRITE: 5,
  UNKNOWN_PACKET_TYPE: 6,
  INVALID_ARGUMENT: 7,
  OBJECT_NOT_FOUND: 8,
  OBJECT_IS_DIRECTORY: 9,
  PERMISSION_DENIED: 10,
  NOT_CONNECTED: 11,
  TIMEOUT: 12,
  OVERRUN: 13,
  EOF: 14,
  UNSUPPORTED: 15,
  OBJECT_EXISTS: 16,
  OBJECT_BUSY: 17,
  ON_SPACE_LEFT: 18,
  WOULD_BLOCK: 19,
  IO: 20,
  INTERRUPTED: 21,
  IN_PROGRESS: 22,
  INTERNAL: 23,
};

const Errors_Code = _.invert(Errors);

function errorCode (code) {
  return Errors_Code[code];
}


const FileModes = {
  'r': 0x00000001, // O_RDONLY
  'r+': 0x00000002, // O_RDWR   | O_CREAT
  'w': 0x00000003, // O_WRONLY | O_CREAT  | O_TRUNC
  'w+': 0x00000004, // O_RDWR   | O_CREAT  | O_TRUNC
  'a': 0x00000005, // O_WRONLY | O_APPEND | O_CREAT
  'a+': 0x00000006, // O_RDWR   | O_APPEND | O_CREAT
};

export {
  MAGIC_NUMBER, AFC_PACKET_HEADER_SIZE,
  Operations, operationCode,
  Errors, errorCode, FileModes,
};
