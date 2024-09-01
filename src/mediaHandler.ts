import { promises as fs } from 'fs';

import { splitAudioFile } from './ffmpegUtils.js';
import { AudioChunk } from './types.js';

interface ProcessMediaOptions {
    persistOutputFolder: boolean;
    chunkDuration: number;
}

export const processMedia = async (filePath: string, { persistOutputFolder, chunkDuration }: ProcessMediaOptions) => {
    const chunksOutputDirectory = `${filePath}_chunks`;
    await fs.mkdir(chunksOutputDirectory, { recursive: true });

    const chunkFiles: AudioChunk[] = await splitAudioFile(filePath, chunksOutputDirectory, { chunkDuration });

    if (chunkFiles.length === 0) {
        throw new Error(`No chunks were created during the audio splitting process for ${filePath}.`);
    }

    if (!persistOutputFolder) {
        await fs.rmdir(chunksOutputDirectory, { recursive: true });
    }

    return chunkFiles;
};
