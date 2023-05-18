import chai from 'chai';
import { findDeveloperImage } from '../../lib/imagemounter/utils/list_developer_image';
import { fs } from '@appium/support';
chai.should();
describe('findDeveloperImage', function() {
    it('should download and return the correct developer image for a given version', async function() {
        const result = await findDeveloperImage('14.7.1', { githubRepo: 'JinjunHan/iOSDeviceSupport', subFolderList: ['iOSDeviceSupport'] });
        result.developerImage.should.endWith('/DeveloperDiskImage.dmg');
        result.developerImageSignature.should.endWith('/DeveloperDiskImage.dmg.signature');
        (await fs.exists(result.developerImage)).should.be.true;
        (await fs.exists(result.developerImageSignature)).should.be.true;
    });

    it('should throw an error if the developer image cannot be found', async function() {
        try {
            await findDeveloperImage('99.99.99', { githubRepo: 'JinjunHan/iOSDeviceSupport', subFolderList: ['iOSDeviceSupport'] });
            chai.assert.fail('Expected an error to be thrown');
        } catch (err) {
            err.message.should.equal('Failed to get developer image for iOS 99.99');
        }
    });
});