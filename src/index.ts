import { promises as fs } from 'fs';

import { formatMedia } from './ffmpegUtils.js';
import { filterMediaFiles, getMediasToConvert, mapInputsToFiles } from './io.js';
import logger from './logger.js';
import { processWaveFile } from './mediaHandler.js';

const main = async (): Promise<void> => {
    try {
        const inputs = ['003_033.mp3'];
        const outputFolder = 'tmp';

        const allFiles = await mapInputsToFiles(inputs);
        const medias = filterMediaFiles(allFiles);
        const { waveFiles, conversionNeeded } = getMediasToConvert(medias);

        for (const wavFile of waveFiles) {
            const chunksOutputDirectory = `${wavFile}_chunks`;
            await fs.mkdir(chunksOutputDirectory);
        }

        await fs.mkdir(outputFolder, { recursive: true });

        const conversionPromises = conversionNeeded.map((file) => formatMedia(file, outputFolder));
        console.log('conversionPromises', conversionPromises);
        const convertedWavFiles = await Promise.all(conversionPromises);
        console.log('convertedWavFiles', convertedWavFiles);

        for (const waveFile of convertedWavFiles) {
            await processWaveFile(waveFile, { persistOutputFolder: true, chunkDuration: 10 });
        }
    } catch (err) {
        logger.error(err, `Error, terminating`);
    }

    return new Promise<void>(() => {});
};

main();
