import _ from 'lodash';
import { zip, net } from '@appium/support';
import { homedir } from 'os';
import { join as joinPath } from 'path';
import fetch from 'node-fetch';
import { readdirSync, lstatSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import log from '../../logger';
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
const HOME_DIR = homedir();
const DEFAULT_IMAGE_DIR = joinPath(HOME_DIR, '.appium', 'iOSDeviceSupport');
const DEVELOPER_IMAGE_FILE_NAME = 'DeveloperDiskImage.dmg';
const DEVELOPER_IMAGE_SIGNATURE_FILE_NAME = 'DeveloperDiskImage.dmg.signature';

/**
 * Use list api to return the file list of folder.
 * @param {string} user github user
 * @param {string} name the name of repository
 * @param subFolderList subfolder list in level order
 * @returns {GithubTreeObject?} file list under target folder
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
        /**
         * @type {GithubTreeResponse}
         */
        const body = await fetch(curUrl).then((r) => r.json());
        if (!body.tree) {
            throw Error(`Failed on looking up ${fileList.join('/')} under ${repoUrl}: ${JSON.stringify(body)}`);
        }
        if (i === subFolderList.length) {
            ret = body.tree;
            break;
        }
        const entry = subFolderList[i];
        const nextItem = _.find(body.tree, (item) => item.path === entry);
        if (!nextItem) {
            throw Error(`Unable to find ${entry} under ${fileList.join('/')} in under ${repoUrl}: ${JSON.stringify(body.tree)}`);
        }
        if (nextItem.type !== 'tree') {
            throw Error(`${entry} under under ${fileList.join('/')} in under ${repoUrl} is expected to be a tree, got ${nextItem.type} instead.`);
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
function findDeveloperImageFromDirectory(entry) {
    const fileList = readdirSync(entry);
    for (const subEntry of fileList) {
        const fullPath = joinPath(entry, subEntry);
        const statResult = lstatSync(fullPath);
        if (subEntry === DEVELOPER_IMAGE_FILE_NAME && statResult.isFile()) {
            return entry;
        }
        if (statResult.isDirectory()) {
            const subFolderResult = findDeveloperImageFromDirectory(fullPath);
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
 * @param {string} version full version of iOS device
 * @returns {ImagePath}
 * @throws If developer image is not found, or error while downloading or unzipping.
 */
async function findDeveloperImage(version) {
    const finalVersion = version.split('.').splice(0, 2).join('.');
    const fileName = `${finalVersion}.zip`;
    const fullDownloadPath = joinPath(DEFAULT_IMAGE_DIR, fileName);
    if (!existsSync(DEFAULT_IMAGE_DIR)) {
        mkdirSync(DEFAULT_IMAGE_DIR, { recursive: true });
    }
    if (!existsSync(fullDownloadPath)) {
        await searchAndDownloadDeveloperImageFromGithub(finalVersion, fullDownloadPath);
    }
    const decompressPath = joinPath(DEFAULT_IMAGE_DIR, finalVersion);
    let developerImageParentFolder = null;
    if (existsSync(decompressPath)) {
        developerImageParentFolder = findDeveloperImageFromDirectory(decompressPath);
    }
    if (!developerImageParentFolder) {
        await zip.extractAllTo(fullDownloadPath, decompressPath);
        developerImageParentFolder = findDeveloperImageFromDirectory(decompressPath);
    }
    if (!developerImageParentFolder) {
        throw Error(`Unable to find unzipped developer image in ${decompressPath}`);
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
        if (targetFile != null) {
            fileUrl = `https://raw.githubusercontent.com/${repo.user}/${repo.name}/master/${repo.subFolderList.join('/')}/${targetFile.path}`;
            break;
        }
    }
    if (fileUrl === null) {
        throw Error(`Failed to get developer image for iOS ${finalVersion}`);
    }
    try {
        log.info(`Downloading developer image for ${finalVersion} to ${fullDownloadPath} from ${fileUrl}`);
        await net.downloadFile(fileUrl, fullDownloadPath);
    } catch (e) {
        unlinkSync(fullDownloadPath);
        throw e;
    }
}

export { findDeveloperImage };