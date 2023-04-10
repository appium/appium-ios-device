import { startHouseArrestService, startTestmanagerdService, startInstallationProxyService, startInstrumentService } from './services';
import { INSTRUMENT_CHANNEL } from './instrument';
import { TESTMANAGERD_CHANNEL } from './testmanagerd';
import { DTXMessageAuxBuffer } from './instrument/headers';
import { NSUUID, XCTestConfiguration } from './instrument/transformer/nskeyed';
import { uuidV4 } from '@appium/support/build/lib/util';
import { getOSVersion } from './utilities';
import log from './logger';
import B from 'bluebird';

class Xctest {
    constructor(udid, xctestBundleId, targetBundleId = undefined, productModuleName = 'WebDriverAgentRunner') {
        this.udid = udid;
        this.running = false;
        this._executing = false;
        this.xctestBundleId = xctestBundleId;
        this.targetBundleId = targetBundleId;
        this.productModuleName = productModuleName;
    }

    async _launchAppRunner(majorVersion, sessionIdentifier) {
        const { PROCESS_CONTROL } = INSTRUMENT_CHANNEL;
        const installation = await startInstallationProxyService(this.udid);
        let lookupResult;
        try {
            await installation.lookupApplications({ bundleIds: [this.xctestBundleId] });
        } finally {
            installation.close();
        }
        const appInfo = lookupResult[this.xctestBundleId];
        if (!appInfo) {
            log.error(`${this.xctestBundleId} not found!`);
            return;
        }
        const signerIdentifier = appInfo.SignerIdentity;
        log.debug('SignerIdentifier:', signerIdentifier);
        const appContainer = appInfo.Container;
        const execName = appInfo.CFBundleExecutable;
        if (!execName.endsWith('-Runner')) {
            log.error('Invalid CFBundleExecutable:', execName);
            return;
        }
        const targetName = execName.substr(0, execName.indexOf('-Runner'));
        const xctestPath = `/tmp/${targetName}-${sessionIdentifier.toUpperCase()}.xctestconfiguration`;
        const xctestConfiguration = new XCTestConfiguration({
            testBundleURL: `file://${appInfo.Path}/PlugIns/${targetName}.xctest`,
            sessionIdentifier,
            targetApplicationBundleID: this.targetBundleId,
            productModuleName: this.productModuleName
        });
        const xctestContent = xctestConfiguration.getBytes();
        const houseArrestService = await startHouseArrestService(this.udid);
        const vendContainer = await houseArrestService.vendContainer(this.xctestBundleId);
        const list = await vendContainer.listDirectory('/tmp');
        for (let file of list) {
            if (file.endsWith('.xctestconfiguration')) {
                log.debug('removing /tmp/' + file);
                await vendContainer.deleteDirectory('/tmp/' + file);
            }
        }
        const stream = await vendContainer.createWriteStream(xctestPath, {});
        await new B((resolve, reject) => {
            stream.write(xctestContent, resolve);
            stream.on('error', reject);
        });
        stream.end();
        vendContainer.close();
        houseArrestService.close();
        const instrumentService = await startInstrumentService(this.udid);
        await instrumentService.callChannel(PROCESS_CONTROL, 'processIdentifierForBundleIdentifier:', this.xctestBundleId);
        const appPath = appInfo.Path;
        const xctestConfigurationPath = appContainer + xctestPath;
        const appEnv = {
            CA_ASSERT_MAIN_THREAD_TRANSACTIONS: '0',
            CA_DEBUG_TRANSACTIONS: '0',
            DYLD_FRAMEWORK_PATH: appPath + '/Frameworks:',
            DYLD_LIBRARY_PATH: appPath + '/Frameworks',
            NSUnbufferedIO: 'YES',
            SQLITE_ENABLE_THREAD_ASSERTIONS: '1',
            WDA_PRODUCT_BUNDLE_IDENTIFIER: '',
            XCTestConfigurationFilePath: xctestConfigurationPath,
            XCODE_DBG_XPC_EXCLUSIONS: 'com.apple.dt.xctestSymbolicator',
            MJPEG_SERVER_PORT: '',
            USE_PORT: '',
            LLVM_PROFILE_FILE: appContainer + '/tmp/%p.profraw',
        };
        if (majorVersion >= 11) {
            appEnv.DYLD_INSERT_LIBRARIES = '/Developer/usr/lib/libMainThreadChecker.dylib';
            appEnv.OS_ACTIVITY_DT_MODE = 'YES';
        }
        const appArgs = [
            '-NSTreatUnknownArgumentsAsOpen', 'NO',
            '-ApplePersistenceIgnoreState', 'YES'
        ];
        const appOptions = { StartSuspendedKey: false };
        if (majorVersion >= 12) {
            appOptions.ActivateSuspended = true;
        }
        const pid = await instrumentService.callChannel(PROCESS_CONTROL,
            'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:',
            appPath, this.xctestBundleId, appEnv, appArgs, appOptions);
        log.info(`Pid of launched ${this.xctestBundleId} ${pid.selector}:`);
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid.selector);
        await instrumentService.callChannel(PROCESS_CONTROL, 'startObservingPid:', msg);
        const logDebug = (message) => {
            log.debug(`instrument output: ${message.auxiliaries[0]}`);
        };
        instrumentService.registerSelectorCallback('_XCT_logDebugMessage', logDebug);
        return { instrumentService, pid: pid.selector };
    }

    async start() {
        if (this.running) {
            log.warn('already running!');
            return;
        }
        this.running = true;
        const { DAEMON_CONNECTION_INTERFACE } = TESTMANAGERD_CHANNEL;
        const productVersion = await getOSVersion(this.udid);
        const majorVersion = parseInt(productVersion.split('.')[0], 10);
        const xcodeVersion = 29;
        const sessionIdentifier = uuidV4();
        //first connection
        this._initialControlSession = await startTestmanagerdService(this.udid);
        if (majorVersion >= 11) {
            const msg = new DTXMessageAuxBuffer();
            msg.appendObject(xcodeVersion);
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionWithProtocolVersion:', msg);
        }

        //second connection
        this._execTestPlanSession = await startTestmanagerdService(this.udid);
        const startExecuting = () => {
            if (this._executing) {
                return;
            }
            this._executing = true;
            const msg = new DTXMessageAuxBuffer();
            msg.appendObject(xcodeVersion);
            this._execTestPlanSession._callChannel(false, 0xFFFFFFFF, '_IDE_startExecutingTestPlanWithProtocolVersion:', msg);
        };
        const showLogMessage = (message) => {
            log.debug(message.auxiliaries[0]);
            if (message.auxiliaries.join('').indexOf('Received test runner ready reply with error: (null') !== -1) {
                log.info('Test runner ready');
                startExecuting();
            }
        };
        this._execTestPlanSession.registerSelectorCallback(
            '_XCT_testBundleReadyWithProtocolVersion:minimumVersion:',
            startExecuting);
        this._execTestPlanSession.registerSelectorCallback('_XCT_logDebugMessage:', showLogMessage);
        let msg = new DTXMessageAuxBuffer();
        msg.appendObject(new NSUUID(sessionIdentifier));
        msg.appendObject(sessionIdentifier + '-746F-006D726964646C79');
        msg.appendObject('/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild');
        msg.appendObject(xcodeVersion);
        await this._execTestPlanSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateSessionWithIdentifier:forClient:atPath:protocolVersion:', msg);

        const { instrumentService, pid } = await this._launchAppRunner(majorVersion, sessionIdentifier);
        this._instrumentService = instrumentService;
        msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid);
        if (majorVersion >= 12) {
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_authorizeTestSessionWithProcessID:', msg);
        } else if (majorVersion <= 9) {
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionForTestProcessID:', msg);
        } else {
            msg.appendObject(xcodeVersion);
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionForTestProcessID:protocolVersion:', msg);
        }
    }

    stop() {
        this._instrumentService?.close();
        this._execTestPlanSession?.close();
        this._initialControlSession?.close();
        this._executing = false;
        this.running = false;
    }
}

export { Xctest };
export default Xctest;