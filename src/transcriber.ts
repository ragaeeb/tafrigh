import { AudioChunk } from 'ffmpeg-simplified';
import PQueue from 'p-queue';

import { getApiKeysCount, getNextApiKey } from './apiKeys.js';
import { Callbacks, Transcript, WitAiResponse } from './types.js';
import logger from './utils/logger.js';
import { dictation } from './wit.ai.js';

const requestNextTranscript = async (
    chunk: AudioChunk,
    index: number,
    callbacks?: Callbacks,
): Promise<null | Transcript> => {
    const response: WitAiResponse = await dictation(chunk.filename, { apiKey: getNextApiKey() });

    if (callbacks?.onTranscriptionProgress) {
        callbacks.onTranscriptionProgress(index);
    }

    if (response.text?.trim()) {
        // Adjust tokens if they exist
        const adjustedTokens = response.tokens
            ? response.tokens.map((token) => ({
                  ...token,
                  end: token.end / 1000 + chunk.range.start,
                  start: token.start / 1000 + chunk.range.start,
              }))
            : [];

        // Set the range using the adjusted tokens
        const range = {
            end: adjustedTokens.length > 0 ? adjustedTokens[adjustedTokens.length - 1].end : chunk.range.end,
            start: adjustedTokens[0]?.start ?? chunk.range.start,
        };

        return {
            ...(response.confidence && { confidence: response.confidence }),
            range,
            text: response.text.trim(),
            ...(adjustedTokens.length > 0 && { tokens: adjustedTokens }),
        };
    }

    return null;
};

const transcribeAudioChunksInSingleThread = async (
    chunkFiles: AudioChunk[],
    callbacks?: Callbacks,
): Promise<Transcript[]> => {
    const transcripts: Transcript[] = [];

    logger.debug(`transcribeAudioChunksInSingleThread for ${chunkFiles.length}`);

    for (const [index, chunk] of chunkFiles.entries()) {
        const transcript = await requestNextTranscript(chunk, index, callbacks);

        if (transcript) {
            transcripts.push(transcript);
            logger.trace(`Transcript received for chunk: ${chunk.filename}`);
        } else {
            logger.warn(`Skipping empty transcript`);
        }
    }

    if (callbacks?.onTranscriptionFinished) {
        await callbacks.onTranscriptionFinished(transcripts);
    }

    return transcripts;
};

const transcribeAudioChunksWithConcurrency = async (
    chunkFiles: AudioChunk[],
    concurrency: number,
    callbacks?: Callbacks,
): Promise<Transcript[]> => {
    logger.debug(`transcribeAudioChunksWithConcurrency ${concurrency}`);

    const transcripts: Transcript[] = [];
    const queue = new PQueue({ concurrency });

    const processChunk = async (index: number, chunk: AudioChunk) => {
        const transcript = await requestNextTranscript(chunk, index, callbacks);

        if (transcript) {
            transcripts.push(transcript);
            logger.trace(`Transcript received for chunk: ${chunk.filename}`);
        } else {
            logger.warn(`Skipping empty transcript`);
        }
    };

    chunkFiles.forEach((chunk, index) => {
        queue.add(() => processChunk(index, chunk));
    });

    await queue.onIdle(); // Wait until all tasks in the queue are processed

    // Sort transcripts by their original order based on range to maintain chunk order
    transcripts.sort((a: Transcript, b: Transcript) => a.range.start - b.range.start);

    if (callbacks?.onTranscriptionFinished) {
        await callbacks.onTranscriptionFinished(transcripts);
    }

    return transcripts;
};

export const transcribeAudioChunks = async (
    chunkFiles: AudioChunk[],
    concurrency?: number,
    callbacks?: Callbacks,
): Promise<Transcript[]> => {
    const apiKeyCount = getApiKeysCount();
    const maxConcurrency = concurrency && concurrency <= apiKeyCount ? concurrency : apiKeyCount;

    if (callbacks?.onTranscriptionStarted) {
        await callbacks?.onTranscriptionStarted(chunkFiles.length);
    }

    if (chunkFiles.length === 1 || concurrency === 1) {
        return transcribeAudioChunksInSingleThread(chunkFiles, callbacks);
    }

    return transcribeAudioChunksWithConcurrency(chunkFiles, maxConcurrency, callbacks);
};
