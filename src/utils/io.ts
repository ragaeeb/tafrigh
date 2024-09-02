import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { APP_NAME } from './constants.js';

export const createTempDir = async () => {
    const tempDirBase = path.join(os.tmpdir(), APP_NAME);
    return fs.mkdtemp(tempDirBase);
};

export const fileExists = async (path: string) => !!(await fs.stat(path).catch(() => false));
