import pino, { Logger } from 'pino';
import process from 'process';

const logger: Logger = pino({
    base: { hostname: undefined, pid: undefined }, // This will remove pid and hostname but keep time
    level: process.env.LOG_LEVEL || 'info',
});

export default logger;
