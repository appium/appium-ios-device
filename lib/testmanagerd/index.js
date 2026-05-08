import {InstrumentService} from '../instrument';

export const TESTMANAGERD_SERVICE_NAME_VERSION_14 = 'com.apple.testmanagerd.lockdown.secure';
export const TESTMANAGERD_SERVICE_NAME = 'com.apple.testmanagerd.lockdown';

export const TESTMANAGERD_CHANNEL = Object.freeze({
  DAEMON_CONNECTION_INTERFACE:
    'dtxproxy:XCTestManager_IDEInterface:XCTestManager_DaemonConnectionInterface',
});

export class TestmanagerdService extends InstrumentService {}

