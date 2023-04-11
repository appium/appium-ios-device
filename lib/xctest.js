import { startHouseArrestService, startTestmanagerdService, startInstallationProxyService, startInstrumentService } from './services';
import { INSTRUMENT_CHANNEL } from './instrument';
import { TESTMANAGERD_CHANNEL } from './testmanagerd';
import { DTXMessageAuxBuffer } from './instrument/headers';
import { NSUUID, XCTestConfiguration } from './instrument/transformer/nskeyed';
import { uuidV4 } from '@appium/support/build/lib/util';
import { getOSVersion } from './utilities';
import log from './logger';
import B from 'bluebird';

const { DAEMON_CONNECTION_INTERFACE } = TESTMANAGERD_CHANNEL;
const XCTEST_CONFIGURATION_EXTENSION = '.xctestconfiguration';
const XCODE_VERSION = 29;
const TMP_FOLDER_PREFIX = '/tmp';
const XCTEST_EXECUTABLE_SUFFIX = '-Runner';
const MAJOR_VERSION_9 = 9;
const MAJOR_VERSION_11 = 11;
const MAJOR_VERSION_12 = 12;
/**
 * Allow invoking pre-installed xctest app from iOS devices. No xcode installation is requested.
 * This class simulate the procedure which xcode uses to invoke xctests.
 */
class Xctest {
    /**
     * @param {string} udid Device udid.
     * @param {string} xctestBundleId Bundle Id of xctest app on device. The app must be installed on device.
     * @param {string?} targetBundleId test target bundle id.
     * @param {string?} productModuleName just to identify.
     */
    constructor(udid, xctestBundleId, targetBundleId = null, productModuleName = 'WebDriverAgentRunner') {
        this.udid = udid;
        this.running = false;
        this._executing = false;
        this.xctestBundleId = xctestBundleId;
        this.targetBundleId = targetBundleId;
        this.productModuleName = productModuleName;
    }

