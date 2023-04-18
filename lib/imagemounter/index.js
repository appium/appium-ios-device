import { readFile, createReadStream } from 'fs';
import { BaseServicePlist } from '../base-service';
import { fs } from '@appium/support';
import B from 'bluebird';
import log from '../logger';
const MOBILE_IMAGE_MOUNTER_SERVICE_NAME = 'com.apple.mobile.mobile_image_mounter';
const { exists, lstat } = fs;
class ImageMounter extends BaseServicePlist {

    _checkReturnError(ret) {
        if (ret.Error) {
            throw new Error(ret.Error);
        }
    }

    /**
     * Lookup for mounted images.
     * @param {string?} imageType Type of image, `Developer` by default.
     * @returns {Promise<Buffer[]>} Signature of each mounted image.
     */
    async lookup(imageType = 'Developer') {
        const ret = await this._plistService.sendPlistAndReceive({
            Command: 'LookupImage',
            ImageType: imageType
        });
        this._checkReturnError(ret);
        return ret.ImageSignature || [];
    }

    /**
     * Check if developer image is mounted.
     */
    async isDeveloperImageMounted() {
        return (await this.lookup()).length > 0;
    }

    /**
     * Mount image for device.
     * @param {string} imageFilePath The file path of image.
     * @param {string} imageSignatureFilePath The signature file path of given `DeveloperDiskImage.dmg`
     * @param {string?} imageType Type of image, `Developer` by default.
     */
    async mount(imageFilePath, imageSignatureFilePath, imageType = 'Developer') {
        //check file stats
        if (!await exists(imageFilePath)) {
            throw new Error(`The image file provided not exists: ${imageFilePath}`);
        }
        const imageFileStat = await lstat(imageFilePath);
        if (imageFileStat.isDirectory()) {
            throw new Error(`The given image file is expected to be a file, a directory was given: ${imageFilePath}`);
        }
        if (!await exists(imageSignatureFilePath)) {
            throw new Error(`The signature file provided not exists: ${imageFilePath}`);
        }
        if ((await lstat(imageSignatureFilePath)).isDirectory()) {
            throw new Error(`The given signature file is expected to be a file, a directory was given: ${imageFilePath}`);
        }
        //read signature
        const signature = await new B((resolve, reject) => {
            readFile(imageSignatureFilePath, (err, data) => {
                if (err != null) {
                    reject(err);
                } else {
                    resolve(data);
                }
            });
        });
        const mountedImages = await this.lookup(imageType);
        if (mountedImages.find((mountedSignature) => signature.equals(mountedSignature))) {
            log.info(`An image with same signature of ${imageSignatureFilePath} is mounted. Doing nothing here`);
            return;
        }
        //notify device
        const imageSize = imageFileStat.size;
        let ret = await this._plistService.sendPlistAndReceive({
            Command: 'ReceiveBytes',
            ImageSignature: signature,
            ImageSize: imageSize,
            ImageType: imageType
        });
        this._checkReturnError(ret);
        if (ret.Status !== 'ReceiveBytesAck') {
            throw new Error(`Unexpected return from ${MOBILE_IMAGE_MOUNTER_SERVICE_NAME} on sending ReceiveBytes: ${JSON.stringify(ret)}`);
        }
        //push image to device
        const stream = createReadStream(imageFilePath);
        try {
            await new B((resolve, reject) => {
                stream.on('data', async (data) => {
                    await this._plistService._socketClient.write(data);
                });
                stream.on('end', resolve);
                stream.on('error', reject);
            });
        } finally {
            stream.close();
        }
        ret = await this._plistService.receivePlist();
        this._checkReturnError(ret);
        if (ret.Status !== 'Complete') {
            throw new Error(`Unexpected return from ${MOBILE_IMAGE_MOUNTER_SERVICE_NAME} on pushing image file: ${JSON.stringify(ret)}`);
        }
        //mount image
        ret = await this._plistService.sendPlistAndReceive({
            Command: 'MountImage',
            ImagePath: '/private/var/mobile/Media/PublicStaging/staging.dimag',
            ImageSignature: signature,
            ImageType: imageType
        });
        if (ret.DetailedError?.includes('is already mounted at /Developer')) {
            log.warn('DeveloperImage was mounted');
            return;
        }
        this._checkReturnError(ret);
    }

}
export { ImageMounter, MOBILE_IMAGE_MOUNTER_SERVICE_NAME };
export default ImageMounter;