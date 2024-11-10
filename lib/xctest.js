import { startHouseArrestService, startTestmanagerdService, startInstallationProxyService, startInstrumentService } from './services';
import { INSTRUMENT_CHANNEL } from './instrument';
import { DTXMessageAuxBuffer } from './instrument/headers';
import { NSUUID, XCTestConfiguration } from './instrument/transformer/nskeyed';
import { TESTMANAGERD_CHANNEL } from './testmanagerd';
import { util } from '@appium/support';
import { getOSVersion } from './utilities';
import log from './logger';
import B from 'bluebird';

const { DAEMON_CONNECTION_INTERFACE } = TESTMANAGERD_CHANNEL;
const XCTEST_CONFIGURATION_EXTENSION = '.xctestconfiguration';
const TMP_FOLDER_PREFIX = '/tmp';
const XCTEST_EXECUTABLE_SUFFIX = '-Runner';
const MAJOR_IOS_VERSION_9 = 9;
const MAJOR_IOS_VERSION_11 = 11;
const MAJOR_IOS_VERSION_12 = 12;
//This is not related with which xcode user installed but only a marker to use inside device
const XCODE_BUILD_PATH = '/Applications/Xcode.app/Contents/Developer/usr/bin/xcodebuild';
const XCODE_VERSION = 29;
const MAGIC_CHANNEL = 0xFFFFFFFF;
/**
 * @typedef {Object} XCTestConfigurationProperties
 * @property {string?} productModuleName
 * @property {string[]?} targetApplicationArguments
 * @property {string[]?} testsToRun
 * @property {string[]?} testsToSkip
 */

/**
 * @typedef {Object} XctestOption
 * @property {XCTestConfigurationProperties} conf properties to override in XCTestConfiguration
 * @property {object} env key-value pairs to append in xctest app environment
 */

/**
 * Allows invoking pre-installed xctest app from iOS devices. No Xcode installation is required.
 * This class simulates the procedure which xcode uses to invoke xctests.
 */
class Xctest {
    /** @type {import('./testmanagerd').TestmanagerdService|undefined}  */
    _initialControlSession;

    /** @type {import('./testmanagerd').TestmanagerdService|undefined}  */
    _execTestPlanSession;

    /**
     * @param {string} udid Device udid.
     * @param {string} xctestBundleId Bundle Id of xctest app on device. The app must be installed on device.
     * @param {string?} targetBundleId test target bundle id.
     * @param {Partial<XctestOption>} opts addition options to specific XCTestConfiguration and app launch env
     */
    constructor(udid, xctestBundleId, targetBundleId = null, opts = {}) {
        this.udid = udid;
        this.running = false;
        this._executing = false;
        this.xctestBundleId = xctestBundleId;
        this.targetBundleId = targetBundleId;
        this._conf = opts?.conf || {};
        this._env = opts?.env || {};
    }

