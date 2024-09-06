import { describe, expect, it } from 'vitest';

import { mapSilenceResultsToChunkRanges } from './mediaUtils';
import { TimeRange } from '../types';

describe('mediaUtils', () => {
    describe('mapSilenceResultsToChunkRanges', () => {
        it('should map silences to correct chunk ranges for a single chunk scenario', () => {
            const silenceResults: TimeRange[] = [];
            const chunkDuration = 10;
            const totalDuration = 10;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([{ start: 0, end: 10 }]);
        });

        it('should map silences to correct chunk ranges when there are multiple silences and chunks', () => {
            const silenceResults: TimeRange[] = [
                { start: 6, end: 6.5 },
                { start: 8.5, end: 9 },
                { start: 15, end: 15.5 },
                { start: 20, end: 20.5 },
            ];
            const chunkDuration = 10;
            const totalDuration = 30;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([
                { start: 0, end: 8.5 },
                { start: 8.5, end: 15 },
                { start: 15, end: 20 },
                { start: 20, end: 30 },
            ]);
        });

        it('should handle scenario where last chunk duration is less than chunkDuration', () => {
            const silenceResults: TimeRange[] = [
                { start: 6, end: 6.5 },
                { start: 8.5, end: 9 },
                { start: 15, end: 15.5 },
                { start: 20, end: 20.5 },
            ];
            const chunkDuration = 10;
            const totalDuration = 22;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([
                { start: 0, end: 8.5 },
                { start: 8.5, end: 15 },
                { start: 15, end: 20 },
                { start: 20, end: 22 },
            ]);
        });

        it('should handle scenario where no silences exist within chunk duration', () => {
            const silenceResults: TimeRange[] = [{ start: 12, end: 12.5 }];
            const chunkDuration = 10;
            const totalDuration = 30;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([
                { start: 0, end: 10 },
                { start: 10, end: 12 },
                { start: 12, end: 22 },
                { start: 22, end: 30 },
            ]);
        });

        it('should handle the case where totalDuration is less than chunkDuration', () => {
            const silenceResults: TimeRange[] = [];
            const chunkDuration = 10;
            const totalDuration = 5;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([{ start: 0, end: 5 }]);
        });

        it('should handle case where the last silence is after the chunkDuration but not up to totalDuration', () => {
            const silenceResults: TimeRange[] = [
                { start: 8, end: 9 },
                { start: 18, end: 19 },
            ];
            const chunkDuration = 10;
            const totalDuration = 25;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([
                { start: 0, end: 8 },
                { start: 8, end: 18 },
                { start: 18, end: 25 },
            ]);
        });

        it('should produce a single chunk if the chunk duration is greater than the total duration', () => {
            const silenceResults: TimeRange[] = [
                { start: 0, end: 0.81746 },
                { start: 7.61737, end: 8.354966 },
                { start: 14.979592, end: 15.490794 },
                { start: 18.758458, end: 19.106621 },
                { start: 24.334376, end: 24.567075 },
                { start: 28.103855, end: 28.420635 },
            ];

            const chunkDuration = 60;
            const totalDuration = 33.645714;

            const result = mapSilenceResultsToChunkRanges(silenceResults, chunkDuration, totalDuration);

            expect(result).toEqual([{ start: 0, end: 33.645714 }]);
        });
    });
});
