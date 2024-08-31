import { describe, it } from 'vitest';

import { getNextApiKey } from './apiKeys.js';
import { speechToText } from './wit.ai';
import { dictation } from './wit2.ai';

describe('wit.ai', () => {
    describe('speechToText', () => {
        it.skip('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const result = await speechToText('testing/khutbah_chunk1.wav', { apiKey: getNextApiKey() });
            console.log('result', result);
        });

        it.only(
            'should call the dictation endpoint',
            async () => {
                const result = await dictation({ filePath: 'testing/khutbah_chunk1.wav', apiKey: getNextApiKey() });
                console.log('result', result);
            },
            { timeout: 10000 },
        );
    });
});
