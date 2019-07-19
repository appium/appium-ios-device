const INSTALLATION_PROXY_SERVICE_NAME = 'com.apple.mobile.installation_proxy';

class InstallationProxyService {
  constructor (plistService) {
    this.plistService = plistService;
  }

  /**
   * Install the application on the relative path on the phone
   * @param {string} path The path where the .app and .ipa is located at
   * @param {number} timeout The timeout between messages received from the phone as status updates
   */
  async installApplication (path, timeout = 20000) {
    const request = {
      Command: 'Install',
      PackagePath: path
    };

    this.plistService.sendPlist(request);
    return await this.waitMessageCompletion(timeout);
  }

  /**
   * Lists applications according to the applicationType and returns them as a map
   * @param {string} applicationType of the which group you want to list. These can be User or System. Default is User
   * @returns A map of the applications which the key is the bundleId
   */
  async listApplications (applicationType = 'User') {
    const request = {
      Command: 'Browse',
      ClientOptions: {
        ApplicationType: applicationType
      }
    };

    this.plistService.sendPlist(request);
    const messages = await this.waitMessageCompletion();
    return messages.reduce((acc, message) => {
      message.CurrentList.forEach(app => {
        acc[app.CFBundleIdentifier] = app;
      });
      return acc;
    }, {});
  }

  /**
   * Uninstalls an application according to the given bundleId
   * @param {string} bundleId of the app that needs to be passed for uninstallation
   * @param {number} timeout The timeout between messages received from the phone as status updates
   */
  async uninstallApplication (bundleId, timeout = 20000) {
    const request = {
      Command: 'Uninstall',
      ApplicationIdentifier: bundleId
    };

    this.plistService.sendPlist(request);
    return await this.waitMessageCompletion(timeout);
  }

  async waitMessageCompletion (timeout) {
    let messages = [];
    // Just added for safety. This shouldn't happen
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      const data = await this.plistService.receivePlist(timeout);
      if (this.isFinished(data)) {
        return messages;
      }
      messages.push(data);
    }
  }

  isFinished (response) {
    if (response.Error) {
      throw new Error(`Unexpected data: ${JSON.stringify(response)}`);
    }

    if (!response.Status) {
      return false;
    }
    return response.Status === 'Complete';
  }

  close () {
    this.plistService.close();
  }
}

export { InstallationProxyService, INSTALLATION_PROXY_SERVICE_NAME };
export default InstallationProxyService;

