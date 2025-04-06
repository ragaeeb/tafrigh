import { describe, expect, it } from 'vitest';

import { WitAiResponse } from '../types';
import { mapWitResponseToSegment } from './mapping';

describe('mapping', () => {
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

            const result = mapWitResponseToSegment(response, { end: 20, start: 10 });

            expect(result).toEqual({
                confidence: 0.95,
                end: 13,
                start: 11,
                text: 'Hello world',
                tokens: [
                    { confidence: 1, end: 12, start: 11, text: 'Hello' }, // 1000ms -> 1s + chunk start (10) = 11
                    { confidence: 1, end: 13, start: 12.1, text: 'world' }, // 2100ms -> 2.1s + chunk start (10) = 12.1
                ],
            });
        });

        it('should handle a response without tokens correctly', () => {
            const response: WitAiResponse = {
                confidence: 0.9,
                text: 'Hello world',
                tokens: [],
            };

            const result = mapWitResponseToSegment(response, { end: 15, start: 5 });

            expect(result).toEqual({
                confidence: 0.9,
                end: 15,
                start: 5, // Falls back to chunk range
                text: 'Hello world',
            });
        });
    });
});
