import fs from 'fs/promises';

import { splitAudio } from './audioSplitter.js';
import { downloadMedia } from './downloader.js';
import { filterMediaFiles } from './fileUtils.js';
import logger from './logger.js';
import { writeOutput } from './outputWriter.js';
import { transcribeAudioChunks } from './transcriber.js';

export async function processMedia(inputFile, chunkDuration, outputFormat, outputFileName, outputDir, config) {
    const tempDir = `${outputDir}/temp`;

    try {
        logger.info(`Starting processing for: ${inputFile}`);

        const wavFilePath = await downloadMedia(inputFile, config.downloadRetries, config.saveYtDlpResponses);
        logger.info(`WAV file created at: ${wavFilePath}`);

        const chunkFiles = await splitAudio(wavFilePath, chunkDuration);
        if (!chunkFiles.length) {
            throw new Error('No chunks were created during the audio splitting process.');
        }

        logger.info(`Number of chunks created: ${chunkFiles.length}`);
        const transcripts = await transcribeAudioChunks(chunkFiles, config.minWordsPerSegment);

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

export async function processFiles(files, chunkDuration, outputFormat, outputFileName, outputDir, config) {
    for (const inputFile of files) {
        const inputStat = await fs.stat(inputFile).catch(() => null);
        if (inputStat && inputStat.isDirectory()) {
            const filesInDir = await fs.readdir(inputFile);
            const mediaFiles = filterMediaFiles(filesInDir.map((file) => `${inputFile}/${file}`));
            for (const mediaFile of mediaFiles) {
                await processMedia(mediaFile, chunkDuration, outputFormat, outputFileName, outputDir, config);
            }
        } else {
            await processMedia(inputFile, chunkDuration, outputFormat, outputFileName, outputDir, config);
        }
    }
}
