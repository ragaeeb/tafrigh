import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { AudioChunk } from '../types.js';
import { APP_NAME } from './constants.js';
import logger from './logger.js';

export const createTempDir = async () => {
    const tempDirBase = path.join(os.tmpdir(), APP_NAME);
    return fs.mkdtemp(tempDirBase);
};

export const fileExists = async (path: string) => !!(await fs.stat(path).catch(() => false));

export const cleanupGeneratedFiles = async (chunkFiles: AudioChunk[], filePath: string): Promise<string[]> => {
    const tempFiles = Array.from(new Set(chunkFiles.map((c) => c.filename).concat(filePath)));
    logger.debug(`Cleaning up: ${tempFiles.toString()}`);
    await Promise.all(tempFiles.map((tempFile) => fs.rm(tempFile, { force: true })));

    return tempFiles;
};
