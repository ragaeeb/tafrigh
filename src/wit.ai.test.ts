import https from 'https';
import JSONStream from 'jsonstream-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dictation, speechToText } from './wit.ai';

vi.mock('https');
vi.mock('fs');
vi.mock('jsonstream-next');

describe('wit.ai', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('speechToText', () => {
        const filePath = 'test.wav';
        const options = { apiKey: 'test-api-key' };

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should process the WAV file and return the final transcription', async () => {
            const mockResponse = {
                statusCode: 200,
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback(
                            JSON.stringify({
                                text: 'test transcription',
                                speech: {
                                    confidence: 0.9,
                                    tokens: [{ confidence: 0.9, start: 0, end: 5, token: 'test' }],
                                },
                            }),
                        );
                    }
                    if (event === 'end') {
                        callback();
                    }
                }),
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_url, _options, callback: any) => {
                callback(mockResponse as any);
                return {
                    on: vi.fn(),
                    end: vi.fn(),
                };
            });

            const result = await speechToText(filePath, options);

            expect(result).toEqual({
                text: 'test transcription',
                confidence: 0.9,
                tokens: [{ confidence: 0.9, start: 0, end: 5, token: 'test' }],
            });
        });

        it('should handle HTTP error response', async () => {
            const mockResponse = {
                statusCode: 500,
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback('');
                    }
                    if (event === 'end') {
                        callback();
                    }
                }),
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_url, _options, callback: any) => {
                callback(mockResponse as any);
                return {
                    on: vi.fn(),
                    end: vi.fn(),
                };
            });

            await expect(speechToText(filePath, options)).rejects.toThrow('HTTP error! status: 500');
        });

        it('should handle https request error', async () => {
            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation(() => {
                const req = {
                    on: vi.fn((event, callback) => {
                        if (event === 'error') {
                            callback(new Error('test error'));
                        }
                    }),
                    end: vi.fn(),
                };
                return req;
            });

            await expect(speechToText(filePath, options)).rejects.toThrow('test error');
        });
    });

    describe('dictation', () => {
        const filePath = 'test.wav';
        const options = { apiKey: 'test-api-key' };

        it('should return the final transcription', async () => {
            const mockResponse = {
                statusCode: 200,
                pipe: vi.fn().mockReturnThis(),
            };

            const mockJSONStream = {
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback({ tokens: [{ token: 'test', start: 0, end: 5, confidence: 0.9 }], confidence: 0.95 });
                        callback('some text');
                        callback('FINAL_TRANSCRIPTION');
                    } else if (event === 'end') {
                        callback();
                    }
                }),
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_options, callback: any) => {
                callback(mockResponse);
                return {
                    on: vi.fn(),
                    end: vi.fn(),
                };
            });

            vi.spyOn(JSONStream, 'parse').mockReturnValue(mockJSONStream as any);

            const result = await dictation(filePath, options);

            expect(result).toEqual({
                text: ' some text',
                confidence: 0.95,
                tokens: [{ token: 'test', start: 0, end: 5, confidence: 0.9 }],
            });
        });

        it('should handle HTTP error', async () => {
            const mockResponse = {
                statusCode: 500,
                pipe: vi.fn().mockReturnThis(),
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_options, callback: any) => {
                callback(mockResponse);
                return {
                    on: vi.fn(),
                    pipe: vi.fn().mockReturnThis(),
                };
            });

            await expect(dictation(filePath, options)).rejects.toEqual(new Error('HTTP error! status: 500'));
        });

        it('should handle https request error', async () => {
            vi.spyOn(https, 'request').mockImplementation(() => {
                const req = {
                    on: vi.fn((event, callback) => {
                        if (event === 'error') {
                            callback(new Error('test error'));
                        }
                    }),
                    end: vi.fn(),
                };
                return req as any;
            });

            await expect(dictation(filePath, options)).rejects.toEqual(new Error('test error'));
        });

        it('should handle JSONStream error', async () => {
            const mockResponse = {
                statusCode: 200,
                pipe: vi.fn().mockReturnThis(),
            };

            const mockJSONStream = {
                parse: vi.fn().mockReturnThis(),
                on: vi.fn((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('test error'));
                    }
                }),
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_options, callback: any) => {
                callback(mockResponse);
                return {
                    on: vi.fn(),
                    pipe: vi.fn().mockReturnThis(),
                };
            });

            vi.spyOn(JSONStream, 'parse').mockReturnValue(mockJSONStream as any);

            await expect(dictation(filePath, options)).rejects.toEqual(new Error('test error'));
        });
    });
});
