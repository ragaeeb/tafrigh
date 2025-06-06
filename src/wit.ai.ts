import JSONStream from 'jsonstream-next';
import fs from 'node:fs';
import https from 'node:https';
import { URL } from 'node:url';

import type { WitAiResponse } from './types.js';

interface SpeechToTextOptions {
    apiKey: string;
}

const MARKER_FINAL_TRANSCRIPTION = 'FINAL_TRANSCRIPTION';

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
                if (chunk === true) {
                    currentObject = {};
                } else if (chunk === MARKER_FINAL_TRANSCRIPTION) {
                    finalObject.tokens?.push(...(currentObject.tokens || []));
                    finalObject.text += ` ${currentObject.text}`;
                    finalObject.confidence = currentObject.confidence;
                } else if (typeof chunk === 'string') {
                    currentObject['text'] = chunk;
                } else if (chunk && typeof chunk === 'object') {
                    Object.assign(currentObject, chunk);
                }
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
