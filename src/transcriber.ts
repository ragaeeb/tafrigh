import { AudioChunk } from 'ffmpeg-simplified';
import PQueue from 'p-queue';

import { getApiKeysCount, getNextApiKey } from './apiKeys.js';
import { Callbacks, Segment, WitAiResponse } from './types.js';
import logger from './utils/logger.js';
import { mapWitResponseToSegment } from './utils/mapping.js';
import { exponentialBackoffRetry } from './utils/retry.js';
import { dictation } from './wit.ai.js';

const requestNextTranscript = async (
    chunk: AudioChunk,
    index: number,
    callbacks?: Callbacks,
    retries?: number,
): Promise<null | Segment> => {
    const response: WitAiResponse = await exponentialBackoffRetry(
        () => dictation(chunk.filename, { apiKey: getNextApiKey() }),
        retries,
    );

    if (callbacks?.onTranscriptionProgress) {
        callbacks.onTranscriptionProgress(index);
    }

    if (response.text?.trim()) {
        return mapWitResponseToSegment(response, chunk.range);
    }

    return null;
};

const transcribeAudioChunksInSingleThread = async (
    chunkFiles: AudioChunk[],
    callbacks?: Callbacks,
    retries?: number,
): Promise<Segment[]> => {
    const transcripts: Segment[] = [];

    logger.debug(`transcribeAudioChunksInSingleThread for ${chunkFiles.length}`);

    for (const [index, chunk] of chunkFiles.entries()) {
        const transcript = await requestNextTranscript(chunk, index, callbacks, retries);

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
    retries?: number,
): Promise<Segment[]> => {
    logger.debug(`transcribeAudioChunksWithConcurrency ${concurrency}`);

    const transcripts: Segment[] = [];
    const queue = new PQueue({ concurrency });

    const processChunk = async (index: number, chunk: AudioChunk) => {
        const transcript = await requestNextTranscript(chunk, index, callbacks, retries);

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
    transcripts.sort((a: Segment, b: Segment) => a.start - b.start);

    if (callbacks?.onTranscriptionFinished) {
        await callbacks.onTranscriptionFinished(transcripts);
    }

    return transcripts;
};

type TranscribeAudioChunksOptions = { callbacks?: Callbacks; concurrency?: number; retries?: number };

export const transcribeAudioChunks = async (
    chunkFiles: AudioChunk[],
    { callbacks, concurrency = 1, retries }: TranscribeAudioChunksOptions = {},
): Promise<Segment[]> => {
    const apiKeyCount = getApiKeysCount();
    const maxConcurrency = concurrency && concurrency <= apiKeyCount ? concurrency : apiKeyCount;

    if (callbacks?.onTranscriptionStarted) {
        await callbacks?.onTranscriptionStarted(chunkFiles.length);
    }

    if (chunkFiles.length === 1 || concurrency === 1) {
        return transcribeAudioChunksInSingleThread(chunkFiles, callbacks, retries);
    }

    return transcribeAudioChunksWithConcurrency(chunkFiles, maxConcurrency, callbacks, retries);
};
