import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';

import { setApiKeys } from './apiKeys.js';
import { transcribeAudioChunks } from './transcriber.js';
import { TafrighOptions, TranscribeFilesOptions } from './types.js';
import { DEFAULT_OUTPUT_EXTENSION } from './utils/constants.js';
import { formatMedia, splitAudioFile } from './utils/ffmpegUtils.js';
import { createTempDir } from './utils/io.js';
import logger from './utils/logger.js';
import { writeTranscripts } from './utils/transcriptOutput.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

export const transcribe = async (content: Readable | string, options?: TranscribeFilesOptions): Promise<string> => {
    validateTranscribeFileOptions(options);

    const outputDir = await createTempDir();
    logger.info(`transcribe ${content} (${typeof content}) using ${JSON.stringify(options)} to ${outputDir}`);

    const filePath = await formatMedia(content, outputDir, options?.preprocessOptions, options?.callbacks);
    const chunkFiles = await splitAudioFile(filePath, '', options?.splitOptions, options?.callbacks);
    let outputFile = '';

    if (chunkFiles.length > 0) {
        logger.trace(chunkFiles, `Generated chunks`);
        const transcripts = await transcribeAudioChunks(chunkFiles, options?.concurrency, options?.callbacks);
        outputFile = await writeTranscripts(
            transcripts,
            options?.outputOptions || {
                outputFile: path.join(outputDir, `${path.parse(filePath).name}.${DEFAULT_OUTPUT_EXTENSION}`),
            },
        );

        logger.info(`Transcriptions written to: ${outputFile}`);
    } else {
        logger.warn(`No chunks were created during the audio splitting process for ${filePath}`);
    }

    if (!options?.preventCleanup && options?.outputOptions) {
        await fs.rm(outputDir, { recursive: true });
    }

    return outputFile;
};
