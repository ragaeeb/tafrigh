import process from 'process';

import logger from './logger.js';

const WIT_AI_API_KEYS: string[] = process.env.WIT_AI_API_KEYS ? process.env.WIT_AI_API_KEYS.split(' ') : [];

let currentKeyIndex = 0;

const validateApiKeys = () => {
    if (WIT_AI_API_KEYS.length === 0) {
        logger.error('At least one Wit.ai API key is required. Please set them in your environment variables.');
        throw new Error('Empty wit.ai API keys');
    }
};

export const getNextApiKey = (): string => {
    validateApiKeys();

    const key = WIT_AI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % WIT_AI_API_KEYS.length;
    return key;
};

export const setApiKeys = (apiKeys: string[]) => {
    WIT_AI_API_KEYS.length = 0;
    WIT_AI_API_KEYS.push(...apiKeys);

    validateApiKeys();
};
