import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Transcript } from '../types';
import { createTempDir } from './io';
import { writeTranscripts } from './transcriptOutput';

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

        it('should throw an error for an unsupported format', async () => {
            await expect(
                writeTranscripts([], {
                    outputFile: path.join(outputDir, 'output.xyz'),
                }),
            ).rejects.toThrow('xyz extension not supported');
        });
    });
});
