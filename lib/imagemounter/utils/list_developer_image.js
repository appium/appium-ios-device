import _ from 'lodash';
import { zip, net, env, fs } from '@appium/support';
import { join as joinPath } from 'path';
import axios from 'axios';
import log from '../../logger';
const { exists, readdir, lstat, mkdir, unlink } = fs;
/**
 * @typedef {Object} GithubTreeObject
 * @property {string} path
 * @property {string} mode
 * @property {'blob' | 'tree'} type
 * @property {string} sha
 * @property {number} size
 * @property {string} url
 */

/**
 * @typedef {Object} GithubTreeResponse
 * @property {string} sha
 * @property {string} url
 * @property {GithubTreeObject[]?} tree
 * @property {boolean?} truncated
 * @property {string?} node_id
 * @property {number?} size
 * @property {string?} content
 * @property {string?} base64
 */

const AVAILABLE_REPOS = [
    {
        user: 'JinjunHan',
        name: 'iOSDeviceSupport',
        subFolderList: ['iOSDeviceSupport']
    }, {
        user: 'filsv',
        name: 'iOSDeviceSupport',
        subFolderList: []
    }, {
        user: 'iGhibli',
        name: 'iOS-DeviceSupport',
        subFolderList: ['DeviceSupport']
    }
];
const DEFAULT_IMAGE_DIR_NAME = 'iOSDeviceSupport';
const DEVELOPER_IMAGE_FILE_NAME = 'DeveloperDiskImage.dmg';
const DEVELOPER_IMAGE_SIGNATURE_FILE_NAME = 'DeveloperDiskImage.dmg.signature';

/**
 * Use list api to return the file list of folder.
 * @param {string} user github user
 * @param {string} name the name of repository
 * @param {string[]} subFolderList subfolder list in level order
 * @returns {GithubTreeObject[]?} file list under target folder
 */
async function listGithubImageList(user, name, subFolderList = []) {
    const initialUrl = `https://api.github.com/repos/${user}/${name}/git/trees/master`;
    const repoUrl = `https://github.com/${user}/${name}/`;
    const fileList = [];
    let curUrl = initialUrl;
    /**
     * @type {GithubTreeObject[]?}
     */
    let ret = null;
    for (let i = 0; i <= subFolderList.length; i++) {
        const res = await axios.get(curUrl);
        /**
         * @type {GithubTreeResponse}
         */
        const body = res.data;
        const treeList = body?.tree;
        if (!treeList) {
            throw new Error(`Failed on looking up ${fileList.join('/')} under ${repoUrl}: ${JSON.stringify(body)}`);
        }
        if (i === subFolderList.length) {
            ret = treeList;
            break;
        }
        const entry = subFolderList[i];
        const nextItem = _.find(treeList, (item) => item.path === entry);
        if (!nextItem) {
            throw new Error(`Unable to find ${entry} under ${fileList.join('/')} in under ${repoUrl}: ${JSON.stringify(treeList)}`);
        }
        if (nextItem.type !== 'tree') {
            throw new Error(`${entry} under ${fileList.join('/')} in ${repoUrl} is expected to be a tree, got ${nextItem.type} instead.`);
        }
        fileList.push(entry);
        curUrl = nextItem.url;
    }
    return ret;
}

/**
 * Find `DeveloperDiskImage.dmg` recursively under folder and subfolder.
 * @param {string} entry current folder
 * @returns {string | undefined} parent folder of `DeveloperDiskImage.dmg` or `undefined` if no such file exists
 */
async function findDeveloperImageFromDirectory(entry) {
    const fileList = await readdir(entry);
    for (const subEntry of fileList) {
        const fullPath = joinPath(entry, subEntry);
        const statResult = await lstat(fullPath);
        if (subEntry === DEVELOPER_IMAGE_FILE_NAME && statResult.isFile()) {
            return entry;
        }
        if (statResult.isDirectory()) {
            const subFolderResult = await findDeveloperImageFromDirectory(fullPath);
            if (subFolderResult) {
                return subFolderResult;
            }
        }
    }
    return undefined;
}

/**
 * @typedef {Object} ImagePath
 * @property {string} developerImage
 * @property {string} developerImageSignature
 */

/**
 * Find developer image for certain version. If developer image does not exists,
 * this will try to find and download developer image, unzip to `~/.appium/iOSSupport/`
 * @param {string} version full version of iOS device. The first two parts of version
 * will be preserved when sending the request, e.g. `14.7.1` will be changed to `14.7`
 * @returns {ImagePath}
 * @throws If developer image is not found, or error while downloading or unzipping.
 */
async function findDeveloperImage(version) {
    const finalVersion = version.split('.').splice(0, 2).join('.');
    const fileName = `${finalVersion}.zip`;
    const DEFAULT_IMAGE_DIR = joinPath(await env.resolveAppiumHome(), DEFAULT_IMAGE_DIR_NAME);
    const fullDownloadPath = joinPath(DEFAULT_IMAGE_DIR, fileName);
    if (!await exists(DEFAULT_IMAGE_DIR)) {
        await mkdir(DEFAULT_IMAGE_DIR, { recursive: true });
    }
    if (!await exists(fullDownloadPath)) {
        await searchAndDownloadDeveloperImageFromGithub(finalVersion, fullDownloadPath);
    }
    const decompressPath = joinPath(DEFAULT_IMAGE_DIR, finalVersion);
    let developerImageParentFolder = null;
    if (await exists(decompressPath)) {
        developerImageParentFolder = await findDeveloperImageFromDirectory(decompressPath);
    }
    if (!developerImageParentFolder) {
        await zip.extractAllTo(fullDownloadPath, decompressPath);
        developerImageParentFolder = await findDeveloperImageFromDirectory(decompressPath);
    }
    if (!developerImageParentFolder) {
        throw new Error(`Unable to find unzipped developer image in ${decompressPath}`);
    }
    return {
        developerImage: joinPath(developerImageParentFolder, DEVELOPER_IMAGE_FILE_NAME),
        developerImageSignature: joinPath(developerImageParentFolder, DEVELOPER_IMAGE_SIGNATURE_FILE_NAME)
    };
}

async function searchAndDownloadDeveloperImageFromGithub(finalVersion, fullDownloadPath) {
    const fileNameRegExp = new RegExp(`${finalVersion}(\\(([\\w_|.()])+\\))?.zip`);
    let fileUrl = null;
    for (const repo of AVAILABLE_REPOS) {
        const fileList = await listGithubImageList(repo.user, repo.name, repo.subFolderList);
        if (!fileList) {
            continue;
        }
        const targetFile = _.find(fileList, (item) => fileNameRegExp.test(item.path));
        if (targetFile) {
            fileUrl = `https://raw.githubusercontent.com/${repo.user}/${repo.name}/master/${repo.subFolderList.join('/')}/${targetFile.path}`;
            break;
        }
    }
    if (fileUrl === null) {
        throw new Error(`Failed to get developer image for iOS ${finalVersion}`);
    }
    try {
        log.info(`Downloading developer image for ${finalVersion} to ${fullDownloadPath} from ${fileUrl}`);
        await net.downloadFile(fileUrl, fullDownloadPath);
    } catch (e) {
        await unlink(fullDownloadPath);
        throw e;
    }
}

export { findDeveloperImage };