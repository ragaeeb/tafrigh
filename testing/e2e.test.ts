import { describe, expect, it } from 'vitest';

import { getNextApiKey } from '../src/apiKeys.js';
import { transcribeFiles } from '../src/index.js';
import { speechToText } from '../src/wit.ai.js';

describe('e2e', () => {
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

    describe('transcribeFiles', () => {
        it.only(
            'should do a full transcription',
            async () => {
                const outputs = await transcribeFiles(['testing/khutbah.mp3'], {
                    splitOptions: { chunkDuration: 60 },
                });

                expect(outputs).toHaveLength(1);
            },
            { timeout: 20000 },
        );
    });
});
