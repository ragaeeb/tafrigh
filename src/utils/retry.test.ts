import { beforeEach, describe, expect, it, mock, vi } from 'bun:test';

const setTimeoutMock = vi.fn<() => Promise<void>>().mockResolvedValue();

mock.module('node:timers/promises', () => ({
    setTimeout: setTimeoutMock,
}));

const loggerMock = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
};

mock.module('./logger.js', () => ({
    default: loggerMock,
}));

const { exponentialBackoffRetry } = await import('./retry.js');

describe('exponentialBackoffRetry', () => {
    beforeEach(() => {
        setTimeoutMock.mockReset().mockResolvedValue();
        for (const fn of Object.values(loggerMock)) {
            fn.mockReset();
        }
    });

    it('retries the provided function until it succeeds', async () => {
        const fn = vi.fn();
        fn.mockRejectedValueOnce(new Error('first failure'))
            .mockRejectedValueOnce(new Error('second failure'))
            .mockResolvedValue('success');

        const result = await exponentialBackoffRetry(fn, 3, 1000);

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
        expect(setTimeoutMock).toHaveBeenCalledTimes(2);
        expect(setTimeoutMock.mock.calls[0][0]).toBe(1000);
        expect(setTimeoutMock.mock.calls[1][0]).toBe(2000);
        expect(loggerMock.warn).toHaveBeenCalledTimes(2);
    });

    it('throws the last error when retries are exhausted', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('permanent failure'));

        await expect(exponentialBackoffRetry(fn, 2, 500)).rejects.toThrow('permanent failure');
        expect(fn).toHaveBeenCalledTimes(2);
        expect(loggerMock.error).toHaveBeenCalledWith('All 2 attempts failed.');
    });
});
