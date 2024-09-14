import { TimeRange } from '../types.js';

export const mapSilenceResultsToChunkRanges = (
    silenceResults: TimeRange[],
    chunkDuration: number,
    totalDuration: number,
): TimeRange[] => {
    if (chunkDuration >= totalDuration) {
        return [{ end: totalDuration, start: 0 }];
    }

    const chunks: TimeRange[] = [];
    let currentStart = 0;

    while (currentStart < totalDuration) {
        const chunkEnd = Math.min(currentStart + chunkDuration, totalDuration);
        const relevantSilences = silenceResults
            .filter((s) => s.start > currentStart && s.start <= chunkEnd)
            .sort((a, b) => b.start - a.start);

        if (relevantSilences.length > 0) {
            const lastSilenceInChunk = relevantSilences[0];
            chunks.push({ end: lastSilenceInChunk.start, start: currentStart });
            currentStart = lastSilenceInChunk.start;
        } else {
            chunks.push({ end: chunkEnd, start: currentStart });
            currentStart = chunkEnd;
        }
    }

    return chunks;
};
