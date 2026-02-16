import {findDeveloperImage} from '../../lib/imagemounter/utils/list_developer_image';
import {fs} from '@appium/support';

describe('findDeveloperImage', function () {
  let chai;

  before(async function () {
    chai = await import('chai');
    const chaiAsPromised = await import('chai-as-promised');
    chai.should();
    chai.use(chaiAsPromised.default);
  });

  it('should download and return the correct developer image for a given version', async function () {
    const result = await findDeveloperImage('14.7.1', {
      githubRepo: 'appium/appium-ios-device',
      subFolderList: ['test', 'imagemounter'],
      branch: 'master',
    });
    result.developerImage.endsWith('/DeveloperDiskImage.dmg').should.be.true;
    result.developerImageSignature.endsWith('/DeveloperDiskImage.dmg.signature').should.be.true;
    (await fs.exists(result.developerImage)).should.be.true;
    (await fs.exists(result.developerImageSignature)).should.be.true;
  });

  it('should throw an error if the developer image cannot be found', function () {
    findDeveloperImage('99.99.99', {
      githubRepo: 'appium/appium-ios-device',
      subFolderList: ['test', 'imagemounter'],
    }).should.be.rejectedWith('Failed to get developer image for iOS 99.99');
  });
});
