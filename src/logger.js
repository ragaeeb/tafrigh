import pino from 'pino';
import pretty from 'pino-pretty';
import process from 'process';

const stream = pretty({
    colorize: true,
});

const logger = pino(
    {
        base: { pid: undefined, hostname: undefined }, // This will remove pid and hostname but keep time
        ...(process.env.LOG_LEVEL && { level: process.env.LOG_LEVEL }),
    },
    stream,
);

export default logger;
