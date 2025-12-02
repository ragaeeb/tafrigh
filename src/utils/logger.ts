import type { Logger } from '../types.js';

// Default no-op logger
let logger: Logger = {
    debug: () => {},
    error: () => {},
    info: () => {},
    trace: () => {},
    warn: () => {},
};

/**
 * Sets a custom logger instance for the library.
 * @internal
 */
export const setLogger = (customLogger: Logger) => {
    logger = customLogger;
};

/**
 * Gets the current logger instance.
 * @internal
 */
export const getLogger = (): Logger => logger;

export default logger;
