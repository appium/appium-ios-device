import path from 'node:path';
import {once} from 'node:events';
import {fs, logger, node} from '@appium/support';
import net from 'node:net';

const log = logger.getLogger('fixtures');

export const UDID = '63c3d055c4f83e960e5980fa68be0fbf7d4ba74c';
const FIXTURE_ROOT = path.resolve(
  /** @type {string} */ (node.getModuleRootSync('appium-ios-device', __filename)),
  'test',
  'fixtures',
);

let fixtureContents;

export const fixtures = {
  DEVICE_LIST: 'deviceList',
  DEVICE_LIST_2: 'deviceList2',
  DEVICE_CONNECT: 'deviceConnect',
  USBMUX_TO_LOCKDOWN: 'usbmuxToLockdown',
  LOCKDOWN_GET_VALUE_OS_VERSION: 'lockdownGetValueOsVersion',
  LOCKDOWN_GET_VALUE_TIME: 'lockdownGetValueTime',
  LOCKDOWN_QUERY_TYPE: 'lockdownQueryType',
  SYSLOG_MESSAGES: 'syslogMessage',
  SYSLOG_SPLIT_MESSAGE_1: 'syslogSplitMessage1',
  SYSLOG_SPLIT_MESSAGE_2: 'syslogSplitMessage2',
  WEBINSPECTOR_MESSAGES: 'webinspector',
  WEBINSPECTOR_PARTIAL_MESSAGES: 'webinspectorPartialMessages',
  INSTALLATION_PROXY_LIST_MESSAGE: 'installationProxyListMessage',
  INSTALLATION_PROXY_INSTALL_MESSAGE: 'installationProxyInstallMessage',
  AFC_SUCCESS_RESPONSE: 'afcSuccessResponse',
  AFC_LIST_DIR_RESPONSE: 'afcListDirResponse',
  AFC_FILE_INFO_RESPONSE: 'afcFileInfoResponse',
  INSTRUMENTS_LAUNCH_APP: 'instrumentsLaunchApp',
  INSTRUMENTS_FPS: 'instrumentsFps',
};

export async function getServerWithFixtures(...args) {
  await initFixtures();

  const fixturesToUse = args.map((key) => fixtureContents[key]);

  const server = net.createServer();
  server.on('connection', function (clientSocket) {
    let i = 0;
    clientSocket.on('data', function () {
      if (i < fixturesToUse.length) {
        log.debug(`Writing to socket. Message #${i}`);
        clientSocket.write(fixturesToUse[i++]);
      }
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const {port, address} = /** @type {import('node:net').AddressInfo} */ (server.address());
  const socket = net.connect(port, address);
  return {
    server,
    socket,
  };
}

function getFixturePath(file) {
  return path.join(FIXTURE_ROOT, file);
}

async function initFixtures() {
  if (fixtureContents) {
    return;
  }

  fixtureContents = {
    [fixtures.DEVICE_LIST]: await fs.readFile(getFixturePath('usbmuxlistdevicemessage.bin')),
    [fixtures.DEVICE_LIST_2]: await fs.readFile(getFixturePath('usbmuxlistdevicemessage2.bin')),
    [fixtures.DEVICE_CONNECT]: await fs.readFile(getFixturePath('usbmuxconnectmessage.bin')),
    [fixtures.USBMUX_TO_LOCKDOWN]: await fs.readFile(
      getFixturePath('usbmuxconnectandlockdown.bin'),
    ),
    [fixtures.LOCKDOWN_GET_VALUE_OS_VERSION]: await fs.readFile(
      getFixturePath('lockdowngetvaluemessage.bin'),
    ),
    [fixtures.LOCKDOWN_GET_VALUE_TIME]: await fs.readFile(
      getFixturePath('lockdowngettimemessage.bin'),
    ),
    [fixtures.LOCKDOWN_QUERY_TYPE]: await fs.readFile(
      getFixturePath('lockdownquerytypemessage.bin'),
    ),
    [fixtures.SYSLOG_MESSAGES]: await fs.readFile(getFixturePath('syslogmessages.bin')),
    [fixtures.SYSLOG_SPLIT_MESSAGE_1]: await fs.readFile(
      getFixturePath('syslogsplitmessages1.bin'),
    ),
    [fixtures.SYSLOG_SPLIT_MESSAGE_2]: await fs.readFile(
      getFixturePath('syslogsplitmessages2.bin'),
    ),
    [fixtures.WEBINSPECTOR_PARTIAL_MESSAGES]: await fs.readFile(
      getFixturePath('webinspectorpartialmessages.bin'),
    ),
    [fixtures.WEBINSPECTOR_MESSAGES]: await fs.readFile(getFixturePath('webinspectormessages.bin')),
    [fixtures.INSTALLATION_PROXY_LIST_MESSAGE]: await fs.readFile(
      getFixturePath('installationproxylistmessage.bin'),
    ),
    [fixtures.INSTALLATION_PROXY_INSTALL_MESSAGE]: await fs.readFile(
      getFixturePath('installationproxyinstallmessage.bin'),
    ),
    [fixtures.AFC_SUCCESS_RESPONSE]: await fs.readFile(getFixturePath('afcsuccessresponse.bin')),
    [fixtures.AFC_LIST_DIR_RESPONSE]: await fs.readFile(getFixturePath('afclistdirresponse.bin')),
    [fixtures.AFC_FILE_INFO_RESPONSE]: await fs.readFile(getFixturePath('afcfileinforesponse.bin')),
    [fixtures.INSTRUMENTS_LAUNCH_APP]: await fs.readFile(
      getFixturePath('instrumentslaunchapp.bin'),
    ),
    [fixtures.INSTRUMENTS_FPS]: await fs.readFile(getFixturePath('instrumentsfps.bin')),
  };
}
