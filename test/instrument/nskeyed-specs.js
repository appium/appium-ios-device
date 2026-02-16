import {unarchive, archive, NSURL, NSUUID, NSDate} from '../../lib/instrument/transformer/nskeyed';
import {util} from '@appium/support';

describe('NSKeyedArchive', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    chai.should();
  });

  it('should parses JavaScript objects into iOS NSKeyedArchive data', function () {
    const data = {
      ur: 1000,
      bm: 0,
      procAttrs: [
        'memVirtualSize',
        'cpuUsage',
        'procStatus',
        'appSleep',
        'uid',
        'vmPageIns',
        'memRShrd',
        'ctxSwitch',
        'memCompressed',
        'intWakeups',
        'cpuTotalSystem',
        'responsiblePID',
        'physFootprint',
        'cpuTotalUser',
        'sysCallsUnix',
        'memResidentSize',
        'sysCallsMach',
        'memPurgeable',
        'diskBytesRead',
        'machPortCount',
        '__suddenTerm',
        '__arch',
        'memRPrvt',
        'msgSent',
        'ppid',
        'threadCount',
        'memAnon',
        'diskBytesWritten',
        'pgid',
        'faults',
        'msgRecv',
        '__restricted',
        'pid',
        '__sandbox',
      ],
      sysAttrs: [
        'diskWriteOps',
        'diskBytesRead',
        'diskBytesWritten',
        'threadCount',
        'vmCompressorPageCount',
        'vmExtPageCount',
        'vmFreeCount',
        'vmIntPageCount',
        'vmPurgeableCount',
        'netPacketsIn',
        'vmWireCount',
        'netBytesIn',
        'netPacketsOut',
        'diskReadOps',
        'vmUsedCount',
        '__vmSwapUsage',
        'netBytesOut',
      ],
      cpuUsage: true,
      sampleInterval: 100000000,
    };
    const archiveData = archive(data);
    const unArchiveData = unarchive(archiveData);
    unArchiveData.should.to.deep.equal(data);
  });

  it('NSKeyedArchive encode/decode for NSURL', function () {
    const file = 'file://PlugIns/WebDriverAgentRunner.xctest';
    const data = {NSURL: new NSURL(null, file)};
    const archiveData = archive(data);
    const unArchiveData = unarchive(archiveData);
    unArchiveData.NSURL.relative.should.be.equal(file);
  });

  it('NSKeyedArchive encode/decode for NSUUID', function () {
    const uuid = util.uuidV4();
    const data = {NSUUID: new NSUUID(uuid)};
    const archiveData = archive(data);
    const unArchiveData = unarchive(archiveData);
    unArchiveData.NSUUID.should.be.equal(uuid);
  });

  it('NSKeyedArchive encode/decode for NSDate', function () {
    const date = parseInt(Date.now() / 1000, 10);
    const data = {NSDate: new NSDate(date)};
    const archiveData = archive(data);
    const unArchiveData = unarchive(archiveData);
    unArchiveData.NSDate.should.be.equal(date);
  });
});
