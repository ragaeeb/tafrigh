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
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback(
                            JSON.stringify({
                                speech: {
                                    confidence: 0.9,
                                    tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }],
                                },
                                text: 'test transcription',
                            }),
                        );
                    }
                    if (event === 'end') {
                        callback();
                    }
                }),
                statusCode: 200,
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_url, _options, callback: any) => {
                callback(mockResponse as any);
                return {
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            const result = await speechToText(filePath, options);

            expect(result).toEqual({
                confidence: 0.9,
                text: 'test transcription',
                tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }],
            });
        });

        it('should handle HTTP error response', async () => {
            const mockResponse = {
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback('');
                    }
                    if (event === 'end') {
                        callback();
                    }
                }),
                statusCode: 500,
            };

            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation((_url, _options, callback: any) => {
                callback(mockResponse as any);
                return {
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            await expect(speechToText(filePath, options)).rejects.toThrow('HTTP error! status: 500');
        });

        it('should handle https request error', async () => {
            // @ts-expect-error ignore
            vi.spyOn(https, 'request').mockImplementation(() => {
                const req = {
                    end: vi.fn(),
                    on: vi.fn((event, callback) => {
                        if (event === 'error') {
                            callback(new Error('test error'));
                        }
                    }),
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
                pipe: vi.fn().mockReturnThis(),
                statusCode: 200,
            };

            const mockJSONStream = {
                on: vi.fn((event, callback) => {
                    if (event === 'data') {
                        callback({ confidence: 0.95, tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }] });
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
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            vi.spyOn(JSONStream, 'parse').mockReturnValue(mockJSONStream as any);

            const result = await dictation(filePath, options);

            expect(result).toEqual({
                confidence: 0.95,
                text: ' some text',
                tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }],
            });
        });

        it('should handle HTTP error', async () => {
            const mockResponse = {
                pipe: vi.fn().mockReturnThis(),
                statusCode: 500,
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
                    end: vi.fn(),
                    on: vi.fn((event, callback) => {
                        if (event === 'error') {
                            callback(new Error('test error'));
                        }
                    }),
                };
                return req as any;
            });

            await expect(dictation(filePath, options)).rejects.toEqual(new Error('test error'));
        });

        it('should handle JSONStream error', async () => {
            const mockResponse = {
                pipe: vi.fn().mockReturnThis(),
                statusCode: 200,
            };

            const mockJSONStream = {
                on: vi.fn((event, callback) => {
                    if (event === 'error') {
                        callback(new Error('test error'));
                    }
                }),
                parse: vi.fn().mockReturnThis(),
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
