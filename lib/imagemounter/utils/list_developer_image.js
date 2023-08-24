import _ from 'lodash';
import { zip, net, env, fs } from '@appium/support';
import { join as joinPath } from 'path';
import axios from 'axios';
import log from '../../logger';

const { exists, readdir, mkdir, rimraf } = fs;
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
 * @property {GithubTreeObject[]} [tree]
 * @property {boolean} [truncated]
 * @property {string} [node_id]
 * @property {number} [size]
 * @property {string} [content]
 * @property {string} [base64]
 */

/**
 * @typedef {Object} ImageFromGithubRepo Option to indicate which github repo and subfolder to use to search developer
 * image. The image and signature files should be compressed into a zip format, and the filename should match this
 * regular expression: `${finalVersion}(\\(([\\w_|.()])+\\))?.zip`
 * @property {string} githubRepo This should be in format of `$(group or username)/${repository}`, which contains
 * available images.
 * @property {string} branch
 * @property {string[]} [subFolderList] subfolder list in level order
 */
const DEFAULT_IMAGE_DIR_NAME = 'iOSDeviceSupport';
const DEVELOPER_IMAGE_FILE_NAME = 'DeveloperDiskImage.dmg';
const DEVELOPER_IMAGE_SIGNATURE_FILE_NAME = 'DeveloperDiskImage.dmg.signature';

/**
 * Use list api to return the file list of folder.
 * @param {ImageFromGithubRepo} githubImageOption
 * @returns {Promise<GithubTreeObject[] | undefined>} file list under target folder
 */
async function listGithubImageList(githubImageOption) {
    const { githubRepo, subFolderList = [], branch = 'master' } = githubImageOption;
    const initialUrl = `https://api.github.com/repos/${githubRepo}/git/trees/${branch}`;
    const repoUrl = `https://github.com/${githubRepo}/`;
    const fileList = [];
    let curUrl = initialUrl;
    /**
     * @type {GithubTreeObject[] | undefined}
     */
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
            return treeList;
        }
        const entry = subFolderList[i];
        const nextItem = _.find(treeList, (item) => item.path === entry);
        if (!nextItem) {
            const errMsg = `Unable to find ${entry} under ${fileList.join('/')} in ${repoUrl}`;
            throw new Error(`${errMsg}: ${JSON.stringify(treeList)}`);
        }
        if (nextItem.type !== 'tree') {
            const errMsg = `${entry} under ${fileList.join('/')} in ${repoUrl} is expected to be a tree`;
            throw new Error(`${errMsg}, got ${nextItem.type} instead.`);
        }
        fileList.push(entry);
        curUrl = nextItem.url;
    }
}

/**
 * Find `DeveloperDiskImage.dmg` recursively under folder and subfolder.
 * @param {string} entry current folder
 * @returns {Promise<string | undefined>} parent folder of `DeveloperDiskImage.dmg`,
 *  or `undefined` if no such file exists
 */
async function findDeveloperImageFromDirectory(entry) {
    const fileList = await readdir(entry, { withFileTypes: true });
    for (const subEntry of fileList) {
        if (subEntry.name === DEVELOPER_IMAGE_FILE_NAME && subEntry.isFile()) {
            return entry;
        }
        if (subEntry.isDirectory()) {
            const fullPath = joinPath(entry, subEntry.name);
            const subFolderResult = await findDeveloperImageFromDirectory(fullPath);
            if (subFolderResult) {
                return subFolderResult;
            }
        }
    }
}

/**
 * @typedef {Object} ImagePath
 * @property {string} developerImage
 * @property {string} developerImageSignature
 */

/**
 * Find developer image for certain version. If developer image does not exists,
 * this will try to find and download developer image, unzip to `${APPIUM_HOME}/iOSSupport/`
 * @param {string} version full version of iOS device. The first two parts of version
 * will be preserved when sending the request, e.g. `14.7.1` will be changed to `14.7`
 * @param {ImageFromGithubRepo} githubImageOption
 * @returns {Promise<ImagePath>}
 * @throws If developer image is not found, or error while downloading or unzipping.
 */
async function findDeveloperImage(version, githubImageOption) {
    const finalVersion = version.split('.').splice(0, 2).join('.');
    const fileName = `${finalVersion}.zip`;
    const DEFAULT_IMAGE_DIR = joinPath(await env.resolveAppiumHome(), DEFAULT_IMAGE_DIR_NAME);
    const fullDownloadPath = joinPath(DEFAULT_IMAGE_DIR, fileName);
    if (!await exists(DEFAULT_IMAGE_DIR)) {
        await mkdir(DEFAULT_IMAGE_DIR, { recursive: true });
    }
    if (!await exists(fullDownloadPath)) {
        await searchAndDownloadDeveloperImageFromGithub(finalVersion, fullDownloadPath, githubImageOption);
    }
    const decompressPath = joinPath(DEFAULT_IMAGE_DIR, finalVersion);
    /** @type {string | undefined} */
    let developerImageParentFolder;
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

/**
 *
 * @param {string} finalVersion
 * @param {string} fullDownloadPath
 * @param {ImageFromGithubRepo} githubImageOption
 */
async function searchAndDownloadDeveloperImageFromGithub(finalVersion, fullDownloadPath, githubImageOption) {
    const fileNameRegExp = new RegExp(`${_.escapeRegExp(finalVersion)}(\\(([\\w_|.()])+\\))?.zip`);
    const { githubRepo, subFolderList = [], branch = 'master' } = githubImageOption;
    /** @type {string | undefined} */
    let fileUrl;
    const fileList = await listGithubImageList(githubImageOption);
    if (!fileList) {
        throw new Error(`Failed to list https://github.com/${githubRepo}`);
    }
    const targetFile = _.find(fileList, (item) => fileNameRegExp.test(item.path));
    const splitter = subFolderList.length > 0 ? '/' : '';
    const subFolderPath = `${splitter}${subFolderList.join('/')}${splitter}`;
    if (targetFile) {
        fileUrl = `https://raw.githubusercontent.com/${githubRepo}/${branch}${subFolderPath}${targetFile.path}`;
    }
    if (!fileUrl) {
        throw new Error(`Failed to get developer image for iOS ${finalVersion}`);
    }
    try {
        log.info(`Downloading developer image for ${finalVersion} to ${fullDownloadPath} from ${fileUrl}`);
        await net.downloadFile(fileUrl, fullDownloadPath);
    } catch (e) {
        await rimraf(fullDownloadPath);
        throw e;
    }
}

export { findDeveloperImage };