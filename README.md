# appium-ios-device

[![NPM version](http://img.shields.io/npm/v/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)
[![Downloads](http://img.shields.io/npm/dm/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)

[![Release](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml/badge.svg)](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml)

Appium API for dealing with iOS devices. This is mainly a rewrite of libimobiledevice in nodejs. The APIs allow Appium to talk directly to the phone over usbmuxd

More information can be found at the links below:

* [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice)
* [iPhone Wiki](https://www.theiphonewiki.com/)

*Note*: Issue tracking for this repo has been disabled. Please use the [main Appium issue tracker](https://github.com/appium/appium/issues) instead.

## Usage

This module should be used over the `utilities` and `services` modules or exported classes in documents due to the complexity of iOS communication. When a new services is implemented, it should be added and made available over the `services` module.

### Methods

* `utilities.getConnectedDevices`
* `utilities.getOSVersion`
* `utilities.getDeviceTime`
* `utilities.getDeviceName`
* `utilities.getDeviceInfo`
* `utilities.startLockdownSession`
* `utilities.connectPort`
* `utilities.connectPortSSL`
* `services.startSyslogService`
* `services.startWebInspectorService`
* `services.startInstallationProxyService`
* `services.startSimulateLocationService`
* `services.startAfcService`
* `services.startNotificationProxyService`
* `services.startHouseArrestService`
* `services.startInstrumentService`
* `services.startTestmanagerdService`
* `services.startMCInstallService`

### Classes

* `Xctest`
  * Allows invoking pre-installed xctest app from iOS devices. No Xcode installation is required.
This class simulates the procedure which Xcode uses to invoke xctests.
  * `new Xctest(udid, xctestBundleId, targetBundleId, productModuleName)`
    * `udid` - `string` Device udid.
    * `xctestBundleId` - `string` - Bundle Id of xctest app on device. The app must be installed on device.
    * `targetBundleId` - `string` - Test target bundle id. `null` by default.
    * `opts` - addition options to specific XCTestConfiguration and app launch env.
      * `conf` - properties to override in XCTestConfiguration
        * `productModuleName` - `string | null`
        * `targetApplicationArguments` - `string[] | null`
        * `testsToRun` - `string[] | null`
        * `testsToSkip` - `string[] | null`
      * `env` - `object` - key-value pairs to append in xctest app environment
  * `xctest.start()`
    * Start xctest process. If this method has been called before and the `stop()` method has not been called, calling this again would return directly.
    * **Throws**: If xctest bundle id invalid or not installed.
  * `xctest.stop()`
    * Stop xctest process.

## Test

``` shell
npm test
```
