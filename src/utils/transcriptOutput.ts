import fs from 'fs/promises';
import path from 'node:path';

import { OutputFormat, Transcript, TranscriptOutputOptions } from '../types.js';
import logger from './logger.js';

const mapTranscriptsToJSONString = (transcripts: Transcript[]): string => {
    const flattened = transcripts.map(({ range, ...rest }) => ({ ...range, ...rest }));
    return JSON.stringify(flattened, null, 2);
};

const mapTranscriptsToPlainText = (transcripts: Transcript[]): string => {
    return transcripts.map(({ text }) => text).join('\n');
};

const OutputFormatToHandler = {
    [OutputFormat.Json]: mapTranscriptsToJSONString,
    [OutputFormat.PlainText]: mapTranscriptsToPlainText,
};

export const writeTranscripts = async (
    transcripts: Transcript[],
    options: TranscriptOutputOptions,
): Promise<string> => {
    const format = path.parse(options.outputFile).ext.slice(1);
    logger.info(`Writing ${transcripts.length} transcripts to ${JSON.stringify(options)}`);
    const handler = OutputFormatToHandler[format as OutputFormat];

    if (!handler) {
        throw new Error(`${format} extension not supported`);
    }

    await fs.writeFile(options.outputFile, handler(transcripts), 'utf8');

    return options.outputFile;
};
