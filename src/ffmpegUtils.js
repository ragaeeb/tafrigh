import ffmpeg from 'fluent-ffmpeg';

import logger from './logger.js';

export const convertToWav = async (input, outputDir) => {
    const filePath = `${outputDir}/output.wav`;
    return new Promise((resolve, reject) => {
        ffmpeg(input)
            .toFormat('wav') // Correct method to set the output format
            .on('error', (err) => {
                logger.error(`Error during file conversion: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Converted file to WAV: ${filePath}`);
                resolve(filePath);
            })
            .save(filePath);
    });
};

export const downloadAndConvertToWav = async (videoStream, outputDir) => {
    const filePath = `${outputDir}/output.wav`;
    return new Promise((resolve, reject) => {
        ffmpeg(videoStream)
            .toFormat('wav') // Correct method to set the output format
            .on('error', (err) => {
                logger.error(`Error during YouTube video conversion: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Downloaded and converted YouTube audio to WAV: ${filePath}`);
                resolve(filePath);
            })
            .save(filePath);
    });
};

export const splitAudioFile = async (filePath, chunkDuration, outputDir) => {
    return new Promise((resolve, reject) => {
        ffmpeg(filePath)
            .outputOptions([`-f segment`, `-segment_time ${chunkDuration}`, `-c copy`, `${outputDir}/chunk-%03d.wav`])
            .on('error', (err) => {
                logger.error(`Error during audio splitting: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info('Audio successfully split into chunks.');
                resolve(outputDir);
            })
            .run();
    });
};
