import fs from 'fs';
import fetch from 'node-fetch';

interface SpeechToTextOptions {
    apiKey: string;
}

interface WitAiResponse {
    text?: string;
}

export const speechToText = async (filePath: string, options: SpeechToTextOptions): Promise<WitAiResponse> => {
    const stream = fs.createReadStream(filePath);

    const response = await fetch('https://api.wit.ai/speech', {
        method: 'POST',
        headers: {
            'Content-Type': 'audio/wav',
            Accept: 'application/vnd.wit.20200513+json',
            Authorization: `Bearer ${options.apiKey}`,
        },
        body: stream,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json() as WitAiResponse;
};
