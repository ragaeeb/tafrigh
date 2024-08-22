import fs from 'fs/promises';

import { splitAudio } from './audioSplitter.js';
import { downloadMedia } from './downloader.js';
import { filterMediaFiles } from './fileUtils.js';
import logger from './logger.js';
import { writeOutput } from './outputWriter.js';
import { transcribeAudioChunks } from './transcriber.js';

export async function processMedia(inputFile, chunkDuration, outputFormat, outputFileName, outputDir, config) {
    const outputFilePath = `${outputDir}/${outputFileName}.${outputFormat}`;
    let wavFilePath = '';

    if (
        config.skipIfOutputExist &&
        (await fs
            .access(outputFilePath)
            .then(() => true)
            .catch(() => false))
    ) {
        logger.info(`Skipping ${inputFile} because output already exists.`);
        return;
    }

    try {
        logger.info(`Starting processing for: ${inputFile}`);

        wavFilePath = await downloadMedia(inputFile, config.downloadRetries, config.saveYtDlpResponses);
        logger.info(`WAV file created at: ${wavFilePath}`);

        const chunkFiles = await splitAudio(wavFilePath, chunkDuration, config.minWordsPerSegment);
        if (!chunkFiles.length) {
            throw new Error('No chunks were created during the audio splitting process.');
        }

        logger.info(`Number of chunks created: ${chunkFiles.length}`);
        const transcripts = await transcribeAudioChunks(chunkFiles, config.minWordsPerSegment);

        await writeOutput(transcripts, outputFormat, outputFileName, outputDir);
    } catch (error) {
        logger.error(`An error occurred while processing ${inputFile}: ${error.message}`);
    } finally {
        if (!config.saveFilesBeforeCompact && wavFilePath) {
            try {
                await fs.rm(wavFilePath, { recursive: true, force: true });
                logger.info('Temporary files cleaned up.');
            } catch (cleanupError) {
                logger.error(`Failed to clean up temporary files: ${cleanupError.message}`);
            }
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
