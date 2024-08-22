import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';

import logger from './logger.js';

export const splitAudio = async (filePath, chunkDuration) => {
    const outputDir = `${filePath.split('/').slice(0, -1).join('/')}/chunks`;
    await fs.mkdir(outputDir, { recursive: true }); // Ensure the output directory exists

    return new Promise((resolve, reject) => {
        const chunkFiles = [];
        ffmpeg(filePath)
            .outputOptions(['-f segment', `-segment_time ${chunkDuration}`, '-c copy'])
            .on('error', (err) => {
                logger.error(`Error during audio splitting: ${err.message}`);
                reject(err);
            })
            .on('end', async () => {
                logger.info('Audio successfully split into chunks.');
                try {
                    const files = await fs.readdir(outputDir);
                    files.forEach((file) => {
                        if (file.endsWith('.wav')) {
                            chunkFiles.push(`${outputDir}/${file}`);
                        }
                    });
                    if (chunkFiles.length === 0) {
                        reject('No chunks were created during the audio splitting process.');
                    } else {
                        resolve(chunkFiles);
                    }
                } catch (err) {
                    reject(`Error reading chunk files: ${err.message}`);
                }
            })
            .save(`${outputDir}/chunk-%03d.wav`) // Ensure the output pattern is correctly specified
            .run();
    });
};
