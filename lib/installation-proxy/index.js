import _ from 'lodash';
import { BaseServicePlist } from '../base-service';

const INSTALLATION_PROXY_SERVICE_NAME = 'com.apple.mobile.installation_proxy';

class InstallationProxyService extends BaseServicePlist {
  /**
   * Install the application on the relative path on the phone
   * @param {string} path The path where the .app and .ipa is located at on the phone
   * @param {Object} clientOptions The extra options that wants to be passed to the installd
   * @param {number} timeout [60000] The timeout between messages received from the phone as status updates
   */
  async installApplication (path, clientOptions = {}, timeout = 60000) {
    const request = {
      Command: 'Install',
      PackagePath: path,
      ClientOptions: clientOptions
    };

    this._plistService.sendPlist(request);
    return await this._waitMessageCompletion(timeout);
  }

  /**
 * @typedef {Object} ListApplicationOptions
 *
 * @property {string} applicationType of the which group you want to list. These can be User, System or leave it empty for both
 * @property {Array} returnAttributes the fields which should be filtered and returned to the client. Leave this parameter empty if you don't want to filter
 */

  /**
   * Lists applications according to the opts and returns them as a map
   * @param {ListApplicationOptions} opts the listing options that wants to be passed
   * @returns A map of the applications which the key is the bundleId
   */
  async listApplications (opts = {}) {
    const request = {
      Command: 'Browse',
      ClientOptions: {}
    };

    if (opts.applicationType) {
      request.ClientOptions.ApplicationType = opts.applicationType;
    }
    if (opts.returnAttributes) {
      request.ClientOptions.ReturnAttributes = opts.returnAttributes;
    }

    this._plistService.sendPlist(request);
    const messages = await this._waitMessageCompletion();
    return messages.reduce(function (acc, message) {
      if (!message.CurrentList) {
        return acc;
      }
      message.CurrentList.forEach(function (app) {
        acc[app.CFBundleIdentifier] = app;
      });
      return acc;
    }, {});
  }

  /**
 * @typedef {Object} LookupApplicationOptions
 *
 * @property {string} applicationType of the which group you want to list. These can be User, System or leave it empty for both
 * @property {Array} returnAttributes the fields which should be filtered and returned to the client. Leave this parameter empty if you don't want to filter
 * @property {string|Array} bundleIds Bundle Ids of the apps that should be searched
 */

  /**
   * Lists applications according to the opts and returns them as a map
   * @param {LookupApplicationOptions} opts the lookup options that wants to be passed
   * @returns A map of the applications which the key is the bundleId
   */
  async lookupApplications (opts = {}) {
    const request = {
      Command: 'Lookup',
      ClientOptions: {}
    };
    if (opts.bundleIds) {
      request.ClientOptions.BundleIDs = _.isString(opts.bundleIds) ? [opts.bundleIds] : opts.bundleIds;
    }
    if (opts.applicationType) {
      request.ClientOptions.ApplicationType = opts.applicationType;
    }
    if (opts.returnAttributes) {
      request.ClientOptions.ReturnAttributes = opts.returnAttributes;
    }

    this._plistService.sendPlist(request);
    const messages = await this._waitMessageCompletion();
    for (const message of messages) {
      if (message.LookupResult) {
        return message.LookupResult;
      }
    }
    throw new Error(`Could not find LookupResult in the response: Response: ${JSON.stringify(messages)}`);
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

    this._plistService.sendPlist(request);
    return await this._waitMessageCompletion(timeout);
  }

  async _waitMessageCompletion (timeout) {
    let messages = [];
    // Just added for safety. This shouldn't happen
    for (let i = 0; i < Number.MAX_SAFE_INTEGER; i++) {
      const data = await this._plistService.receivePlist(timeout);
      messages.push(data);
      if (this._isFinished(data)) {
        return messages;
      }
    }
  }

  _isFinished (response) {
    if (response.Error) {
      throw new Error(`Unexpected data: ${JSON.stringify(response)}`);
    }

    if (!response.Status) {
      return false;
    }
    return response.Status === 'Complete';
  }
}

export { InstallationProxyService, INSTALLATION_PROXY_SERVICE_NAME };
export default InstallationProxyService;
