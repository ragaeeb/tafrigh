import type { TimeRange } from 'ffmpeg-simplified';
import type { Segment, WitAiResponse } from '@/types.js';

/**
 * Maps the raw Wit.ai API response to a standardized Segment object.
 *
 * This function transforms the API response format to our internal representation,
 * converting millisecond timestamps to seconds and applying the correct offset
 * based on the chunk's position in the original audio file.
 *
 * @param {WitAiResponse} response - The raw response from Wit.ai API
 * @param {TimeRange} range - The time range of the chunk in the original audio
 * @returns {Segment} A standardized segment with adjusted timing information
 * @internal
 */
export const mapWitResponseToSegment = (response: WitAiResponse, { end, start }: TimeRange): Segment => {
    // Convert API tokens to our internal Token format
    const tokens = (response.tokens || [])
        .filter((token) => token.token)
        .map((token) => ({
            ...(token.confidence && { confidence: token.confidence }),
            end: token.end / 1000 + start, // Convert ms to seconds and add chunk offset
            start: token.start / 1000 + start, // Convert ms to seconds and add chunk offset
            text: token.token,
        }));

    // Build the segment object with proper timings
    return {
        ...(response.confidence && { confidence: response.confidence }),
        end: tokens.at(-1)?.end ?? end, // Use last token end time or chunk end if no tokens
        start: tokens[0]?.start ?? start, // Use first token start time or chunk start if no tokens
        text: response.text!.trim(),
        ...(tokens.length > 0 && { tokens: tokens }),
    };
};
