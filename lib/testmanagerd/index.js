import { InstrumentService } from '../instrument';

const TESTMANAGERD_SERVICE_NAME_VERSION_14 = 'com.apple.testmanagerd.lockdown.secure';
const TESTMANAGERD_SERVICE_NAME = 'com.apple.testmanagerd.lockdown';

const TESTMANAGERD_CHANNEL = Object.freeze({
    DAEMON_CONNECTION_INTERFACE: 'dtxproxy:XCTestManager_IDEInterface:XCTestManager_DaemonConnectionInterface',
});


class TestmanagerdService extends InstrumentService {

}

export { TestmanagerdService, TESTMANAGERD_SERVICE_NAME_VERSION_14, TESTMANAGERD_SERVICE_NAME, TESTMANAGERD_CHANNEL };