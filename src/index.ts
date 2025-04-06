import type { Readable } from 'node:stream';

import { formatMedia, splitFileOnSilences } from 'ffmpeg-simplified';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import type { TranscribeOptions } from './types.js';

import { setApiKeys } from './apiKeys.js';
import { transcribeAudioChunks } from './transcriber.js';
import logger from './utils/logger.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

/**
 * Initializes the tafrigh library with the provided Wit.ai API keys.
 *
 * @param {Object} options - Configuration options for initialization
 * @param {string[]} options.apiKeys - Array of Wit.ai API keys to use for transcription
 * @example
 * import { init } from 'tafrigh';
 * init({ apiKeys: ['your-wit-ai-key'] });
 */
export const init = (options: { apiKeys: string[] }) => {
    setApiKeys(options.apiKeys);
};

/**
 * Transcribes audio content and returns an array of transcript segments.
 *
 * This function takes an audio file (or stream) and returns a structured transcript with
 * timestamps. It handles preprocessing the audio, splitting it into chunks, and
 * transcribing each chunk using Wit.ai's API.
 *
 * @param {string | Readable} content - Path to audio file, URL, or readable stream
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
export const transcribe = async (content: Readable | string, options?: TranscribeOptions) => {
    logger.info(options, `transcribe ${content} (${typeof content})`);

    validateTranscribeFileOptions(options);

    const outputDir = await fs.mkdtemp('tafrigh');
    logger.debug(`Using ${outputDir}`);

    const cleanUp = async () => {
        if (!options?.preventCleanup) {
            logger.info(`Cleaning up ${outputDir}`);
            await fs.rm(outputDir, { recursive: true });
        }
    };

    const cleanUpAndExit = async () => {
        await cleanUp();
        process.exit(0);
    };

    process.on('SIGINT', cleanUpAndExit);
    process.on('SIGTERM', cleanUpAndExit);

    try {
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
        const transcript = chunkFiles.length
            ? await transcribeAudioChunks(chunkFiles, {
                  callbacks: options?.callbacks,
                  concurrency: options?.concurrency,
                  retries: options?.retries,
              })
            : [];

        logger.debug(chunkFiles, `Generated chunks`);

        return transcript;
    } finally {
        process.off('SIGINT', cleanUpAndExit);
        process.off('SIGTERM', cleanUpAndExit);

        await cleanUp();
    }
};

export * from './types.js';
export * from './utils/constants.js';
