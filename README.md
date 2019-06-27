appium-ios-device
===================

[![NPM version](http://img.shields.io/npm/v/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)
[![Downloads](http://img.shields.io/npm/dm/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)
[![Dependency Status](https://david-dm.org/appium/appium-ios-device/master.svg)](https://david-dm.org/appium/appium-ios-device/master)
[![devDependency Status](https://david-dm.org/appium/appium-ios-device/master/dev-status.svg)](https://david-dm.org/appium/appium-ios-device/master#info=devDependencies)

[![Build Status](https://api.travis-ci.org/appium/appium-ios-device.png?branch=master)](https://travis-ci.org/appium/appium-ios-device)
[![Coverage Status](https://coveralls.io/repos/appium/appium-ios-device/badge.svg?branch=master)](https://coveralls.io/r/appium/appium-ios-device?branch=master)
[![Greenkeeper badge](https://badges.greenkeeper.io/appium/appium-ios-device.svg)](https://greenkeeper.io/)

Appium API for dealing with iOS devices. This is mainly a rewrite of libimobiledevice in nodejs. The APIs allow Appium to talk directly to the phone over usbmuxd

*Note*: Issue tracking for this repo has been disabled. Please use the [main Appium issue tracker](https://github.com/appium/appium/issues) instead.

### Methods

-`utilities.getConnectedDevices`
-`utilities.getOSVersion`
-`utilities.getDeviceTime`
-`utilities.startLockdownSession`
-`utilities.connectPort`
-`utilities.connectPortSSL`
-`services.startSyslogService`
-`services.startWebInspectorService`
-`services.startInstallationProxyService`

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
