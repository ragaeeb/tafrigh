import process from 'node:process';

import logger from './utils/logger.js';

/**
 * Array storing Wit.ai API keys.
 * Keys can be provided either through code or through environment variables.
 * @internal
 */
const WIT_AI_API_KEYS: string[] = process.env.WIT_AI_API_KEYS ? process.env.WIT_AI_API_KEYS.split(' ') : [];

/**
 * Tracks the current API key index for round-robin cycling.
 * @internal
 */
let currentKeyIndex = 0;

/**
 * Returns the total number of available API keys.
 *
 * @returns {number} The count of available API keys
 * @internal
 */
export const getApiKeysCount = (): number => WIT_AI_API_KEYS.length;

/**
 * Validates that at least one API key is available.
 * Throws an error if no keys are found.
 *
 * @throws {Error} If no API keys are available
 * @internal
 */
const validateApiKeys = (): void => {
    if (getApiKeysCount() === 0) {
        logger.error('At least one Wit.ai API key is required. Please set them in your environment variables.');
        throw new Error('Empty wit.ai API keys');
    }
};

/**
 * Returns the next API key in rotation, using a round-robin approach.
 * This distributes requests evenly across all available API keys.
 *
 * @returns {string} The next API key to use
 * @throws {Error} If no API keys are available
 * @internal
 */
export const getNextApiKey = (): string => {
    validateApiKeys();

    const key = WIT_AI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % WIT_AI_API_KEYS.length;
    return key;
};

/**
 * Sets the Wit.ai API keys to use for transcription.
 * This replaces any existing keys, including those from environment variables.
 *
 * @param {string[]} apiKeys - Array of Wit.ai API keys
 * @throws {Error} If the provided array is empty
 * @internal
 */
export const setApiKeys = (apiKeys: string[]) => {
    WIT_AI_API_KEYS.length = 0;
    WIT_AI_API_KEYS.push(...apiKeys);
    currentKeyIndex = 0;

    validateApiKeys();
};
