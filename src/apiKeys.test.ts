import { beforeEach, describe, expect, it, mock, vi } from 'bun:test';

const loggerMock = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
};

mock.module('./utils/logger.js', () => ({
    default: loggerMock,
}));

process.env.WIT_AI_API_KEYS = '';

const { getApiKeysCount, getNextApiKey, setApiKeys } = await import('./apiKeys.js');

describe('apiKeys', () => {
    beforeEach(() => {
        for (const fn of Object.values(loggerMock)) {
            fn.mockReset();
        }
        setApiKeys(['alpha', 'bravo']);
    });

    it('should return the number of configured keys', () => {
        expect(getApiKeysCount()).toBe(2);

        setApiKeys(['single']);
        expect(getApiKeysCount()).toBe(1);
    });

    it('should rotate through API keys in round-robin order', () => {
        expect(getNextApiKey()).toBe('alpha');
        expect(getNextApiKey()).toBe('bravo');
        expect(getNextApiKey()).toBe('alpha');
    });

    it('should throw when no API keys are configured', () => {
        expect(() => setApiKeys([])).toThrow('Empty wit.ai API keys');
        expect(loggerMock.error).toHaveBeenCalledWith(
            'At least one Wit.ai API key is required. Please set them in your environment variables.',
        );
    });
});
