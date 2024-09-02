import { describe, expect, it } from 'vitest';

import { getNextApiKey } from './apiKeys.js';
import { transcribeFiles } from './index.js';
import { dictation, speechToText } from './wit.ai';

describe.skip('wit.ai', () => {
    describe('speechToText', () => {
        it.only(
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

    describe('dictation', () => {
        it(
            'should call the dictation endpoint with a mp3',
            async () => {
                const result = await dictation('testing/khutbah.mp3', { apiKey: getNextApiKey() });

                expect(result.text).toBeDefined();
                expect(result.confidence).toBeDefined();
                expect((result.tokens || []).length > 30).toBe(true);
            },
            { timeout: 20000 },
        );
    });

    describe('transcribeFiles', () => {
        it(
            'should do a full transcription',
            async () => {
                await transcribeFiles(['testing/khutbah.mp3'], { outputDir: 'testing/khutbahx' });
            },
            { timeout: 20000 },
        );
    });
});
