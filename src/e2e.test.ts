import { describe, expect, it } from 'vitest';

import { getNextApiKey } from './apiKeys.js';
import { dictation, speechToText } from './wit.ai';

describe('wit.ai', () => {
    describe('speechToText', () => {
        it(
            'should call the Wit.ai API with the correct parameters and return the text',
            async () => {
                const result = await speechToText('testing/khutbah_chunk1.wav', { apiKey: getNextApiKey() });

                expect(result.text).toBeDefined();
                expect(result.confidence).toBeDefined();
                expect(result.tokens).toHaveLength(7);
            },
            { timeout: 10000 },
        );

        it.only(
            'should call the dictation endpoint with a mp3',
            async () => {
                const result = await dictation('testing/khutbah.mp3', { apiKey: getNextApiKey() });

                expect(result.text).toBeDefined();
                expect(result.confidence).toBeDefined();
                expect(result.tokens).toHaveLength(38);
            },
            { timeout: 20000 },
        );
    });
});
