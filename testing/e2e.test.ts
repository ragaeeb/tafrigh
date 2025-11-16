import { describe, expect, it } from 'bun:test';

import { getNextApiKey } from '../src/apiKeys.js';
import { transcribe } from '../src/index.js';
import { MAX_CHUNK_DURATION } from '../src/utils/constants.js';
import { speechToText } from '../src/wit.ai.js';

const e2eDescribe = process.env.RUN_E2E === 'true' ? describe : describe.skip;

e2eDescribe('e2e', () => {
    describe('speechToText', () => {
        it('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const result = await speechToText('testing/khutbah_chunk1.wav', { apiKey: getNextApiKey() });

            expect(result.text).toBeDefined();
            expect(result.confidence).toBeDefined();
            expect((result.tokens || []).length > 6).toBe(true);
        }, 10000);
    });

    describe('transcribe', () => {
        it('should do a full transcription', async () => {
            const data = await transcribe('testing/khutbah.mp3', {
                splitOptions: { chunkDuration: MAX_CHUNK_DURATION },
            });

            expect(data).toHaveLength(1);
        }, 20000);
    });
});
