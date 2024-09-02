import path from 'path';

import { setApiKeys } from './apiKeys.js';
import { formatMedia, splitAudioFile } from './utils/ffmpegUtils.js';
import { transcribeAudioChunks } from './transcriber.js';
import { OutputFormat, TafrighOptions, TranscribeFilesOptions } from './types.js';
import { createTempDir } from './utils/io.js';
import logger from './utils/logger.js';
import { writeTranscripts } from './utils/transcriptOutput.js';
import { validateTranscribeFileOptions } from './utils/validation.js';

export const init = (options: TafrighOptions) => {
    setApiKeys(options.apiKeys);
};

export const transcribeFiles = async (filePaths: string[], options: TranscribeFilesOptions = {}) => {
    validateTranscribeFileOptions(options);

    const outputDir = options.outputDir || (await createTempDir());

    logger.info(`Using output directory ${outputDir}`);

    for (const file of filePaths) {
        logger.debug('Preprocessing');
        const filePath = await formatMedia(file, outputDir, options.preprocessOptions);
        const chunkFiles = await splitAudioFile(filePath, outputDir, options.splitOptions);

        if (chunkFiles.length > 0) {
            logger.trace(chunkFiles, `Generated chunks`);
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
