import { createTempDir } from 'ffmpeg-simplified';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Transcript, WitAiResponse } from '../types';
import { formatTranscriptsWithLineBreaks, mapWitResponseToTranscript, writeTranscripts } from './transcriptOutput';

describe('transcriptOutput', () => {
    describe('writeTranscripts', () => {
        let outputDir;

        beforeEach(async () => {
            outputDir = await createTempDir();
        });

        afterEach(async () => {
            await fs.rm(outputDir, { recursive: true });
        });

        it('should write out a json file', async () => {
            const transcripts: Transcript[] = [
                { range: { end: 10, start: 0 }, text: 'A' },
                { range: { end: 20, start: 10 }, text: 'B' },
                {
                    range: { end: 30, start: 20 },
                    text: 'C',
                    tokens: [{ confidence: 1, end: 25, start: 20, token: 'C0' }],
                },
            ];

            const jsonFile = await writeTranscripts(transcripts, {
                outputFile: path.join(outputDir, 'output.json'),
            });

            const rawData = await fs.readFile(jsonFile, 'utf8');
            const data = JSON.parse(rawData);

            expect(data).toEqual([
                { end: 10, start: 0, text: 'A' },
                { end: 20, start: 10, text: 'B' },
                { end: 30, start: 20, text: 'C', tokens: [{ confidence: 1, end: 25, start: 20, token: 'C0' }] },
            ]);
        });

        it('should write out a plain text file', async () => {
            const transcripts: Transcript[] = [
                { range: { end: 10, start: 0 }, text: 'A' },
                { range: { end: 20, start: 10 }, text: 'B' },
                {
                    range: { end: 30, start: 20 },
                    text: 'C',
                    tokens: [{ confidence: 1, end: 25, start: 20, token: 'C0' }],
                },
            ];

            const jsonFile = await writeTranscripts(transcripts, {
                outputFile: path.join(outputDir, 'output.txt'),
            });

            const data = await fs.readFile(jsonFile, 'utf8');

            expect(data).toEqual('A\nB\nC');
        });

        it('should throw an error for an unsupported format', async () => {
            await expect(
                writeTranscripts([], {
                    outputFile: path.join(outputDir, 'output.xyz'),
                }),
            ).rejects.toThrow('xyz extension not supported');
        });
    });

    describe('formatTranscriptsWithLineBreaks', () => {
        it('should return an empty array when given an empty array', () => {
            const transcripts: Transcript[] = [];
            const result = formatTranscriptsWithLineBreaks(transcripts, 5);
            expect(result).toEqual([]);
        });

        it('should not change transcript if tokens is undefined', () => {
            const transcript: Transcript = {
                confidence: 0.8,
                range: { end: 10, start: 0 },
                text: 'Original text',
            };
            const result = formatTranscriptsWithLineBreaks([transcript], 5);
            expect(result[0].text).toBe('Original text');
        });

        it('should not change transcript if tokens array is empty', () => {
            const transcript: Transcript = {
                confidence: 0.8,
                range: { end: 10, start: 0 },
                text: 'Original text',
                tokens: [],
            };
            const result = formatTranscriptsWithLineBreaks([transcript], 5);
            expect(result[0].text).toBe('Original text');
        });

        it('should join tokens with spaces when no gaps exceed the threshold', () => {
            const transcript: Transcript = {
                confidence: 0.9,
                range: { end: 6, start: 0 },
                text: 'Hello world this is a test',
                tokens: [
                    { confidence: 0.9, end: 1, start: 0, token: 'Hello' },
                    { confidence: 0.8, end: 2, start: 1.2, token: 'world' },
                    { confidence: 0.8, end: 3, start: 2.2, token: 'this' },
                    { confidence: 0.8, end: 4, start: 3.2, token: 'is' },
                    { confidence: 0.8, end: 5, start: 4.2, token: 'a' },
                    { confidence: 0.8, end: 6, start: 5.2, token: 'test' },
                ],
            };

            const result = formatTranscriptsWithLineBreaks([transcript], 5);
            expect(result[0].text).toBe('Hello world this is a test');
        });

        it('should insert a newline when a gap exceeds the threshold', () => {
            const transcript: Transcript = {
                confidence: 0.8,
                range: { end: 12, start: 0 },
                text: 'Word1 Word2 Word3 Word4',
                tokens: [
                    { confidence: 0.9, end: 1, start: 0, token: 'Word1' },
                    { confidence: 0.8, end: 2, start: 1.2, token: 'Word2' },
                    // Gap here: 10 - 2 = 8 seconds > 5 seconds.
                    { confidence: 0.8, end: 11, start: 10, token: 'Word3' },
                    { confidence: 0.8, end: 12, start: 11.2, token: 'Word4' },
                ],
            };

            const result = formatTranscriptsWithLineBreaks([transcript], 5);
            expect(result[0].text).toBe('Word1 Word2\nWord3 Word4');
        });

        it('should update all transcripts in the array', () => {
            const transcripts: Transcript[] = [
                {
                    confidence: 0.7,
                    range: { end: 6, start: 0 },
                    text: 'Hello world this is transcript one',
                    tokens: [
                        { confidence: 0.9, end: 1, start: 0, token: 'Hello' },
                        { confidence: 0.8, end: 2, start: 1.1, token: 'world' },
                        { confidence: 0.8, end: 3, start: 2.1, token: 'this' },
                        { confidence: 0.8, end: 4, start: 3.1, token: 'is' },
                        { confidence: 0.8, end: 5, start: 4.1, token: 'transcript' },
                        { confidence: 0.8, end: 6, start: 5.1, token: 'one' },
                    ],
                },
                {
                    confidence: 0.65,
                    range: { end: 20, start: 10 },
                    text: 'Another transcript with gap',
                    tokens: [
                        { confidence: 0.9, end: 11, start: 10, token: 'Another' },
                        { confidence: 0.8, end: 12, start: 11.2, token: 'transcript' },
                        // Gap: 18 - 12 = 6 seconds > 5 seconds.
                        { confidence: 0.8, end: 19, start: 18, token: 'with' },
                        { confidence: 0.8, end: 20, start: 19.2, token: 'gap' },
                    ],
                },
            ];

            const result = formatTranscriptsWithLineBreaks(transcripts, 5);
            expect(result[0].text).toBe('Hello world this is transcript one');
            expect(result[1].text).toBe('Another transcript\nwith gap');
        });
    });

    describe('mapWitResponseToTranscript', () => {
        it('should correctly map a Wit.ai response with tokens', () => {
            const response = {
                confidence: 0.95,
                text: 'Hello world',
                tokens: [
                    { confidence: 1, end: 2000, start: 1000, token: 'Hello' },
                    { confidence: 1, end: 3000, start: 2100, token: 'world' },
                ],
            };

            const result = mapWitResponseToTranscript(response, { end: 20, start: 10 });

            expect(result).toEqual({
                confidence: 0.95,
                range: { end: 13, start: 11 }, // Adjusted from tokens
                text: 'Hello world',
                tokens: [
                    { confidence: 1, end: 12, start: 11, token: 'Hello' }, // 1000ms -> 1s + chunk start (10) = 11
                    { confidence: 1, end: 13, start: 12.1, token: 'world' }, // 2100ms -> 2.1s + chunk start (10) = 12.1
                ],
            });
        });

        it('should handle a response without tokens correctly', () => {
            const response: WitAiResponse = {
                confidence: 0.9,
                text: 'Hello world',
                tokens: [],
            };

            const result = mapWitResponseToTranscript(response, { end: 15, start: 5 });

            expect(result).toEqual({
                confidence: 0.9,
                range: { end: 15, start: 5 }, // Falls back to chunk range
                text: 'Hello world',
            });
        });
    });
});
