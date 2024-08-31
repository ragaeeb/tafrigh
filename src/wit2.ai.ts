import fs from 'fs';
import JSONStream from 'jsonstream-next';
import fetch from 'node-fetch';
import { Readable } from 'stream';

interface DictationOptions {
    apiKey: string;
    filePath: string;
}

export async function dictation(options: DictationOptions): Promise<Record<string, any>> {
    const stream = fs.createReadStream(options.filePath);

    const response = await fetch('https://api.wit.ai/dictation?v=20240304', {
        method: 'POST',
        headers: {
            'Content-Type': 'audio/wav',
            Authorization: `Bearer ${options.apiKey}`,
        },
        body: stream,
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
        throw new Error('Response body is null');
    }

    const parser = JSONStream.parse('*');
    (response.body as unknown as Readable).pipe(parser);

    let currentObject: Record<string, any> = {};

    for await (const chunk of parser) {
        if (chunk === true) {
            // this is sent just before the final transcription is sent, so let's reset our currentObject
            currentObject = {};
        } else {
            if (typeof chunk === 'string' && chunk !== 'FINAL_TRANSCRIPTION') {
                currentObject['text'] = chunk;
            } else if (chunk && typeof chunk === 'object') {
                Object.assign(currentObject, chunk);
            }
        }
    }

    return currentObject;
}
