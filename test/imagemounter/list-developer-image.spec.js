import assert from 'node:assert/strict';
import {describe, it} from 'node:test';

import {fs} from '@appium/support';

import {findDeveloperImage} from '../../lib/imagemounter/utils/list_developer_image';

describe('findDeveloperImage', function () {
  it('should download and return the correct developer image for a given version', async function () {
    const result = await findDeveloperImage('14.7.1', {
      githubRepo: 'appium/appium-ios-device',
      subFolderList: ['test', 'imagemounter'],
      branch: 'master',
    });
    assert.strictEqual(result.developerImage.endsWith('/DeveloperDiskImage.dmg'), true);
    assert.strictEqual(result.developerImageSignature.endsWith('/DeveloperDiskImage.dmg.signature'), true);
    assert.strictEqual(await fs.exists(result.developerImage), true);
    assert.strictEqual(await fs.exists(result.developerImageSignature), true);
  });

  it('should throw an error if the developer image cannot be found', async function () {
    await assert.rejects(
      findDeveloperImage('99.99.99', {
        githubRepo: 'appium/appium-ios-device',
        subFolderList: ['test', 'imagemounter'],
        branch: 'master',
      }),
      /Failed to get developer image for iOS 99\.99/,
    );
  });
});
