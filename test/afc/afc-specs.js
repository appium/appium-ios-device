import chai from 'chai';
import AfcService from '../../lib/afc';
import { getServerWithFixtures, fixtures } from '../fixtures';


chai.should();

describe('afc', function () {
  let server;
  let socket;
  let service;

  afterEach(function () {
    service.close();
    if (server) {
      server.close();
    }
  });

  it('should create directory', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_SUCCESS_RESPONSE));
    service = new AfcService(socket);
    await service.createDirectory('something');
  });

  it('should delete directory', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_SUCCESS_RESPONSE));
    service = new AfcService(socket);
    await service.deleteDirectory('something');
  });

  it('should list directory', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_LIST_DIR_RESPONSE));
    service = new AfcService(socket);
    const items = await service.listDirectory('/');
    items.should.contain('Photos');
  });

  it('should get file info', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_FILE_INFO_RESPONSE));
    service = new AfcService(socket);
    const info = await service.getFileInfo('Photos');
    info.st_birthtime.should.be.equal('1494244521000000000');
    info.st_blocks.should.be.equal('0');
    info.st_ifmt.should.be.equal('S_IFDIR');
    info.st_mtime.should.be.equal('1494244521000000000');
    info.st_nlink.should.be.equal('2');
    info.st_size.should.be.equal('64');
  });
});
