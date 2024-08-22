import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';

import logger from './logger.js';

export const splitAudio = async (filePath, chunkDuration) => {
    const outputDir = `${filePath.split('/').slice(0, -1).join('/')}/chunks`;
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise((resolve, reject) => {
        const chunkFiles = [];
        ffmpeg(filePath)
            .outputOptions([`-f segment`, `-segment_time ${chunkDuration}`, `-c copy`, `${outputDir}/chunk-%03d.wav`])
            .on('error', (err) => {
                logger.error(`Error during audio splitting: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info('Audio successfully split into chunks.');
                fs.readdir(outputDir)
                    .then((files) => {
                        files.forEach((file) => {
                            if (file.endsWith('.wav')) {
                                chunkFiles.push(`${outputDir}/${file}`);
                            }
                        });
                        resolve(chunkFiles);
                    })
                    .catch((err) => {
                        reject(`Error reading chunk files: ${err.message}`);
                    });
            })
            .run();
    });
};