    /**
     * @private
     * @param {number} majorVersion first part of iOS version 9/10/11/12/13/14/15/16
     * @param {string} sessionIdentifier uuid with format: 00000000-0000-0000-0000-000000000000
     */
    async _launchAppRunner(majorVersion, sessionIdentifier) {
        const { PROCESS_CONTROL } = INSTRUMENT_CHANNEL;
        const installation = await startInstallationProxyService(this.udid);
        let lookupResult;
        try {
            lookupResult = await installation.lookupApplications({ bundleIds: [this.xctestBundleId] });
        } finally {
            installation.close();
        }
        const appInfo = lookupResult[this.xctestBundleId];
        if (!appInfo) {
            throw new Error(`${this.xctestBundleId} not found on device ${this.udid}`);
        }
        const signerIdentifier = appInfo.SignerIdentity;
        log.info(`SignerIdentifier: ${signerIdentifier}`);
        const appContainer = appInfo.Container;
        const execName = appInfo.CFBundleExecutable;
        if (!execName.endsWith(XCTEST_EXECUTABLE_SUFFIX)) {
            throw new Error(`Invalid CFBundleExecutable ${execName} from ${this.xctestBundleId}, is this bundle a valid xctest app?`);
        }
        const targetName = execName.substr(0, execName.indexOf(XCTEST_EXECUTABLE_SUFFIX));
        const xctestPath = `${TMP_FOLDER_PREFIX}/${targetName}-${sessionIdentifier.toUpperCase()}${XCTEST_CONFIGURATION_EXTENSION}`;
        const xctestConfiguration = new XCTestConfiguration({
            testBundleURL: `file://${appInfo.Path}/PlugIns/${targetName}.xctest`,
            sessionIdentifier,
            targetApplicationBundleID: this.targetBundleId,
            productModuleName: this.productModuleName
        });
        await this._writeConfigurationToDevice(xctestConfiguration, xctestPath);
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
            // %p means pid
            LLVM_PROFILE_FILE: appContainer + '/tmp/%p.profraw',
        };
        if (majorVersion >= MAJOR_VERSION_11) {
            appEnv.DYLD_INSERT_LIBRARIES = '/Developer/usr/lib/libMainThreadChecker.dylib';
            appEnv.OS_ACTIVITY_DT_MODE = 'YES';
        }
        const appArgs = [
            '-NSTreatUnknownArgumentsAsOpen', 'NO',
            '-ApplePersistenceIgnoreState', 'YES'
        ];
        const appOptions = { StartSuspendedKey: false };
        if (majorVersion >= MAJOR_VERSION_12) {
            appOptions.ActivateSuspended = true;
        }
        const pid = await instrumentService.callChannel(PROCESS_CONTROL,
            'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:',
            appPath, this.xctestBundleId, appEnv, appArgs, appOptions);
        log.info(`Pid of launched ${this.xctestBundleId}: ${pid.selector}`);
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid.selector);
        await instrumentService.callChannel(PROCESS_CONTROL, 'startObservingPid:', msg);
        const logDebug = (message) => {
            log.debug(`instrument output: ${message.auxiliaries?.[0]}`);
        };
        instrumentService.registerSelectorCallback('_XCT_logDebugMessage', logDebug);
        return { instrumentService, pid: pid.selector };
    }

    /**
     * @private
     * @param {XCTestConfiguration} xctestConfiguration plist contains
     * @param {string} xctestPath where xctestConfiguration should be place in app sandbox.
     */
    async _writeConfigurationToDevice(xctestConfiguration, xctestPath) {
        const xctestContent = xctestConfiguration.getBytes();
        const houseArrestService = await startHouseArrestService(this.udid);
        const vendContainer = await houseArrestService.vendContainer(this.xctestBundleId);
        const list = await vendContainer.listDirectory(TMP_FOLDER_PREFIX);
        for (const file of list) {
            if (file.endsWith(XCTEST_CONFIGURATION_EXTENSION)) {
                const fullPath = `${TMP_FOLDER_PREFIX}/${file}`;
                log.debug(`removing ${fullPath}`);
                await vendContainer.deleteDirectory(fullPath);
            }
        }
        const stream = await vendContainer.createWriteStream(xctestPath, {});
        try {
            await new B((resolve, reject) => {
                stream.write(xctestContent, resolve);
                stream.on('error', reject);
            });
        } finally {
            stream.end();
            vendContainer.close();
            houseArrestService.close();
        }
    }

    async _startInitialSession(majorVersion) {
        this._initialControlSession = await startTestmanagerdService(this.udid);
        if (majorVersion >= MAJOR_VERSION_11) {
            const msg = new DTXMessageAuxBuffer();
            msg.appendObject(XCODE_VERSION);
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionWithProtocolVersion:', msg);
        }
    }

    async _startExecSession(sessionIdentifier) {
        this._execTestPlanSession = await startTestmanagerdService(this.udid);
        const startExecuting = () => {
            if (this._executing) {
                return;
            }
            this._executing = true;
            const msg = new DTXMessageAuxBuffer();
            msg.appendObject(XCODE_VERSION);
            this._execTestPlanSession._callChannel(false, 0xFFFFFFFF, '_IDE_startExecutingTestPlanWithProtocolVersion:', msg);
        };
        const showLogMessage = (message) => {
            log.debug(message.auxiliaries[0]);
            if (message.auxiliaries.join('').indexOf('Received test runner ready reply with error: (null') !== -1) {
                log.info('Test runner ready');
                //A magic thing is that if not using a delay this would fail on iPhone7 iOS 13.6.1
                setTimeout(() => startExecuting(), 1000);
            }
        };
        this._execTestPlanSession.registerSelectorCallback('_XCT_testBundleReadyWithProtocolVersion:minimumVersion:', startExecuting);
        this._execTestPlanSession.registerSelectorCallback('_XCT_logDebugMessage:', showLogMessage);
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(new NSUUID(sessionIdentifier));
        msg.appendObject(sessionIdentifier + '-746F-006D726964646C79');
        msg.appendObject('/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild');
        msg.appendObject(XCODE_VERSION);
        await this._execTestPlanSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateSessionWithIdentifier:forClient:atPath:protocolVersion:', msg);
    }

    async _notifyTestProcessId(pid, majorVersion) {
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid);
        if (majorVersion >= MAJOR_VERSION_12) {
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_authorizeTestSessionWithProcessID:', msg);
        } else if (majorVersion <= MAJOR_VERSION_9) {
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionForTestProcessID:', msg);
        } else {
            msg.appendObject(XCODE_VERSION);
            await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE, '_IDE_initiateControlSessionForTestProcessID:protocolVersion:', msg);
        }
    }

    /**
     * Start xctest process. If this method has been called before and the `stop()` method has not been called, calling this again would return directly.
     * @throws If xctest bundle id invalid or not installed.
     */
    async start() {
        if (this.running) {
            log.info(`Xctest for ${this.xctestBundleId}(targeting ${this.targetBundleId}) on device ${this.udid} is already running! Doing nothing here`);
            return;
        }
        this.running = true;
        try {
            const productVersion = await getOSVersion(this.udid);
            const majorVersion = parseInt(productVersion.split('.')[0], 10);
            const sessionIdentifier = uuidV4();
            //first connection
            await this._startInitialSession(majorVersion);

            //second connection
            await this._startExecSession(sessionIdentifier);

            const { instrumentService, pid } = await this._launchAppRunner(majorVersion, sessionIdentifier);
            this._instrumentService = instrumentService;
            await this._notifyTestProcessId(pid, majorVersion);
        } catch (e) {
            this.stop();
            throw e;
        }
    }

    /**
     * Stop xctest process.
     */
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