    /**
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
        // @ts-ignore This works
        const xctestConfiguration = new XCTestConfiguration({
            ...this._conf,
            // properties below should not be override
            testBundleURL: `file://${appInfo.Path}/PlugIns/${targetName}.xctest`,
            sessionIdentifier,
            targetApplicationBundleID: this.targetBundleId,
        });
        await this._writeConfigurationToDevice(xctestConfiguration, xctestPath);
        this._instrumentService = await startInstrumentService(this.udid);
        this._instrumentService.registerLifecycleCallback('close', this.stop.bind(this));
        await this._instrumentService.callChannel(PROCESS_CONTROL, 'processIdentifierForBundleIdentifier:', this.xctestBundleId);
        const appPath = appInfo.Path;
        const xctestConfigurationPath = appContainer + xctestPath;
        const appEnv = {
            CA_ASSERT_MAIN_THREAD_TRANSACTIONS: '0',
            CA_DEBUG_TRANSACTIONS: '0',
            DYLD_FRAMEWORK_PATH: `${appPath}/Frameworks:`,
            DYLD_LIBRARY_PATH: `${appPath}/Frameworks`,
            NSUnbufferedIO: 'YES',
            SQLITE_ENABLE_THREAD_ASSERTIONS: '1',
            WDA_PRODUCT_BUNDLE_IDENTIFIER: '',
            XCTestConfigurationFilePath: xctestConfigurationPath,
            XCODE_DBG_XPC_EXCLUSIONS: 'com.apple.dt.xctestSymbolicator',
            MJPEG_SERVER_PORT: '',
            USE_PORT: '',
            // %p means pid
            LLVM_PROFILE_FILE: `${appContainer}/tmp/%p.profraw`,
            ...this._env
        };
        if (majorVersion >= MAJOR_IOS_VERSION_11) {
            appEnv.DYLD_INSERT_LIBRARIES = '/Developer/usr/lib/libMainThreadChecker.dylib';
            appEnv.OS_ACTIVITY_DT_MODE = 'YES';
        }
        const appArgs = [
            '-NSTreatUnknownArgumentsAsOpen', 'NO',
            '-ApplePersistenceIgnoreState', 'YES'
        ];
        const appOptions = { StartSuspendedKey: false };
        if (majorVersion >= MAJOR_IOS_VERSION_12) {
            appOptions.ActivateSuspended = true;
            appOptions.__ActivateSuspended = true;
        }
        const launchResult = await this._instrumentService.callChannel(PROCESS_CONTROL,
            'launchSuspendedProcessWithDevicePath:bundleIdentifier:environment:arguments:options:',
            appPath, this.xctestBundleId, appEnv, appArgs, appOptions);
        const pid = launchResult.selector;
        if (typeof pid !== 'number') {
            throw new Error(`Failed on launching ${this.xctestBundleId}: ${launchResult}`);
        }
        log.info(`Pid of launched ${this.xctestBundleId}: ${pid}`);
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid);
        await this._instrumentService.callChannel(PROCESS_CONTROL, 'startObservingPid:', msg);
        return pid;
    }

    /**
     * @param {XCTestConfiguration} xctestConfiguration plist contains
     * @param {string} xctestPath where xctestConfiguration should be place in app sandbox.
     */
    async _writeConfigurationToDevice(xctestConfiguration, xctestPath) {
        const xctestContent = xctestConfiguration.getBytes();
        const houseArrestService = await startHouseArrestService(this.udid);
        let vendContainer;
        let stream;
        try {
            vendContainer = await houseArrestService.vendContainer(this.xctestBundleId);
            const list = await vendContainer.listDirectory(TMP_FOLDER_PREFIX);
            for (const file of list) {
                if (file.endsWith(XCTEST_CONFIGURATION_EXTENSION)) {
                    const fullPath = `${TMP_FOLDER_PREFIX}/${file}`;
                    log.debug(`removing ${fullPath}`);
                    await vendContainer.deleteDirectory(fullPath);
                }
            }
            stream = await vendContainer.createWriteStream(xctestPath, {});
            await new B((resolve, reject) => {
                stream.write(xctestContent, resolve);
                stream.on('error', reject);
            });
        } finally {
            stream?.end();
            vendContainer?.close();
            houseArrestService.close();
        }
    }

