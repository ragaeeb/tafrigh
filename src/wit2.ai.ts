import fs from 'fs';
import JSONStream from 'jsonstream-next';
import fetch from 'node-fetch';
import { Readable } from 'stream';

interface PartialJsonObject {
    [key: string]: any;
}

interface DictationOptions {
    apiKey: string;
    filePath: string;
}

async function* streamJsonResponses(readable: Readable): AsyncGenerator<PartialJsonObject, void, unknown> {
    const parser = JSONStream.parse('*');
    readable.pipe(parser);

    let currentObject: PartialJsonObject = {};

    for await (const chunk of parser) {
        if (typeof chunk === 'object' && chunk !== null) {
            Object.assign(currentObject, chunk);
        } else if (typeof chunk === 'string') {
            // Depending on your JSON structure, you may need to handle string chunks differently
            if (!currentObject['text']) {
                currentObject['text'] = chunk;
            } else if (!currentObject['type']) {
                currentObject['type'] = chunk;
            }
        }

        if (currentObject['type'] && currentObject['text']) {
            yield currentObject;
            currentObject = {};
        }
    }
}

export async function dictation(options: DictationOptions): Promise<string> {
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

    let finalTranscription = '';

    for await (const chunk of streamJsonResponses(response.body as unknown as Readable)) {
        console.log('Processed chunk:', chunk);
        if (chunk['type'] === 'FINAL_TRANSCRIPTION' && chunk['text']) {
            finalTranscription += chunk['text'] + ' ';
        }
    }

    return finalTranscription.trim();
}
