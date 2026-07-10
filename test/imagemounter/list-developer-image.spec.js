import {findDeveloperImage} from '../../lib/imagemounter/utils/list_developer_image';
import {fs} from '@appium/support';
import {describe, it} from 'node:test';
import {expect, use} from 'chai';
import chaiAsPromised from 'chai-as-promised';

use(chaiAsPromised);

describe('findDeveloperImage', function () {
  it('should download and return the correct developer image for a given version', async function () {
    const result = await findDeveloperImage('14.7.1', {
      githubRepo: 'appium/appium-ios-device',
      subFolderList: ['test', 'imagemounter'],
      branch: 'master',
    });
    expect(result.developerImage.endsWith('/DeveloperDiskImage.dmg')).to.be.true;
    expect(result.developerImageSignature.endsWith('/DeveloperDiskImage.dmg.signature')).to.be.true;
    expect(await fs.exists(result.developerImage)).to.be.true;
    expect(await fs.exists(result.developerImageSignature)).to.be.true;
  });

  it('should throw an error if the developer image cannot be found', async function () {
    await expect(
      findDeveloperImage('99.99.99', {
        githubRepo: 'appium/appium-ios-device',
        subFolderList: ['test', 'imagemounter'],
        branch: 'master',
      }),
    ).to.eventually.be.rejectedWith('Failed to get developer image for iOS 99.99');
  });
});
