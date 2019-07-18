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
});
