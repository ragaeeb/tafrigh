import { promises as fs } from 'fs';
import path from 'path';

import { setApiKeys } from './apiKeys.js';
import { formatMedia, splitAudioFile } from './ffmpegUtils.js';
import logger from './logger.js';
import { transcribeAudioChunks } from './transcriber.js';
import { PreprocessOptions, SplitOptions } from './types.js';
import { createTempDir } from './utils/io.js';
import { OutputFormat, TranscriptOutputOptions, writeTranscripts } from './utils/transcriptOutput.js';

interface TranscribeFilesOptions {
    outputDir?: string;
    preprocessOptions?: PreprocessOptions;
    splitOptions?: SplitOptions;
    outputOptions?: TranscriptOutputOptions;
}

interface TafrighOptions {
    apiKeys: string[];
}

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

export const transcribeFiles = async (filePaths: string[], options: TranscribeFilesOptions = {}) => {
    const outputDir = options.outputDir || (await createTempDir());

    logger.info(`Using output directory ${outputDir}`);

    for (const file of filePaths) {
        const filePath = await formatMedia(file, outputDir, options.preprocessOptions);
        const chunkFiles = await splitAudioFile(filePath, outputDir, options.splitOptions);

        if (chunkFiles.length > 0) {
            const transcripts = await transcribeAudioChunks(chunkFiles);
            const outputFile = await writeTranscripts(
                transcripts,
                options.outputOptions || { format: OutputFormat.Json, outputDir, filename: path.parse(filePath).name },
            );

            logger.info(`Transcriptions written to: ${outputFile}`);
        } else {
            logger.warn(`No chunks were created during the audio splitting process for ${filePath}`);
        }
    }
};
