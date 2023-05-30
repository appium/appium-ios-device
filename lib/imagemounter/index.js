import { BaseServicePlist } from '../base-service';
import { fs } from '@appium/support';
import B from 'bluebird';
import log from '../logger';
const { lstat, readFile, createReadStream } = fs;

const MOBILE_IMAGE_MOUNTER_SERVICE_NAME = 'com.apple.mobile.mobile_image_mounter';
const FILE_TYPE_IMAGE = 'image';
const FILE_TYPE_SIGNATURE = 'signature';

function checkIfError(ret) {
    if (ret.Error) {
        throw new Error(ret.Error);
    }
    return ret;
}

async function assertIsFile(filePath, fileType) {
    /** @type {import('fs').Stats | undefined} */
    let fileStat;
    try {
        fileStat = await lstat(filePath);
    } catch (err) {
        if (/** @type {NodeJS.ErrnoException} */(err).code === 'ENOENT') {
            throw new Error(`The provided ${fileType} path does not exist: ${filePath}`);
        }
        throw err;
    }
    if (fileStat.isDirectory()) {
        throw new Error(`The provided ${fileType} path is expected to be a file, but a directory was given: ${filePath}`);
    }
    return fileStat;
}

class ImageMounter extends BaseServicePlist {

    /**
     * Lookup for mounted images.
     * @param {string} imageType Type of image, `Developer` by default.
     * @returns {Promise<Buffer[]>} Signature of each mounted image.
     */
    async lookup(imageType = 'Developer') {
        const ret = await this._plistService.sendPlistAndReceive({
            Command: 'LookupImage',
            ImageType: imageType
        });
        return checkIfError(ret).ImageSignature || [];
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
     * @param {string} imageType Type of image, `Developer` by default.
     */
    async mount(imageFilePath, imageSignatureFilePath, imageType = 'Developer') {
        //check file stats
        const [imageFileStat] = await B.all([
            assertIsFile(imageFilePath, FILE_TYPE_IMAGE),
            assertIsFile(imageSignatureFilePath, FILE_TYPE_SIGNATURE)
        ]);
        //read signature
        const signature = await readFile(imageSignatureFilePath);
        const mountedImages = await this.lookup(imageType);
        if (mountedImages.find((mountedSignature) => signature.equals(mountedSignature))) {
            log.info(`An image with same signature of ${imageSignatureFilePath} is mounted. Doing nothing here`);
            return;
        }
        //notify device
        const imageSize = imageFileStat.size;
        const receiveBytesResult = await this._plistService.sendPlistAndReceive({
            Command: 'ReceiveBytes',
            ImageSignature: signature,
            ImageSize: imageSize,
            ImageType: imageType
        });
        if (checkIfError(receiveBytesResult).Status !== 'ReceiveBytesAck') {
            const errMsg = `Unexpected return from ${MOBILE_IMAGE_MOUNTER_SERVICE_NAME} on sending ReceiveBytes`;
            throw new Error(`${errMsg}: ${JSON.stringify(receiveBytesResult)}`);
        }
        //push image to device
        const stream = createReadStream(imageFilePath);
        try {
            await new B((resolve, reject) => {
                stream.on('end', resolve);
                stream.on('error', reject);
                stream.on('data', async (data) => {
                    try {
                        await this._plistService._socketClient.write(data);
                    } catch (e) {
                        stream.emit('error', e);
                    }
                });
            });
        } finally {
            stream.close();
        }
        const pushImageResult = await this._plistService.receivePlist();
        if (checkIfError(pushImageResult).Status !== 'Complete') {
            const errMsg = `Unexpected return from ${MOBILE_IMAGE_MOUNTER_SERVICE_NAME} on pushing image file`;
            throw new Error(`${errMsg}: ${JSON.stringify(pushImageResult)}`);
        }
        //mount image
        const mountResult = await this._plistService.sendPlistAndReceive({
            Command: 'MountImage',
            ImagePath: '/private/var/mobile/Media/PublicStaging/staging.dimag',
            ImageSignature: signature,
            ImageType: imageType
        });
        if (mountResult.DetailedError?.includes('is already mounted at /Developer')) {
            log.info('DeveloperImage was already mounted');
            return;
        }
        checkIfError(mountResult);
    }
}
export { ImageMounter, MOBILE_IMAGE_MOUNTER_SERVICE_NAME };