    async _startInitialSession(majorVersion) {
        this._initialControlSession = await startTestmanagerdService(this.udid);
        this._initialControlSession.registerLifecycleCallback('close', this.stop.bind(this));
        if (majorVersion < MAJOR_IOS_VERSION_11) {
            return;
        }
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(XCODE_VERSION);
        await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE,
            '_IDE_initiateControlSessionWithProtocolVersion:', msg);
    }

    async _startExecSession(sessionIdentifier) {
        this._execTestPlanSession = await startTestmanagerdService(this.udid);
        this._execTestPlanSession.registerLifecycleCallback('close', this.stop.bind(this));
        const startExecuting = () => {
            if (this._executing) {
                return;
            }
            this._executing = true;
            const msg = new DTXMessageAuxBuffer();
            msg.appendObject(XCODE_VERSION);
            // @ts-ignore _execTestPlanSession must be defined here
            this._execTestPlanSession._callChannel(false, MAGIC_CHANNEL, '_IDE_startExecutingTestPlanWithProtocolVersion:', msg);
        };
        const showLogMessage = (message) => {
            if (message.auxiliaries.join('').includes('Received test runner ready reply with error: (null')) {
                log.info('Test runner ready');
                //A magic thing is that if not using a delay this would fail on iPhone7 iOS 13.6.1
                setTimeout(() => startExecuting(), 1000);
            }
        };
        this._execTestPlanSession.registerSelectorCallback('_XCT_testBundleReadyWithProtocolVersion:minimumVersion:', startExecuting);
        this._execTestPlanSession.registerSelectorCallback('_XCT_logDebugMessage:', showLogMessage);
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(new NSUUID(sessionIdentifier));
        msg.appendObject(`${sessionIdentifier}-746F-006D726964646C79`);
        msg.appendObject(XCODE_BUILD_PATH);
        msg.appendObject(XCODE_VERSION);
        await this._execTestPlanSession.callChannel(DAEMON_CONNECTION_INTERFACE,
            '_IDE_initiateSessionWithIdentifier:forClient:atPath:protocolVersion:', msg);
    }

    async _notifyTestProcessId(pid, majorVersion) {
        const msg = new DTXMessageAuxBuffer();
        msg.appendObject(pid);
        if (majorVersion >= MAJOR_IOS_VERSION_12) {
            // @ts-ignore _initialControlSession must be defined here
            return await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE,
                '_IDE_authorizeTestSessionWithProcessID:', msg);
        }
        if (majorVersion <= MAJOR_IOS_VERSION_9) {
            // @ts-ignore _initialControlSession must be defined here
            return await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE,
                '_IDE_initiateControlSessionForTestProcessID:', msg);
        }
        msg.appendObject(XCODE_VERSION);
        // @ts-ignore _initialControlSession must be defined here
        return await this._initialControlSession.callChannel(DAEMON_CONNECTION_INTERFACE,
            '_IDE_initiateControlSessionForTestProcessID:protocolVersion:', msg);
    }

    /**
     * Start xctest process. If this method has been called before and the `stop()` method has not been called,
     * calling this again would return directly.
     * @throws If xctest bundle id invalid or not installed.
     */
    async start() {
        if (this.running) {
            const targetMessage = this.targetBundleId ? `(targeting ${this.targetBundleId})` : '';
            const message = `Xctest for ${this.xctestBundleId}${targetMessage} on device ${this.udid} is already running!`;
            log.info(`${message} Doing nothing here`);
            return;
        }
        this.running = true;
        try {
            const productVersion = await getOSVersion(this.udid);
            const majorVersion = parseInt(productVersion.split('.')[0], 10);
            const sessionIdentifier = util.uuidV4();
            //first connection
            await this._startInitialSession(majorVersion);

            //second connection
            await this._startExecSession(sessionIdentifier);

            const pid = await this._launchAppRunner(majorVersion, sessionIdentifier);
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
        if (!this.running) {
            // not started or already called `stop()`
            return;
        }
        this.running = false;
        this._instrumentService?.close();
        this._instrumentService?.dispose();
        this._instrumentService = undefined;
        this._execTestPlanSession?.close();
        this._execTestPlanSession?.dispose();
        this._execTestPlanSession = undefined;
        this._initialControlSession?.close();
        this._initialControlSession?.dispose();
        this._initialControlSession = undefined;
        this._executing = false;
        const targetMessage = this.targetBundleId ? `(targeting ${this.targetBundleId})` : '';
        const message = `Xctest for ${this.xctestBundleId}${targetMessage} on device ${this.udid} has stopped!`;
        log.debug(message);
    }
}

export { Xctest };
export default Xctest;
