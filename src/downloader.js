import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';
import ytdl from 'ytdl-core';

import { convertToWav, downloadAndConvertToWav } from './ffmpegUtils.js';
import logger from './logger.js';

export const downloadMedia = async (input, retries = 3, saveYtDlpResponses = false) => {
    const outputDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(outputDir, { recursive: true });

    let filePath;

    const attemptDownloadAndConvert = async (attempts) => {
        try {
            if (ytdl.validateURL(input)) {
                logger.info(`Downloading audio from YouTube URL: ${input}`);
                const videoStream = ytdl(input, { quality: 'highestaudio' });

                if (saveYtDlpResponses) {
                    const responseFilePath = path.join(outputDir, 'yt-dlp-response.json');
                    const videoInfo = await ytdl.getInfo(input);
                    await fs.writeFile(responseFilePath, JSON.stringify(videoInfo, null, 2));
                    logger.info(`Saved yt-dlp response to: ${responseFilePath}`);
                }

                filePath = await downloadAndConvertToWav(videoStream, outputDir);
            } else if (input.endsWith('.mp3') || input.endsWith('.mp4')) {
                logger.info(`Converting local file to WAV: ${input}`);
                filePath = await convertToWav(input, outputDir);
            } else {
                const errorMsg = 'Unsupported file format or invalid URL';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        } catch (err) {
            if (attempts > 0) {
                logger.warn(`Retrying download/conversion (${retries - attempts + 1}/${retries})`);
                await attemptDownloadAndConvert(attempts - 1);
            } else {
                throw err;
            }
        }
    };

    await attemptDownloadAndConvert(retries);
    return filePath;
};
