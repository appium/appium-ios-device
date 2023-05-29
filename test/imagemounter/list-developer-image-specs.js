import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { findDeveloperImage } from '../../lib/imagemounter/utils/list_developer_image';
import { fs } from '@appium/support';
chai.should();
chai.use(chaiAsPromised);
describe('findDeveloperImage', function () {
    it('should download and return the correct developer image for a given version', async function () {
        const result = await findDeveloperImage('14.7.1', {
            githubRepo: 'appium/appium-ios-device',
            subFolderList: ['test', 'imagemounter']
        });
        result.developerImage.endsWith('/DeveloperDiskImage.dmg').should.be.true;
        result.developerImageSignature.endsWith('/DeveloperDiskImage.dmg.signature').should.be.true;
        fs.exists(result.developerImage).should.eventually.be.true;
        fs.exists(result.developerImageSignature).should.eventually.be.true;
    });

    it('should throw an error if the developer image cannot be found', function () {
        findDeveloperImage('99.99.99', {
            githubRepo: 'appium/appium-ios-device',
            subFolderList: ['test', 'imagemounter']
        }).should.be.rejectedWith('Failed to get developer image for iOS 99.99');
    });
});