import { getNextApiKey } from './apiKeys.js';
import logger from './logger.js';
import { AudioChunk, Transcript } from './types.js';
import { speechToText } from './wit.ai';

export const transcribeAudioChunks = async (chunkFiles: AudioChunk[]): Promise<Transcript[]> => {
    const transcripts: Transcript[] = [];

    for (const [, { filename, range }] of chunkFiles.entries()) {
        try {
            logger.info(`Sending transcription request for chunk: ${filename}`);
            const response = await speechToText(filename, { apiKey: getNextApiKey() });

            if (response.text) {
                transcripts.push({
                    range,
                    text: response.text,
                });

                logger.trace(`Transcript received for chunk: ${filename}`);
            } else {
                logger.warn(`Skipping non-final transcription for chunk: ${filename}`);
            }
        } catch (error: any) {
            logger.error(`Failed to transcribe chunk ${filename}: ${error.message}`);
        }
    }

    return transcripts;
};
