# appium-ios-device

[![NPM version](http://img.shields.io/npm/v/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)
[![Downloads](http://img.shields.io/npm/dm/appium-ios-device.svg)](https://npmjs.org/package/appium-ios-device)

[![Release](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml/badge.svg)](https://github.com/appium/appium-ios-device/actions/workflows/publish.js.yml)

Appium API for dealing with iOS devices. This is mainly a rewrite of libimobiledevice in Node.js. The APIs allow Appium to talk directly to the phone over usbmuxd.

More information can be found at the links below:

* [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice)
* [iPhone Wiki](https://www.theiphonewiki.com/)

> **Note**
> This module is used and tested by [appium-xcuitest-driver](https://github.com/appium/appium-xcuitest-driver), which expects macOS as the host paltform with Xcode.
> Some features may only work partially on other platforms.

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
* `utilities.fetchImageFromGithubRepo`
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
* `services.startImageMounterService`

### Classes

* `Xctest`
  * Allows invoking pre-installed xctest app from iOS devices. No Xcode installation is required.
This class simulates the procedure which Xcode uses to invoke xctests.
  * `new Xctest(udid, xctestBundleId, targetBundleId, opts)`
    * `udid` - `string` Device udid.
    * `xctestBundleId` - `string` - Bundle Id of xctest app on device. The app must be installed on device.
    * `targetBundleId` - `string` - Test target bundle id. `null` by default.
    * `opts` - optional addition options to specific XCTestConfiguration and app launch env.
      * `conf` - properties to override in XCTestConfiguration.
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

### Mount Developer Image

When using a higher version of iOS devices with a lower version of Xcode or other non-macOS operating systems, most of the functions in `services` or `Xctest` may not be available because the developer image is not mounted. Sometimes it can be solved automatically by opening Xcode and waiting for a while. But more often you need to manually download and mount the developer image as follows：

  1. Download .dmg file with new Xcode(sometimes beta version is needed) from [Apple Developer Downloads Page](https://developer.apple.com/download/more/).
  2. Unarchive new Xcode from .dmg file without replacing old one.
  3. Find the folder named after the target iOS version in `(New Xcode.app)/Contents/Developer/Platforms/iPhoneOS.platform/DeviceSupport`. A `DeveloperDiskImage.dmg` and a `DeveloperDiskImage.dmg.signature` should be inside that folder.
  4. Copy the folder you found from last step and paste to `(Old Xcode.app)/Contents/Developer/Platforms/iPhoneOS.platform/DeviceSupport`.
  5. The operations in the above two steps are also applicable to platforms other than the iPhone. e.g. the folder for tvOS is `(Xcode.app)/Contents/Developer/Platforms/AppleTVOS.platform/DeviceSupport`.
  6. Restart your old Xcode and reconnect your devices, wait for a while until the "preparing device for development" prompt disappears.
  7. You can also mount this image using `ideviceimagemounter` binary file compiled by [libimobiledevice](https://github.com/libimobiledevice/libimobiledevice) project on your operating system.

These operations are very cumbersome. Fortunately there are many repositories of these developer images in the open source community. The folders mentioned in the above process are zipped and uploaded into open source repositories according to different versions. You can also make your own mirror repository on GitHub in a similar way. With `services.startImageMounterService` and `utilities.fetchImageFromGithubRepo`, you can automate the whole process cross-platform.

As an example, assuming we are using a repo from `https://github/example/iOSDeviceSupport`. All the .zip files are inside `DeviceSupportFiles/iOS` folder of root. We can check the mount status, download and mount the image using following code:

```js
import { services, utilities } from 'appium-ios-device';
import _ from 'lodash';
const { startImageMounterService } = services;
...
async function checkAndMountDeveloperImage(udid) {
  const imageMountService = await startImageMounterService(udid);
  try {
    const mountStatus = await imageMountService.isDeveloperImageMounted();
    if (!mountStatus) {
      const { fetchImageFromGithubRepo } = utilities;
      const repoOpts = {
        githubRepo: 'example/iOSDeviceSupport',
        subFolderList: ['DeviceSupportFiles', 'iOS']
      }
      const downloadedImagePath = await fetchImageFromGithubRepo(udid, repoOpts);
      if (!_.isEmpty(downloadedImagePath)) {
        const {developerImage, developerImageSignature} = downloadedImagePath;
        await imageMountService.mount(developerImage, developerImageSignature);
      }
    }
  } catch(e) {
    // Failed to mount, do something...
  } finally {
    imageMountService.close();
  }
}
```

## Test

``` shell
npm test
```
