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

export const init = (options: { apiKeys: string[] }) => {
    setApiKeys(options.apiKeys);
};

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
