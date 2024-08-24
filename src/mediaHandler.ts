import { promises as fs } from 'fs';

import { AudioChunk, splitAudioFile } from './ffmpegUtils.js';

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

    console.log('split audio', wavFile, chunksOutputDirectory);
    const chunkFiles: AudioChunk[] = await splitAudioFile(wavFile, chunksOutputDirectory, { chunkDuration });
    console.log('chunkfiles', chunkFiles);

    if (chunkFiles.length === 0) {
        throw new Error(`No chunks were created during the audio splitting process for ${wavFile}.`);
    }

    if (!persistOutputFolder) {
        await fs.rmdir(chunksOutputDirectory, { recursive: true });
    }

    return chunkFiles;
};
