import B from 'bluebird';
import chai from 'chai';
import SyslogService from '../../lib/syslog';
import { getServerWithFixtures, fixtures } from '../fixtures';
import { unescape } from '../../lib/syslog/transformer/syslog-decoder';


chai.should();

describe('syslog', function () {
  let server;
  let socket;
  let syslogService;

  afterEach(function () {
    syslogService?.close();
    server?.close();
  });

  it('should wait for first syslog message', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.SYSLOG_MESSAGES));
    syslogService = new SyslogService(socket);
    await new B((resolve) => {
      let count = 0;
      syslogService.start((line) => {
        // Send fake data to get more from the server
        socket.write('fake');
        if (++count === 3) {
          resolve(line);
        }
      });
    });
  });

  it('should wait for syslog split messages', async function () {
    ({server, socket} = await getServerWithFixtures(fixtures.SYSLOG_SPLIT_MESSAGE_1, fixtures.SYSLOG_SPLIT_MESSAGE_2));
    syslogService = new SyslogService(socket);
    await new B((resolve) => {
      let count = 0;
      syslogService.start((line) => {
        // Send fake data to get more from the server
        socket.write('fake');
        if (++count === 3) {
          resolve(line);
        }
      });
    });
  });

  it('should properly unescape Unicode characters from the log', function () {
    const result = unescape(Buffer.from('C\\M-C\\M-3 Th\\M-a\\M-;\\M^C B\\M-a\\M-:\\M-!n Quan T\\M-C\\M-"m', 'utf8'));
    result.should.eql('Có Thể Bạn Quan Tâm');
  });
});
