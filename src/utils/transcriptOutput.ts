import fs from 'fs/promises';
import path from 'path';

import { Transcript } from '../types.js';

export enum OutputFormat {
    Json = 'json',
}

export interface TranscriptOutputOptions {
    format: OutputFormat;
    outputDir: string;
    filename: string;
}

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
    const handler = OutputFormatToHandler[options.format];

    await fs.writeFile(outputFilePath, handler(transcripts), 'utf8');

    return outputFilePath;
};
