import path from 'path';

import { setApiKeys } from './apiKeys.js';
import { transcribeAudioChunks } from './transcriber.js';
import { OutputFormat, TafrighOptions, TranscribeFilesOptions } from './types.js';
import { formatMedia, splitAudioFile } from './utils/ffmpegUtils.js';
import { createTempDir } from './utils/io.js';
import logger from './utils/logger.js';
import { writeTranscripts } from './utils/transcriptOutput.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

const transcribe = async (file: string, options: TranscribeFilesOptions): Promise<string> => {
    const outputDir = options.outputDir as string;
    logger.info(`Using output directory ${outputDir}`);

    logger.debug('Preprocessing');
    const filePath = await formatMedia(file, outputDir, options.preprocessOptions);
    const chunkFiles = await splitAudioFile(filePath, outputDir, options.splitOptions);
    let outputFile = '';

    if (chunkFiles.length > 0) {
        logger.trace(chunkFiles, `Generated chunks`);
        const transcripts = await transcribeAudioChunks(chunkFiles);
        outputFile = await writeTranscripts(
            transcripts,
            options.outputOptions || { format: OutputFormat.Json, outputDir, filename: path.parse(filePath).name },
        );

        logger.info(`Transcriptions written to: ${outputFile}`);
    } else {
        logger.warn(`No chunks were created during the audio splitting process for ${filePath}`);
    }

    return outputFile;
};

const getValidatedTranscriptionOptions = async (options: TranscribeFilesOptions): Promise<TranscribeFilesOptions> => {
    validateTranscribeFileOptions(options);
    return { ...options, ...(!options.outputDir && { outputDir: await createTempDir() }) };
};

export const transcribeFile = async (filePath: string, options: TranscribeFilesOptions = {}): Promise<string> => {
    validateTranscribeFileOptions(options);

    return transcribe(filePath, await getValidatedTranscriptionOptions(options));
};

export const transcribeFiles = async (filePaths: string[], options: TranscribeFilesOptions = {}): Promise<string[]> => {
    const results: string[] = [];
    const validatedOptions: TranscribeFilesOptions = await getValidatedTranscriptionOptions(options);

    for (const file of filePaths) {
        const output = await transcribe(file, validatedOptions);
        results.push(output);
    }

    return results;
};
