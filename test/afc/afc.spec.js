import {AfcService} from '../../lib/afc';
import {getServerWithFixtures, fixtures} from '../fixtures';
import {describe, it, afterEach} from 'node:test';
import {expect} from 'chai';

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
    expect(items).to.contain('Photos');
  });

  it('should get file info', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_FILE_INFO_RESPONSE));
    service = new AfcService(socket);
    const info = await service.getFileInfo('Photos');
    expect(info.birthtimeMs).to.be.equal(1494244521000);
    expect(info.blocks).to.be.equal(0);
    expect(info.mtimeMs).to.be.equal(1494244521000);
    expect(info.nlink).to.be.equal(2);
    expect(info.size).to.be.equal(64);
    expect(info.isDirectory()).to.be.equal(true);
    expect(info.isFile()).to.be.equal(false);
  });
});
