import ora from 'ora';

import { getNextApiKey } from './apiKeys.js';
import { AudioChunk, Transcript } from './types.js';
import logger from './utils/logger.js';
import { dictation } from './wit.ai.js';

export const transcribeAudioChunks = async (chunkFiles: AudioChunk[]): Promise<Transcript[]> => {
    const transcripts: Transcript[] = [];
    const spinner = ora('Starting transcription...').start();

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
        }
    }

    spinner.stop();

    return transcripts;
};
