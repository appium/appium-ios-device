import B from 'bluebird';
import chai from 'chai';
import SyslogService from '../../lib/syslog';
import { getServerWithFixtures, fixtures } from '../fixtures';


chai.should();

describe('syslog', function () {
  let server;
  let socket;
  let syslogService;

  afterEach(function () {
    syslogService.close();
    if (server) {
      server.close();
    }
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
});
