import type { Segment, WitAiResponse } from '@/types.js';
import type { TimeRange } from 'ffmpeg-simplified';

export const mapWitResponseToSegment = (response: WitAiResponse, { end, start }: TimeRange): Segment => {
    const tokens = (response.tokens || [])
        .filter((token) => token.token)
        .map((token) => ({
            ...(token.confidence && { confidence: token.confidence }),
            end: token.end / 1000 + start,
            start: token.start / 1000 + start,
            text: token.token,
        }));

    return {
        ...(response.confidence && { confidence: response.confidence }),
        end: tokens.at(-1)?.end ?? end,
        start: tokens[0]?.start ?? start,
        text: response.text!.trim(),
        ...(tokens.length > 0 && { tokens: tokens }),
    };
};
