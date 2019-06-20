import path from 'path';
import { fs, logger } from 'appium-support';
import net from 'net';


const log = logger.getLogger('fixtures');

const UDID = '63c3d055c4f83e960e5980fa68be0fbf7d4ba74c';

let fixtureContents;

const fixtures = {
  DEVICE_LIST: 'deviceList',
  DEVICE_LIST_2: 'deviceList2',
  DEVICE_CONNECT: 'deviceConnect',
  LOCKDOWN_GET_VALUE_OS_VERSION: 'lockdownGetValueOsVersion',
  LOCKDOWN_QUERY_TYPE: 'lockdownQueryType',
  SYSLOG_MESSAGES: 'syslogMessage',
};

function getFixturePath (file) {
  return path.resolve(__dirname, '..', '..', '..', 'test', 'fixtures', file);
}

async function initFixtures () {
  if (fixtureContents) {
    return;
  }

  fixtureContents = {
    [fixtures.DEVICE_LIST]: await fs.readFile(getFixturePath('usbmuxlistdevicemessage.bin')),
    [fixtures.DEVICE_LIST_2]: await fs.readFile(getFixturePath('usbmuxlistdevicemessage2.bin')),
    [fixtures.DEVICE_CONNECT]: await fs.readFile(getFixturePath('usbmuxconnectmessage.bin')),
    [fixtures.LOCKDOWN_GET_VALUE_OS_VERSION]: await fs.readFile(getFixturePath('lockdowngetvaluemessage.bin')),
    [fixtures.LOCKDOWN_QUERY_TYPE]: await fs.readFile(getFixturePath('lockdownquerytypemessage.bin')),
    [fixtures.SYSLOG_MESSAGES]: await fs.readFile(getFixturePath('syslogmessages.bin')),
  };
}

async function getServerWithFixtures (...args) {
  await initFixtures();

  const fixturesToUse = args.map((key) => fixtureContents[key]);

  const server = net.createServer();
  server.listen();
  const socket = net.connect(server.address());
  server.on('connection', function (socket) {
    let i = 0;
    socket.on('data', function () {
      if (i < fixturesToUse.length) {
        log.debug(`Writing to socket. Message #${i}`);
        socket.write(fixturesToUse[i++]);
      }
    });
  });
  return {
    server,
    socket,
  };
}


export { getServerWithFixtures, fixtures, UDID };
