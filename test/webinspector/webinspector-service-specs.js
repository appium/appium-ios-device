import chai from 'chai';
import B from 'bluebird';
import semver from 'semver';
import WebInspectorService from '../../lib/webinspector';
import { getServerWithFixtures, fixtures } from '../fixtures';


chai.should();

describe('webinspector', function () {
  let server;
  let socket;
  let webInspectorService;

  afterEach(function () {
    if (webInspectorService) {
      webInspectorService.close();
    }
    if (server) {
      server.close();
    }
  });

  it('should receive webinspector WIRFinalMessageKey messages back', async function () {
    const version = semver.coerce('10.2.0');
    ({server, socket} = await getServerWithFixtures(fixtures.WEBINSPECTOR_PARTIAL_MESSAGES));
    webInspectorService = new WebInspectorService({
      majorOsVersion: version.major,
      isSimulator: true,
      socketChunkSize: undefined,
      verbose: true,
      verboseHexDump: false,
      socketClient: socket,
    });
    let obj = {__argument: {WIRConnectionIdentifierKey: '990cc163-d8b2-4d22-8d1c-644e100a5a07'}, __selector: '_rpc_reportIdentifier:'};
    webInspectorService.sendMessage(obj);
    await new B((resolve) => {
      webInspectorService.listenMessage(resolve);
    });
  });
  it('should receive webinspector ios 11 and above messages back', async function () {
    const version = semver.coerce('12.2.0');
    ({server, socket} = await getServerWithFixtures(fixtures.WEBINSPECTOR_MESSAGES));
    webInspectorService = new WebInspectorService({
      majorOsVersion: version.major,
      isSimulator: true,
      socketChunkSize: undefined,
      verbose: true,
      verboseHexDump: false,
      socketClient: socket,
    });
    let obj = {__argument: {WIRConnectionIdentifierKey: '990cc163-d8b2-4d22-8d1c-644e100a5a07'}, __selector: '_rpc_reportIdentifier:'};
    webInspectorService.sendMessage(obj);
    await new B((resolve) => {
      webInspectorService.listenMessage(resolve);
    });
  });
});
