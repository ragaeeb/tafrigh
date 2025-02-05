import { AudioChunk, TimeRange } from 'ffmpeg-simplified';
import fs from 'node:fs/promises';
import path from 'node:path';

import { OutputFormat, Token, Transcript, TranscriptOutputOptions, WitAiResponse } from '../types.js';
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

/**
 * Rebuilds the transcript text by inserting a newline whenever the gap between
 * consecutive tokens exceeds the given threshold.
 *
 * @param tokens - The array of tokens from a transcript.
 * @param gapThreshold - The minimum gap (in seconds) between tokens to insert a newline.
 * @returns The rebuilt transcript text.
 */
const formatTranscriptText = (tokens: Token[], gapThreshold: number): string => {
    // Start with the first token.
    let formattedText = tokens[0].token;

    // Iterate over the remaining tokens.
    for (let i = 1; i < tokens.length; i++) {
        const gap = tokens[i].start - tokens[i - 1].end;
        formattedText += (gap > gapThreshold ? '\n' : ' ') + tokens[i].token;
    }

    return formattedText;
};

/**
 * Processes an array of transcripts, updating the "text" property of each transcript
 * by rebuilding it using its tokens and inserting line breaks when the gap between tokens
 * exceeds the specified threshold.
 *
 * @param transcripts - The array of transcripts to format.
 * @param gapThreshold - The number of seconds gap that triggers a newline.
 * @returns A new array of transcripts with updated text properties.
 */
export const formatTranscriptsWithLineBreaks = (transcripts: Transcript[], gapThreshold: number): Transcript[] => {
    return transcripts.map((transcript) => {
        // If there are no tokens, return the transcript unchanged.
        if (!transcript.tokens || transcript.tokens.length === 0) {
            return transcript;
        }

        const newText = formatTranscriptText(transcript.tokens, gapThreshold);
        // Return a new transcript object with the updated text.
        return { ...transcript, text: newText };
    });
};

export const mapWitResponseToTranscript = (response: WitAiResponse, { end, start }: TimeRange): Transcript => {
    const adjustedTokens = response.tokens
        ? response.tokens.map((token) => ({
              ...token,
              end: token.end / 1000 + start,
              start: token.start / 1000 + start,
          }))
        : [];

    const range = {
        end: adjustedTokens.length > 0 ? adjustedTokens[adjustedTokens.length - 1].end : end,
        start: adjustedTokens[0]?.start ?? start,
    };

    return {
        ...(response.confidence && { confidence: response.confidence }),
        range,
        text: response.text?.trim() as string,
        ...(adjustedTokens.length > 0 && { tokens: adjustedTokens }),
    };
};
