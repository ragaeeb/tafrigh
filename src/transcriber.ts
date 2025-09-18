import type { AudioChunk } from 'ffmpeg-simplified';

import PQueue from 'p-queue';

import { getApiKeysCount, getNextApiKey } from './apiKeys.js';
import { FailedTranscription, TranscriptionError } from './errors.js';
import { Callbacks, Segment, WitAiResponse } from './types.js';
import logger from './utils/logger.js';
import { mapWitResponseToSegment } from './utils/mapping.js';
import { exponentialBackoffRetry } from './utils/retry.js';
import { dictation } from './wit.ai.js';

const maskText = (text: string) => {
    return text.slice(0, 3) + '*****' + text[Math.floor(text.length / 2)] + '*****' + text.slice(-3);
};

/**
 * Processes a single audio chunk and requests its transcription.
 *
 * @param {AudioChunk} chunk - The audio chunk to transcribe
 * @param {number} index - Index of the chunk in the original array
 * @param {Callbacks} [callbacks] - Callback functions for progress reporting
 * @param {number} [retries] - Number of retry attempts for failed requests
 * @returns {Promise<Segment|null>} - The transcribed segment or null if transcription failed/empty
 * @internal
 */
const requestNextTranscript = async (
    chunk: AudioChunk,
    index: number,
    callbacks?: Callbacks,
    retries?: number,
): Promise<null | Segment> => {
    const response: WitAiResponse = await exponentialBackoffRetry(() => {
        const apiKey = getNextApiKey();
        logger.info(`Calling dictation for ${chunk.filename} with key ${maskText(apiKey)}`);

        return dictation(chunk.filename, { apiKey });
    }, retries);

    if (callbacks?.onTranscriptionProgress) {
        callbacks.onTranscriptionProgress(index);
    }

    if (response.text?.trim()) {
        return mapWitResponseToSegment(response, chunk.range);
    }

    return null;
};

/**
 * Transcribes audio chunks sequentially in a single thread.
 *
 * @param {AudioChunk[]} chunkFiles - Array of audio chunks to transcribe
 * @param {Callbacks} [callbacks] - Callback functions for progress reporting
 * @param {number} [retries] - Number of retry attempts for failed requests
 * @returns {Promise<Segment[]>} - Array of transcribed segments
 * @internal
 */
const transcribeAudioChunksInSingleThread = async (
    chunkFiles: AudioChunk[],
    callbacks?: Callbacks,
    retries?: number,
): Promise<TranscribeAudioChunksResult> => {
    const failures: FailedTranscription[] = [];
    const transcripts: Segment[] = [];

    logger.debug(`transcribeAudioChunksInSingleThread for ${chunkFiles.length}`);

    for (const [index, chunk] of chunkFiles.entries()) {
        try {
            const transcript = await requestNextTranscript(chunk, index, callbacks, retries);

            if (transcript) {
                transcripts.push(transcript);
                logger.trace(`Transcript received for chunk: ${chunk.filename}`);
            } else {
                logger.warn(`Skipping empty transcript`);
            }
        } catch (error) {
            logger.error(error, `Failed to transcribe chunk: ${chunk.filename}`);
            failures.push({ chunk, error, index });

            if (callbacks?.onTranscriptionProgress) {
                callbacks.onTranscriptionProgress(index);
            }
        }
    }

    transcripts.sort((a: Segment, b: Segment) => a.start - b.start);

    if (failures.length === 0 && callbacks?.onTranscriptionFinished) {
        await callbacks.onTranscriptionFinished(transcripts);
    }

    return { failures, transcripts };
};

/**
 * Transcribes audio chunks concurrently with a specified concurrency limit.
 *
 * @param {AudioChunk[]} chunkFiles - Array of audio chunks to transcribe
 * @param {number} concurrency - Maximum number of concurrent transcription operations
 * @param {Callbacks} [callbacks] - Callback functions for progress reporting
 * @param {number} [retries] - Number of retry attempts for failed requests
 * @returns {Promise<Segment[]>} - Array of transcribed segments
 * @internal
 */
const transcribeAudioChunksWithConcurrency = async (
    chunkFiles: AudioChunk[],
    concurrency: number,
    callbacks?: Callbacks,
    retries?: number,
): Promise<TranscribeAudioChunksResult> => {
    logger.debug(`transcribeAudioChunksWithConcurrency ${concurrency}`);

    const failures: FailedTranscription[] = [];
    const transcripts: Segment[] = [];
    const queue = new PQueue({ concurrency });

    const processChunk = async (index: number, chunk: AudioChunk) => {
        try {
            const transcript = await requestNextTranscript(chunk, index, callbacks, retries);

            if (transcript) {
                transcripts.push(transcript);
                logger.trace(`Transcript received for chunk: ${chunk.filename}`);
            } else {
                logger.warn(`Skipping empty transcript`);
            }
        } catch (error) {
            logger.error(error, `Failed to transcribe chunk: ${chunk.filename}`);
            failures.push({ chunk, error, index });

            if (callbacks?.onTranscriptionProgress) {
                callbacks.onTranscriptionProgress(index);
            }
        }
    };

    chunkFiles.forEach((chunk, index) => {
        queue.add(() => processChunk(index, chunk));
    });

    await queue.onIdle(); // Wait until all tasks in the queue are processed

    // Sort transcripts by their original order based on range to maintain chunk order
    transcripts.sort((a: Segment, b: Segment) => a.start - b.start);

    if (failures.length === 0 && callbacks?.onTranscriptionFinished) {
        await callbacks.onTranscriptionFinished(transcripts);
    }

    return { failures, transcripts };
};

/**
 * Options for the transcribeAudioChunks function.
 */
type TranscribeAudioChunksOptions = {
    /** Callback functions for progress reporting */
    callbacks?: Callbacks;
    /** Maximum number of concurrent transcription operations */
    concurrency?: number;
    /** Number of retry attempts for failed requests */
    retries?: number;
};

/**
 * Transcribes an array of audio chunks, either sequentially or concurrently.
 *
 * Determines the optimal concurrency based on available API keys and
 * the specified concurrency limit, then dispatches to either the single-threaded
 * or concurrent implementation.
 *
 * @param {AudioChunk[]} chunkFiles - Array of audio chunks to transcribe
 * @param {TranscribeAudioChunksOptions} [options] - Configuration options
 * @returns {Promise<Segment[]>} - Array of transcribed segments
 * @internal
 */
export type TranscribeAudioChunksResult = {
    failures: FailedTranscription[];
    transcripts: Segment[];
};

type ResumeOptions = Pick<TranscribeAudioChunksOptions, 'callbacks' | 'concurrency' | 'retries'>;

export const transcribeAudioChunks = async (
    chunkFiles: AudioChunk[],
    { callbacks, concurrency = 1, retries }: TranscribeAudioChunksOptions = {},
): Promise<TranscribeAudioChunksResult> => {
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

export const resumeFailedTranscriptions = async (
    error: Pick<TranscriptionError, 'failures' | 'transcripts'>,
    options?: ResumeOptions,
): Promise<TranscribeAudioChunksResult> => {
    const failedChunks = error.failures
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((failure) => failure.chunk);

    const { failures, transcripts } = await transcribeAudioChunks(failedChunks, options);

    const combinedTranscripts = [...error.transcripts, ...transcripts];
    combinedTranscripts.sort((a: Segment, b: Segment) => a.start - b.start);

    return {
        failures,
        transcripts: combinedTranscripts,
    };
};
