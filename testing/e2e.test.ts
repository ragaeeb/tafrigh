import { createTempDir } from 'ffmpeg-simplified';
import { promises as fs } from 'fs';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { getNextApiKey } from '../src/apiKeys.js';
import { getTranscription, transcribe } from '../src/index.js';
import { MAX_CHUNK_DURATION } from '../src/utils/constants.js';
import { speechToText } from '../src/wit.ai.js';

describe('e2e', () => {
    let outputDir;

    beforeAll(async () => {
        outputDir = await createTempDir('tafrigh');
    });

    afterAll(async () => {
        await fs.rm(outputDir, { recursive: true });
    });

    describe('speechToText', () => {
        it(
            'should call the Wit.ai API with the correct parameters and return the text',
            async () => {
                const result = await speechToText('testing/khutbah_chunk1.wav', { apiKey: getNextApiKey() });

                expect(result.text).toBeDefined();
                expect(result.confidence).toBeDefined();
                expect((result.tokens || []).length > 6).toBe(true);
            },
            { timeout: 10000 },
        );
    });

    describe('transcribe', () => {
        it(
            'should do a full transcription',
            async () => {
                const outputFile = await transcribe('testing/khutbah.mp3', {
                    outputOptions: { outputFile: path.join(outputDir, 'khutbah.json') },
                    splitOptions: { chunkDuration: MAX_CHUNK_DURATION },
                });

                const data = JSON.parse(await fs.readFile(outputFile, 'utf8'));

                expect(data).toHaveLength(1);
            },
            { timeout: 20000 },
        );
    });

    describe('getTranscription', () => {
        it(
            'should do a full transcription',
            async () => {
                const transcripts = await getTranscription('testing/khutbah.mp3', {
                    splitOptions: { chunkDuration: MAX_CHUNK_DURATION },
                });

                expect(transcripts).toHaveLength(1);
            },
            { timeout: 20000 },
        );
    });
});
