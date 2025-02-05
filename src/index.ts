import { createTempDir, fileExists, formatMedia, splitFileOnSilences, stringToHash } from 'ffmpeg-simplified';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

import { setApiKeys } from './apiKeys.js';
import { transcribeAudioChunks } from './transcriber.js';
import { GetTranscriptionOptions, OutputFormat, TafrighOptions, TranscribeFilesOptions, Transcript } from './types.js';
import logger from './utils/logger.js';
import { formatTranscriptsWithLineBreaks, writeTranscripts } from './utils/transcriptOutput.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

const getTranscriptsFromInput = async (content: Readable | string, options: TranscribeFilesOptions) => {
    validateTranscribeFileOptions(options);

    const { dir: outputDir } = path.parse(options.outputOptions.outputFile);
    let filePath = path.format({
        dir: outputDir,
        ext: '.mp3',
        name: stringToHash(options.outputOptions.outputFile),
    });

    if (!(await fileExists(filePath))) {
        filePath = await formatMedia(content, filePath, options?.preprocessOptions, options?.callbacks);
    }

    const chunkFiles = await splitFileOnSilences(filePath, outputDir, options.splitOptions, options.callbacks);
    const transcripts = chunkFiles.length
        ? await transcribeAudioChunks(chunkFiles, {
              callbacks: options.callbacks,
              concurrency: options.concurrency,
              retries: options.retries,
          })
        : [];

    logger.trace(chunkFiles, `Generated chunks`);
    return {
        filePath,
        transcripts: options.lineBreakSecondsThreshold
            ? formatTranscriptsWithLineBreaks(transcripts, options.lineBreakSecondsThreshold)
            : transcripts,
    };
};

export const transcribe = async (content: Readable | string, options: TranscribeFilesOptions): Promise<string> => {
    logger.info(`transcribe ${content} (${typeof content}) using ${JSON.stringify(options)}`);

    const { filePath, transcripts } = await getTranscriptsFromInput(content, options);

    if (transcripts.length > 0) {
        const outputFile = await writeTranscripts(transcripts, options.outputOptions);

        logger.info(`Transcriptions written to: ${outputFile}`);

        return outputFile;
    }

    logger.warn(`No chunks were created during the audio splitting process for ${filePath}`);

    return '';
};

export const getTranscription = async (
    content: Readable | string,
    options?: GetTranscriptionOptions,
): Promise<Transcript[]> => {
    logger.info(`getTranscription ${content} (${typeof content}) using ${JSON.stringify(options)}`);
    const outputDir = await createTempDir('tafrigh');

    const outputFile = path.format({
        dir: outputDir,
        ext: `.${OutputFormat.PlainText}`,
        name: typeof content === 'string' ? stringToHash(content) : randomUUID(),
    });

    try {
        const { transcripts } = await getTranscriptsFromInput(content, { ...options, outputOptions: { outputFile } });
        return transcripts;
    } finally {
        await fs.rm(outputDir, { recursive: true });
    }
};

export * from './types.js';
