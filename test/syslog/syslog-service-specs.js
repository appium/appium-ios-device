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
      syslogService.start(resolve);
    });
  });
});
