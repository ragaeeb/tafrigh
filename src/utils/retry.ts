import { setTimeout } from 'node:timers/promises';

import logger from './logger.js';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export const exponentialBackoffRetry = async <T>(
    fn: () => Promise<T>,
    retries = MAX_RETRIES,
    baseDelay = BASE_DELAY_MS,
): Promise<T> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (attempt < retries) {
                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger.warn(`Attempt ${attempt} failed. Retrying in ${delay}ms...`);
                await setTimeout(delay); // Native setTimeout with promises
            } else {
                logger.error(`All ${retries} attempts failed.`);
                throw error;
            }
        }
    }
    throw new Error('Exponential backoff failed unexpectedly'); // Fallback
};
