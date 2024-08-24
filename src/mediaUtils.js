import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';

import { splitAudio } from './audioSplitter.js';
import { convertToWav, splitAudioFile } from './ffmpegUtils.js';
import { filterMediaFiles } from './fileUtils.js';
import logger from './logger.js';
import { writeOutput } from './outputWriter.js';
import { transcribeAudioChunks } from './transcriber.js';

export async function processMedia(inputFile, chunkDuration, outputFormat, outputFileName, outputDir, config) {
    const tempDir = `${outputDir}/temp`;

    try {
        logger.info(`Starting processing for: ${inputFile}`);

        const tempWavDir = path.join(process.cwd(), 'temp');
        await fs.mkdir(tempWavDir, { recursive: true });

        let wavFilePath;

        if (inputFile.endsWith('.mp3') || inputFile.endsWith('.mp4')) {
            logger.info(`Converting local file to WAV: ${inputFile}`);
            wavFilePath = await convertToWav(inputFile, tempWavDir);
        } else {
            const errorMsg = 'Unsupported file format or invalid URL';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        logger.info(`WAV file created at: ${wavFilePath}`);

        // Use the splitAudioFile function to create 10-second chunks
        await splitAudioFile(wavFilePath, 10, tempDir);
        const chunkFiles = await fs.readdir(tempDir);
        if (!chunkFiles.length) {
            throw new Error('No chunks were created during the audio splitting process.');
        }

        logger.info(`Number of chunks created: ${chunkFiles.length}`);
        const transcripts = await transcribeAudioChunks(
            chunkFiles.map((file) => path.join(tempDir, file)),
            config.minWordsPerSegment,
        );

        if (transcripts.length) {
            await writeOutput(transcripts, outputFormat, outputFileName, outputDir);
        } else {
            logger.warn(`No transcriptions to write to output.`);
        }
    } catch (error) {
        logger.error(`An error occurred while processing ${inputFile}: ${error.message}`);
    } finally {
        // Cleanup the temporary files
        try {
            await fs.rm(tempDir, { recursive: true, force: true });
            logger.info('Temporary files cleaned up.');
        } catch (cleanupError) {
            logger.error(`Failed to clean up temporary files: ${cleanupError.message}`);
        }
    }
}
