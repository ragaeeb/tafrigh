import axios from 'axios';
import fs from 'fs';
import JSONStream from 'jsonstream-next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dictation, speechToText } from './wit.ai';

vi.mock('axios');
vi.mock('fs');
vi.mock('jsonstream-next');

describe('wit.ai', () => {
    const mockOptions = { apiKey: 'test-api-key' };
    const mockFilePath = 'test-file.wav';

    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('speechToText', () => {
        it('should process WAV file correctly', async () => {
            const mockResponse = {
                data: {
                    text: 'Hello, world!',
                    speech: {
                        confidence: 0.95,
                        tokens: [
                            { confidence: 0.98, end: 1, start: 0, token: 'Hello' },
                            { confidence: 0.92, end: 2, start: 1, token: 'world' },
                        ],
                    },
                },
            };

            (axios.post as any).mockResolvedValue(mockResponse);
            (fs.createReadStream as any).mockReturnValue('mock-stream');

            const result = await speechToText(mockFilePath, mockOptions);

            expect(axios.post).toHaveBeenCalledWith('https://api.wit.ai/speech', 'mock-stream', {
                headers: {
                    Authorization: 'Bearer test-api-key',
                    'Content-Type': 'audio/wav',
                    Accept: 'application/vnd.wit.20200513+json',
                },
                responseType: 'json',
            });

            expect(result).toEqual({
                text: 'Hello, world!',
                confidence: 0.95,
                tokens: [
                    { confidence: 0.98, end: 1, start: 0, token: 'Hello' },
                    { confidence: 0.92, end: 2, start: 1, token: 'world' },
                ],
            });
        });

        it('should handle MP3 file correctly', async () => {
            const mp3FilePath = 'test-file.mp3';
            const mockResponse = { data: { text: 'MP3 audio' } };

            (axios.post as any).mockResolvedValue(mockResponse);
            (fs.createReadStream as any).mockReturnValue('mock-stream');

            await speechToText(mp3FilePath, mockOptions);

            expect(axios.post).toHaveBeenCalledWith(
                'https://api.wit.ai/speech',
                'mock-stream',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Content-Type': 'audio/mpeg3',
                    }),
                }),
            );
        });

        it('should handle errors', async () => {
            (axios.post as any).mockRejectedValue(new Error('API Error'));

            await expect(speechToText(mockFilePath, mockOptions)).rejects.toThrow('API Error');
        });
    });

    describe('dictation', () => {
        it('should process dictation correctly', async () => {
            const mockStream = {
                pipe: vi.fn(),
                on: vi.fn(),
            };

            const mockParser = {
                [Symbol.asyncIterator]: vi.fn().mockImplementation(function* () {
                    yield 'PARTIAL_TRANSCRIPTION';
                    yield { text: 'Hello2' };
                    yield true;
                    yield { text: 'Hello' };
                    yield 'FINAL_TRANSCRIPTION';
                    yield true;
                    yield { text: 'world', confidence: 0.9 };
                    yield 'FINAL_TRANSCRIPTION';
                }),
            };

            (axios.post as any).mockResolvedValue({ data: mockStream });
            (JSONStream.parse as any).mockReturnValue(mockParser);
            (fs.createReadStream as any).mockReturnValue('mock-stream');

            const result = await dictation(mockFilePath, mockOptions);

            expect(axios.post).toHaveBeenCalledWith('https://api.wit.ai/dictation?v=20240304', 'mock-stream', {
                headers: {
                    Authorization: 'Bearer test-api-key',
                    'Content-Type': 'audio/wav',
                },
                responseType: 'stream',
            });

            expect(result).toEqual({
                tokens: [],
                text: ' Hello world',
                confidence: 0.9,
            });
        });

        it('should handle errors in dictation', async () => {
            (axios.post as any).mockRejectedValue(new Error('Dictation API Error'));

            await expect(dictation(mockFilePath, mockOptions)).rejects.toThrow('Dictation API Error');
        });
    });
});
