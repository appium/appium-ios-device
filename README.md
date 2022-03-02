appium-ios-device
===================

[![NPM version](http://img.shields.io/npm/v/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)
[![Downloads](http://img.shields.io/npm/dm/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)

[![Release](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml/badge.svg)](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml)

Appium API for dealing with iOS devices. This is mainly a rewrite of libimobiledevice in nodejs. The APIs allow Appium to talk directly to the phone over usbmuxd

More information can be found at the links below:
* [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice)
* [iPhone Wiki](https://www.theiphonewiki.com/)

*Note*: Issue tracking for this repo has been disabled. Please use the [main Appium issue tracker](https://github.com/appium/appium/issues) instead.

### Methods

- `utilities.getConnectedDevices`
- `utilities.getOSVersion`
- `utilities.getDeviceTime`
- `utilities.getDeviceName`
- `utilities.getDeviceInfo`
- `utilities.startLockdownSession`
- `utilities.connectPort`
- `utilities.connectPortSSL`
- `services.startSyslogService`
- `services.startWebInspectorService`
- `services.startInstallationProxyService`
- `services.startSimulateLocationService`
- `services.startAfcService`
- `services.startNotificationProxyService`
- `services.startHouseArrestService`
- `services.startInstrumentService`
- `services.startMCInstallService`

### Usage

This module should be used over the `utilities` and `services` modules due to the complexity of iOS communication. When a new services is implemented, it should be added and made available over the `services` module

## Watch

```
npm run watch
```

## Test

```
npm test
```
