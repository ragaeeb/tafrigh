import { promises as fs, type ReadStream } from 'node:fs';
import path from 'node:path';
import { formatMedia, splitFileOnSilences } from 'ffmpeg-simplified';

import { setApiKeys } from './apiKeys.js';
import { TranscriptionError } from './errors.js';
import { transcribeAudioChunks } from './transcriber.js';
import type { Logger, TranscribeOptions } from './types.js';
import logger, { setLogger } from './utils/logger.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

/**
 * Initializes the tafrigh library with the provided Wit.ai API keys.
 *
 * @param {Object} options - Configuration options for initialization
 * @param {string[]} options.apiKeys - Array of Wit.ai API keys to use for transcription
 * @param {Logger} [options.logger] - Optional custom logger instance for logging library operations
 * @example
 * import { init } from 'tafrigh';
 * init({ apiKeys: ['your-wit-ai-key'], logger: console });
 */
export const init = (options: { apiKeys: string[]; logger?: Logger }) => {
    setApiKeys(options.apiKeys);
    if (options.logger) {
        setLogger(options.logger);
    }
};

/**
 * Transcribes audio content and returns an array of transcript segments.
 *
 * This function takes an audio file (or stream) and returns a structured transcript with
 * timestamps. It handles preprocessing the audio, splitting it into chunks, and
 * transcribing each chunk using Wit.ai's API.
 *
 * @param {string | ReadStream} content - Path to audio file, URL, or readable stream
 * @param {TranscribeOptions} [options] - Configuration options for transcription
 * @returns {Promise<Array>} - Promise resolving to an array of transcript segments
 * @throws {Error} - If transcription fails or if options validation fails
 * @example
 * import { transcribe } from 'tafrigh';
 *
 * const transcript = await transcribe('path/to/audio.mp3', {
 *   concurrency: 2,
 *   splitOptions: {
 *     chunkDuration: 60,
 *     silenceDetection: { silenceThreshold: -30 }
 *   }
 * });
 *
 * console.log(transcript);
 * // [{ text: "Hello world", start: 0, end: 2.5 }, ...]
 */
export const transcribe = async (content: ReadStream | string, options?: TranscribeOptions) => {
    logger.info?.(`transcribe ${content} (${typeof content}) with options: ${JSON.stringify(options)}`);

    validateTranscribeFileOptions(options);

    const preventCleanup = options?.preventCleanup ?? false;
    let outputDir: string | undefined;
    let shouldCleanup = !preventCleanup;

    try {
        outputDir = await fs.mkdtemp('tafrigh');
        logger.debug?.(`Using ${outputDir}`);

        const filePath = await formatMedia(
            content,
            path.format({
                dir: outputDir,
                ext: '.mp3',
                name: Date.now().toString(),
            }),
            options?.preprocessOptions,
            options?.callbacks,
        );
        const chunkFiles = await splitFileOnSilences(filePath, outputDir, options?.splitOptions, options?.callbacks);

        logger.debug?.(`Generated chunks: ${JSON.stringify(chunkFiles)}`);

        if (chunkFiles.length === 0) {
            return [];
        }

        const { failures, transcripts } = await transcribeAudioChunks(chunkFiles, {
            callbacks: options?.callbacks,
            concurrency: options?.concurrency,
            retries: options?.retries,
        });

        if (failures.length > 0) {
            shouldCleanup = false;
            throw new TranscriptionError(`Failed to transcribe ${failures.length} chunk(s)`, {
                chunkFiles,
                failures,
                outputDir,
                transcripts,
            });
        }

        return transcripts;
    } finally {
        if (shouldCleanup && outputDir) {
            logger.info?.(`Cleaning up ${outputDir}`);
            await fs.rm(outputDir, { force: true, recursive: true });
        }
    }
};

export * from './errors.js';
export { resumeFailedTranscriptions } from './transcriber.js';
export * from './types.js';
export * from './utils/constants.js';
