import ora from 'ora';
import PQueue from 'p-queue';

import { getApiKeysCount, getNextApiKey } from './apiKeys.js';
import { AudioChunk, Transcript } from './types.js';
import logger from './utils/logger.js';
import { dictation } from './wit.ai.js';

const transcribeAudioChunksInSingleThread = async (chunkFiles: AudioChunk[]): Promise<Transcript[]> => {
    const transcripts: Transcript[] = [];
    const spinner = ora('Starting transcription...').start();

    logger.debug(`transcribeAudioChunksInSingleThread for ${chunkFiles.length}`);

    for (const [index, { filename, range }] of chunkFiles.entries()) {
        spinner.start(`Transcribing chunk ${index + 1}/${chunkFiles.length}: ${filename}`);

        try {
            const response = await dictation(filename, { apiKey: getNextApiKey() });

            if (response.text) {
                transcripts.push({
                    range,
                    text: response.text,
                });

                logger.trace(`Transcript received for chunk: ${filename}`);
                spinner.succeed(`Transcribed chunk ${index + 1}/${chunkFiles.length}: ${filename}`);
            } else {
                logger.warn(`Skipping non-final transcription for chunk: ${filename}`);
                spinner.warn(`No transcription for chunk ${index + 1}/${chunkFiles.length}: ${filename}`);
            }
        } catch (error: any) {
            logger.error(`Failed to transcribe chunk ${filename}: ${error.message}`);
            spinner.fail(`Failed to transcribe chunk ${index + 1}/${chunkFiles.length}: ${filename}`);

            throw error;
        }
    }

    spinner.stop();

    return transcripts;
};

const transcribeAudioChunksWithConcurrency = async (
    chunkFiles: AudioChunk[],
    concurrency: number,
): Promise<Transcript[]> => {
    logger.debug(`transcribeAudioChunksWithConcurrency ${concurrency}`);

    const transcripts: Transcript[] = [];
    const spinner = ora('Starting transcription...').start();

    const queue = new PQueue({ concurrency });

    const processChunk = async (index: number, chunk: AudioChunk) => {
        const { filename, range } = chunk;
        spinner.start(`Transcribing chunk ${index + 1}/${chunkFiles.length}: ${filename}`);

        try {
            const response = await dictation(filename, { apiKey: getNextApiKey() });

            if (response.text) {
                transcripts.push({
                    range,
                    text: response.text,
                });

                logger.trace(`Transcript received for chunk: ${filename}`);
                spinner.succeed(`Transcribed chunk ${index + 1}/${chunkFiles.length}: ${filename}`);
            } else {
                logger.warn(`Skipping non-final transcription for chunk: ${filename}`);
                spinner.warn(`No transcription for chunk ${index + 1}/${chunkFiles.length}: ${filename}`);
            }
        } catch (error: any) {
            logger.error(`Failed to transcribe chunk ${filename}: ${error.message}`);
            spinner.fail(`Failed to transcribe chunk ${index + 1}/${chunkFiles.length}: ${filename}`);

            throw error;
        }
    };

    // Enqueue the chunk processing tasks
    chunkFiles.forEach((chunk, index) => {
        queue.add(() => processChunk(index, chunk));
    });

    await queue.onIdle(); // Wait until all tasks in the queue are processed

    spinner.stop();

    // Sort transcripts by their original order based on range to maintain chunk order
    return transcripts.sort((a: Transcript, b: Transcript) => a.range.start - b.range.start);
};

export const transcribeAudioChunks = async (chunkFiles: AudioChunk[], concurrency?: number): Promise<Transcript[]> => {
    const apiKeyCount = getApiKeysCount();
    const maxConcurrency = concurrency && concurrency <= apiKeyCount ? concurrency : apiKeyCount;

    if (chunkFiles.length === 1 || concurrency === 1) {
        return transcribeAudioChunksInSingleThread(chunkFiles);
    }

    return transcribeAudioChunksWithConcurrency(chunkFiles, maxConcurrency);
};
