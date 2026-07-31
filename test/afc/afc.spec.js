import assert from 'node:assert/strict';
import {describe, it, afterEach} from 'node:test';

import {AfcService} from '../../lib/afc';
import {getServerWithFixtures, fixtures} from '../fixtures';

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
    assert.ok(items.includes('Photos'));
  });

  it('should get file info', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.AFC_FILE_INFO_RESPONSE));
    service = new AfcService(socket);
    const info = await service.getFileInfo('Photos');
    assert.strictEqual(info.birthtimeMs, 1494244521000);
    assert.strictEqual(info.blocks, 0);
    assert.strictEqual(info.mtimeMs, 1494244521000);
    assert.strictEqual(info.nlink, 2);
    assert.strictEqual(info.size, 64);
    assert.strictEqual(info.isDirectory(), true);
    assert.strictEqual(info.isFile(), false);
  });
});
