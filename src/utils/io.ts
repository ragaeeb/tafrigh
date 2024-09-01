import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { APP_NAME } from '../constants';

export const createTempDir = async () => {
    const tempDirBase = path.join(os.tmpdir(), APP_NAME);
    return fs.mkdtemp(tempDirBase);
};
