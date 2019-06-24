const INSTALLATION_PROXY_SERVICE_NAME = 'com.apple.mobile.installation_proxy';

class InstallationProxyService {
  constructor (plistService) {
    this.plistService = plistService;
  }

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

  async waitMessageCompletion () {
    let messages = [];
    // Just added for safety. This shouldn't happen
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      let data = await this.plistService.receivePlist();
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

