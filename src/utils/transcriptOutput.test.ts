import { afterEach } from 'node:test';

import { promises as fs } from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it } from 'vitest';

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
                { text: 'A', range: { start: 0, end: 10 } },
                { text: 'B', range: { start: 10, end: 20 } },
                { text: 'C', range: { start: 20, end: 30 } },
            ];

            const jsonFile = await writeTranscripts(transcripts, {
                outputFile: path.join(outputDir, 'output.json'),
            });

            const rawData = await fs.readFile(jsonFile, 'utf8');
            const data = JSON.parse(rawData);

            expect(data).toEqual([
                { text: 'A', start: 0, end: 10 },
                { text: 'B', start: 10, end: 20 },
                { text: 'C', start: 20, end: 30 },
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
