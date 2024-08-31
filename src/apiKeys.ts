import process from 'process';

import logger from './logger.js';

const WIT_AI_API_KEYS = process.env.WIT_AI_API_KEYS ? process.env.WIT_AI_API_KEYS.split(' ') : [];

if (WIT_AI_API_KEYS.length === 0) {
    logger.error('At least one Wit.ai API key is required. Please set them in your environment variables.');
    process.exit(1);
}

let currentKeyIndex = 0;

export const getNextApiKey = (): string => {
    const key = WIT_AI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % WIT_AI_API_KEYS.length;
    return key;
};
