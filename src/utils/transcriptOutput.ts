import fs from 'fs/promises';
import path from 'path';

import { OutputFormat, Transcript, TranscriptOutputOptions } from '../types.js';
import logger from './logger.js';

const mapTranscriptsToJSONString = (transcripts: Transcript[]): string => {
    const flattened = transcripts.map(({ text, range }) => ({ ...range, text }));
    return JSON.stringify(flattened, null, 2);
};

const OutputFormatToHandler = {
    [OutputFormat.Json]: mapTranscriptsToJSONString,
};

export const writeTranscripts = async (
    transcripts: Transcript[],
    options: TranscriptOutputOptions,
): Promise<string> => {
    await fs.mkdir(options.outputDir, { recursive: true });

    const outputFilePath = path.format({ dir: options.outputDir, name: options.filename, ext: options.format });
    logger.info(`Writing ${transcripts.length} transcripts to ${outputFilePath}`);
    const handler = OutputFormatToHandler[options.format];

    if (!handler) {
        throw new Error(`${options.format} not supported`);
    }

    await fs.writeFile(outputFilePath, handler(transcripts), 'utf8');

    return outputFilePath;
};
