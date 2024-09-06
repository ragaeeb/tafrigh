import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

export const createTempDir = async () => {
    const tempDirBase = path.join(os.tmpdir(), `tafrigh_${Date.now().toString()}`);
    return fs.mkdtemp(tempDirBase);
};

export const fileExists = async (path: string) => !!(await fs.stat(path).catch(() => false));
