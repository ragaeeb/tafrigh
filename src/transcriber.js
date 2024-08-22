import PQueue from 'p-queue';

import logger from './logger.js';
import { processTranscripts } from './transcriptUtils.js';
import { speechToText } from './wit.ai.js';

export const transcribeAudioChunks = async (chunkFiles, minWordsPerSegment) => {
    const transcripts = [];
    const queue = new PQueue({ concurrency: 1 });

    for (const [index, filePath] of chunkFiles.entries()) {
        queue.add(async () => {
            try {
                logger.info(`Sending transcription request for chunk: ${filePath}`);
                const response = await speechToText(filePath);

                if (response.text) {
                    const transcript = response.text || '';
                    const wordCount = transcript.split(' ').length;

                    transcripts.push({
                        index,
                        file: filePath,
                        transcript,
                        wordCount,
                    });

                    logger.info(`Final transcription received for chunk: ${filePath}`);
                } else {
                    logger.warn(`Skipping non-final transcription for chunk: ${filePath}`);
                }
            } catch (error) {
                logger.error(`Failed to transcribe chunk ${filePath}: ${error.message}`);
            }
        });
    }

    await queue.onIdle();

    logger.trace(transcripts, `transcripts array for ${minWordsPerSegment}`);

    return processTranscripts(transcripts, minWordsPerSegment);
};
