import { promises as fs } from 'fs';

import { splitAudioFile } from './ffmpegUtils.js';
import { AudioChunk } from './types.js';

interface ProcessWaveFileOptions {
    persistOutputFolder: boolean;
    chunkDuration: number;
}

export const processWaveFile = async (
    wavFile: string,
    { persistOutputFolder, chunkDuration }: ProcessWaveFileOptions,
) => {
    const chunksOutputDirectory = `${wavFile}_chunks`;
    await fs.mkdir(chunksOutputDirectory, { recursive: true });

    const chunkFiles: AudioChunk[] = await splitAudioFile(wavFile, chunksOutputDirectory, { chunkDuration });

    if (chunkFiles.length === 0) {
        throw new Error(`No chunks were created during the audio splitting process for ${wavFile}.`);
    }

    if (!persistOutputFolder) {
        await fs.rmdir(chunksOutputDirectory, { recursive: true });
    }

    return chunkFiles;
};
