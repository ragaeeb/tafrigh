import fs from 'fs/promises';
import path from 'path';

import { OutputFormat, Transcript, TranscriptOutputOptions } from '../types.js';
import logger from './logger.js';

const mapTranscriptsToJSONString = (transcripts: Transcript[]): string => {
    const flattened = transcripts.map(({ range, text }) => ({ ...range, text }));
    return JSON.stringify(flattened, null, 2);
};

const OutputFormatToHandler = {
    [OutputFormat.Json]: mapTranscriptsToJSONString,
};

export const writeTranscripts = async (
    transcripts: Transcript[],
    options: TranscriptOutputOptions,
): Promise<string> => {
    const format = path.parse(options.outputFile).ext.slice(1);
    logger.info(`Writing ${transcripts.length} transcripts to ${options}`);
    const handler = OutputFormatToHandler[format as OutputFormat];

    if (!handler) {
        throw new Error(`${format} extension not supported`);
    }

    await fs.writeFile(options.outputFile, handler(transcripts), 'utf8');

    return options.outputFile;
};
