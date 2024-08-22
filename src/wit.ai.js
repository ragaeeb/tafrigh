import fs from 'fs';
import fetch from 'node-fetch';
import process from 'process';

import logger from './logger.js';

const WIT_AI_API_KEYS = process.env.WIT_AI_API_KEYS ? process.env.WIT_AI_API_KEYS.split(' ') : [];

if (WIT_AI_API_KEYS.length === 0) {
    logger.error('At least one Wit.ai API key is required. Please set them in your environment variables.');
    process.exit(1);
}

let currentKeyIndex = 0;

const getNextApiKey = () => {
    const key = WIT_AI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % WIT_AI_API_KEYS.length;
    return key;
};

export const speechToText = async (filePath) => {
    const apiKey = getNextApiKey();
    const stream = fs.createReadStream(filePath);

    try {
        const response = await fetch('https://api.wit.ai/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'audio/wav',
                Accept: 'application/vnd.wit.20200513+json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: stream,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const json = await response.json();
        return json;
    } catch (error) {
        logger.error(`Failed to transcribe audio: ${error.message}`);
        throw error;
    }
};
