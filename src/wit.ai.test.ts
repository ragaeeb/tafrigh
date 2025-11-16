import { afterEach, beforeEach, describe, expect, it, mock, vi } from 'bun:test';

const requestMock = vi.fn();
const createReadStreamMock = vi.fn();
const jsonStreamParseMock = vi.fn();

mock.module('node:https', () => ({
    default: { request: requestMock },
    request: requestMock,
}));

mock.module('node:fs', () => ({
    createReadStream: createReadStreamMock,
    default: { createReadStream: createReadStreamMock },
}));

mock.module('jsonstream-next', () => ({
    default: { parse: jsonStreamParseMock },
    parse: jsonStreamParseMock,
}));

const { dictation, speechToText } = await import('./wit.ai.js');

describe('wit.ai', () => {
    beforeEach(() => {
        requestMock.mockReset();
        createReadStreamMock.mockReset().mockReturnValue({ pipe: vi.fn() });
        jsonStreamParseMock.mockReset();
    });

    afterEach(() => {
        requestMock.mockReset();
        createReadStreamMock.mockReset();
        jsonStreamParseMock.mockReset();
    });

    describe('speechToText', () => {
        const filePath = 'test.wav';
        const options = { apiKey: 'test-api-key' };

        it('should process the WAV file and return the final transcription', async () => {
            requestMock.mockImplementation((_url, _options, callback) => {
                const response = {
                    on: (event: string, handler: (chunk?: string) => void) => {
                        if (event === 'data') {
                            handler(
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
                            handler();
                        }
                        return response;
                    },
                    statusCode: 200,
                } as const;

                callback(response as any);

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
            requestMock.mockImplementation((_url, _options, callback) => {
                const response = {
                    on: (event: string, handler: () => void) => {
                        if (event === 'data') {
                            handler();
                        }
                        if (event === 'end') {
                            handler();
                        }
                        return response;
                    },
                    statusCode: 500,
                } as const;

                callback(response as any);

                return {
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            await expect(speechToText(filePath, options)).rejects.toThrow('HTTP error! status: 500');
        });

        it('should handle https request error', async () => {
            requestMock.mockImplementation(() => {
                const req = {
                    end: vi.fn(),
                    on: (event: string, handler: (error: Error) => void) => {
                        if (event === 'error') {
                            handler(new Error('test error'));
                        }
                        return req;
                    },
                } as const;

                return req;
            });

            await expect(speechToText(filePath, options)).rejects.toThrow('test error');
        });
    });

    describe('dictation', () => {
        const filePath = 'test.wav';
        const options = { apiKey: 'test-api-key' };

        it('should return the final transcription', async () => {
            const parserHandlers: Record<string, (value?: any) => void> = {};
            const parser = {
                on: (event: string, handler: (value?: unknown) => void) => {
                    parserHandlers[event] = handler;
                    return parser;
                },
            };
            jsonStreamParseMock.mockReturnValue(parser as any);

            const response = {
                on: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                statusCode: 200,
            };

            requestMock.mockImplementation((_options, callback) => {
                callback(response as any);
                return {
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            const resultPromise = dictation(filePath, options);

            parserHandlers.data?.({
                confidence: 0.95,
                tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }],
            });
            parserHandlers.data?.('some text');
            parserHandlers.data?.('FINAL_TRANSCRIPTION');
            parserHandlers.end?.();

            const result = await resultPromise;

            expect(result).toEqual({
                confidence: 0.95,
                text: ' some text',
                tokens: [{ confidence: 0.9, end: 5, start: 0, token: 'test' }],
            });
            expect(response.pipe).toHaveBeenCalledWith(parser);
        });

        it('should handle HTTP error', async () => {
            const response = {
                on: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                statusCode: 500,
            };

            requestMock.mockImplementation((_options, callback) => {
                callback(response as any);
                return {
                    on: vi.fn(),
                    pipe: vi.fn(),
                };
            });

            await expect(dictation(filePath, options)).rejects.toThrow('HTTP error! status: 500');
        });

        it('should handle https request error', async () => {
            requestMock.mockImplementation(() => {
                const req = {
                    end: vi.fn(),
                    on: (event: string, handler: (error: Error) => void) => {
                        if (event === 'error') {
                            handler(new Error('test error'));
                        }
                        return req;
                    },
                } as const;

                return req;
            });

            await expect(dictation(filePath, options)).rejects.toThrow('test error');
        });

        it('should handle JSONStream error', async () => {
            const parserHandlers: Record<string, (value?: any) => void> = {};
            const parser = {
                on: (event: string, handler: (value?: unknown) => void) => {
                    parserHandlers[event] = handler;
                    return parser;
                },
            };

            jsonStreamParseMock.mockReturnValue(parser as any);

            const response = {
                on: vi.fn(),
                pipe: vi.fn().mockReturnThis(),
                statusCode: 200,
            };

            requestMock.mockImplementation((_options, callback) => {
                callback(response as any);
                return {
                    end: vi.fn(),
                    on: vi.fn(),
                };
            });

            const promise = dictation(filePath, options);

            parserHandlers.error?.(new Error('test error'));

            await expect(promise).rejects.toThrow('test error');
        });
    });
});
