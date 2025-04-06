import { setTimeout } from 'node:timers/promises';

import logger from './logger.js';

/**
 * Default maximum number of retry attempts.
 * @internal
 */
const MAX_RETRIES = 5;

/**
 * Default base delay in milliseconds for retry backoff.
 * @internal
 */
const BASE_DELAY_MS = 1000;

/**
 * Executes a function with exponential backoff retry logic.
 *
 * If the function fails, this utility will retry the operation with
 * increasing delay intervals using an exponential backoff strategy.
 * The delay between attempts follows the formula: baseDelay * 2^(attempt-1)
 *
 * @template T The type of the return value from the function
 * @param {() => Promise<T>} fn - The async function to execute with retry logic
 * @param {number} [retries=MAX_RETRIES] - Maximum number of retry attempts
 * @param {number} [baseDelay=BASE_DELAY_MS] - Base delay in milliseconds
 * @returns {Promise<T>} The result of the successful function execution
 * @throws {Error} If all retry attempts fail, the last error is thrown
 * @internal
 */
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
