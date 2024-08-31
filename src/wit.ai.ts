import axios from 'axios';
import fs from 'fs';
import JSONStream from 'jsonstream-next';

interface SpeechToTextOptions {
    apiKey: string;
}

interface WitAiResponse {
    text?: string;
    confidence?: number;
    tokens?: {
        confidence: number;
        end: number;
        start: number;
        token: string;
    }[];
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
    const stream = fs.createReadStream(filePath);

    const { data } = await axios.post('https://api.wit.ai/speech', stream, {
        headers: {
            ...getCommonHeaders(filePath, options),
            Accept: 'application/vnd.wit.20200513+json',
        },
        responseType: 'json',
    });

    return { text: data.text, confidence: data.speech?.confidence, tokens: data.speech?.tokens };
};

export async function dictation(filePath: string, options: SpeechToTextOptions): Promise<WitAiResponse> {
    const stream = fs.createReadStream(filePath);

    const response = await axios.post('https://api.wit.ai/dictation?v=20240304', stream, {
        headers: getCommonHeaders(filePath, options),
        responseType: 'stream',
    });

    const parser = JSONStream.parse('*');
    response.data.pipe(parser);

    const finalObject: WitAiResponse = { tokens: [], text: '' };
    let currentObject: WitAiResponse = {};

    for await (const chunk of parser) {
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
    }

    return finalObject;
}
