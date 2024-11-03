import { formatMedia, splitFileOnSilences } from 'ffmpeg-simplified';
import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';

import { setApiKeys } from './apiKeys.js';
import { transcribeAudioChunks } from './transcriber.js';
import { GetTranscriptionOptions, TafrighOptions, TranscribeFilesOptions, Transcript } from './types.js';
import { DEFAULT_OUTPUT_EXTENSION } from './utils/constants.js';
import { createTempDir } from './utils/io.js';
import logger from './utils/logger.js';
import { writeTranscripts } from './utils/transcriptOutput.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

const getTranscriptsFromInput = async (
    content: Readable | string,
    outputDir: string,
    options?: GetTranscriptionOptions,
) => {
    validateTranscribeFileOptions(options);

    const filePath = await formatMedia(content, outputDir, options?.preprocessOptions, options?.callbacks);
    const chunkFiles = await splitFileOnSilences(filePath, '', options?.splitOptions, options?.callbacks);
    const transcripts = chunkFiles.length
        ? await transcribeAudioChunks(chunkFiles, options?.concurrency, options?.callbacks)
        : [];

    logger.trace(chunkFiles, `Generated chunks`);
    return { filePath, transcripts };
};

export const transcribe = async (content: Readable | string, options?: TranscribeFilesOptions): Promise<string> => {
    const outputDir = await createTempDir();

    try {
        logger.info(`transcribe ${content} (${typeof content}) using ${JSON.stringify(options)} to ${outputDir}`);

        const { filePath, transcripts } = await getTranscriptsFromInput(content, outputDir, options);

        if (transcripts.length > 0) {
            const outputFile = await writeTranscripts(
                transcripts,
                options?.outputOptions || {
                    outputFile: path.join(outputDir, `${path.parse(filePath).name}.${DEFAULT_OUTPUT_EXTENSION}`),
                },
            );

            logger.info(`Transcriptions written to: ${outputFile}`);

            return outputFile;
        }

        logger.warn(`No chunks were created during the audio splitting process for ${filePath}`);

        return '';
    } finally {
        if (!options?.preventCleanup && options?.outputOptions) {
            await fs.rm(outputDir, { recursive: true });
        }
    }
};

export const getTranscription = async (
    content: Readable | string,
    options?: GetTranscriptionOptions,
): Promise<Transcript[]> => {
    const outputDir = await createTempDir();

    try {
        logger.info(`getTranscription ${content} (${typeof content}) using ${JSON.stringify(options)}`);
        const { transcripts } = await getTranscriptsFromInput(content, outputDir, options);

        return transcripts;
    } finally {
        await fs.rm(outputDir, { recursive: true });
    }
};
