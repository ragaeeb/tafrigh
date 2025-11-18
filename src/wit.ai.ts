import fs from 'node:fs';
import https from 'node:https';
import { URL } from 'node:url';

import JSONStream from 'jsonstream-next';

import type { WitAiResponse } from './types.js';

interface SpeechToTextOptions {
    apiKey: string;
}

const MARKER_FINAL_TRANSCRIPTION = 'FINAL_TRANSCRIPTION';

const applyDictationChunk = (chunk: unknown, current: WitAiResponse, final: WitAiResponse): WitAiResponse => {
    if (chunk === true) {
        return {};
    }

    if (chunk === MARKER_FINAL_TRANSCRIPTION) {
        if (current.tokens && current.tokens.length > 0) {
            final.tokens?.push(...current.tokens);
        }

        final.text += ` ${current.text}`;
        final.confidence = current.confidence;

        return {};
    }

    if (typeof chunk === 'string') {
        current.text = chunk;
        return current;
    }

    if (chunk && typeof chunk === 'object') {
        Object.assign(current, chunk);
        return current;
    }

    return current;
};

/**
 * Builds the base HTTP headers required for Wit.ai speech endpoints.
 *
 * The content type is automatically adjusted based on the file extension so that
 * the Wit.ai API receives the correct media metadata for each request.
 *
 * @param {string} filePath - Absolute or relative path to the audio file being uploaded
 * @param {SpeechToTextOptions} options - Authentication options containing the Wit.ai API key
 * @returns {Record<string, string>} A header map containing authorization and content type information
 */
const getCommonHeaders = (filePath: string, options: SpeechToTextOptions): Record<string, string> => {
    const result = {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'audio/wav',
    };

    if (filePath.endsWith('.mp3') || filePath.endsWith('.m4a') || filePath.endsWith('.mp4')) {
        result['Content-Type'] = 'audio/mpeg3';
    }

    return result;
};

/**
 * Submits an audio file to the Wit.ai speech endpoint and returns the parsed transcript.
 *
 * This helper is best suited for smaller files where streaming chunked responses is unnecessary.
 *
 * @param {string} filePath - Path to the audio file that should be transcribed
 * @param {SpeechToTextOptions} options - Authentication options containing the Wit.ai API key
 * @returns {Promise<WitAiResponse>} The parsed transcription data returned from Wit.ai
 * @throws {Error} When the HTTP request fails or Wit.ai returns a non-success status code
 */
export const speechToText = async (filePath: string, options: SpeechToTextOptions): Promise<WitAiResponse> => {
    const headers = {
        ...getCommonHeaders(filePath, options),
        Accept: 'application/vnd.wit.20200513+json',
    };

    return new Promise<WitAiResponse>((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        const url = new URL('https://api.wit.ai/speech');
        const requestOptions = {
            headers,
            method: 'POST',
        };

        const req = https.request(url, requestOptions, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    const parsedData = JSON.parse(data);
                    resolve({
                        confidence: parsedData.speech?.confidence,
                        text: parsedData.text,
                        tokens: parsedData.speech?.tokens,
                    });
                } else {
                    reject(new Error(`HTTP error! status: ${res.statusCode}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        stream.pipe(req);
    });
};

/**
 * Streams an audio file to the Wit.ai dictation endpoint and aggregates incremental responses.
 *
 * Unlike {@link speechToText}, this function processes streamed JSON markers from Wit.ai to
 * combine partial transcripts into a final result with token level detail.
 *
 * @param {string} filePath - Path to the audio file to be streamed
 * @param {SpeechToTextOptions} options - Authentication options containing the Wit.ai API key
 * @returns {Promise<WitAiResponse>} The combined final transcript with confidence metadata
 * @throws {Error} If the HTTP request fails, the server responds with an error, or the JSON stream errors
 */
export async function dictation(filePath: string, options: SpeechToTextOptions): Promise<WitAiResponse> {
    const stream = fs.createReadStream(filePath);

    const requestOptions = {
        headers: {
            ...getCommonHeaders(filePath, options),
            Accept: 'application/vnd.wit.20200513+json',
        },
        hostname: 'api.wit.ai',
        method: 'POST',
        path: '/dictation?v=20240304',
    };

    return new Promise<WitAiResponse>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP error! status: ${res.statusCode}`));
                return;
            }

            const finalObject: WitAiResponse = { text: '', tokens: [] };
            let currentObject: WitAiResponse = {};

            const parser = JSONStream.parse('*');
            res.pipe(parser);

            parser.on('data', (chunk) => {
                currentObject = applyDictationChunk(chunk, currentObject, finalObject);
            });

            parser.on('end', () => {
                resolve(finalObject);
            });

            parser.on('error', reject);
        });

        req.on('error', reject);
        stream.pipe(req);
    });
}
