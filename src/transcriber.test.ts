import type { AudioChunk } from 'ffmpeg-simplified';

import { beforeEach, describe, expect, it, Mock, vi, vitest } from 'vitest';

import { getApiKeysCount, getNextApiKey } from './apiKeys';
import { transcribeAudioChunks } from './transcriber';
import { dictation } from './wit.ai';

vi.mock('./wit.ai');
vi.mock('./apiKeys.js', () => ({
    getApiKeysCount: vi.fn(),
    getNextApiKey: vi.fn(),
}));
vi.mock('./utils/logger');

describe('transcriber', () => {
    describe('transcribeAudioChunks', () => {
        let apiKey;
        let mockChunkFiles: AudioChunk[];

        beforeEach(() => {
            apiKey = 'mock-api-key';
            mockChunkFiles = [
                { filename: 'chunk1.wav', range: { end: 10, start: 0 } },
                { filename: 'chunk2.wav', range: { end: 20, start: 10 } },
            ];

            vi.clearAllMocks();
            (getNextApiKey as any).mockReturnValue(apiKey);
        });

        describe('single threaded', () => {
            it('should transcribe all audio chunks successfully', async () => {
                (dictation as any)
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: 'Transcript for chunk2' });

                const callbacks = {
                    onTranscriptionFinished: vitest.fn().mockResolvedValue(null),
                    onTranscriptionProgress: vitest.fn(),
                    onTranscriptionStarted: vitest.fn().mockResolvedValue(null),
                };

                const result = await transcribeAudioChunks(mockChunkFiles, { callbacks, concurrency: 1 });

                expect(result).toEqual([
                    { ...mockChunkFiles[0].range, text: 'Transcript for chunk1' },
                    { ...mockChunkFiles[1].range, text: 'Transcript for chunk2' },
                ]);
                expect(dictation).toHaveBeenCalledWith('chunk1.wav', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk2.wav', { apiKey });

                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledOnce();
                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledWith(mockChunkFiles.length);

                expect(callbacks.onTranscriptionProgress).toHaveBeenCalledTimes(2);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(1, 0);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(2, 1);

                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledOnce();
                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledWith(result);
            });

            it('should skip non-final transcriptions', async () => {
                (dictation as any)
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: undefined });

                const result = await transcribeAudioChunks(mockChunkFiles, { concurrency: 1 });

                expect(result).toEqual([{ ...mockChunkFiles[0].range, text: 'Transcript for chunk1' }]);
            });

            it('should return an empty array if all transcriptions fail', async () => {
                (dictation as any).mockRejectedValue(new Error('Network error'));

                await expect(transcribeAudioChunks(mockChunkFiles, { retries: 1 })).rejects.toThrow('Network error');
            });
        });

        describe('concurrent threads', () => {
            it('should transcribe multiple chunks in parallel with limited concurrency and adjust the start to reflect the tokens we get back', async () => {
                mockChunkFiles = [
                    { filename: 'chunk1.mp3', range: { end: 10, start: 0 } },
                    { filename: 'chunk2.mp3', range: { end: 20, start: 10 } },
                    { filename: 'chunk3.mp3', range: { end: 30, start: 20 } },
                ];

                (dictation as Mock).mockImplementation((filename) =>
                    Promise.resolve({
                        confidence: 1,
                        text: `Transcribed text for ${filename}`,
                        tokens: [
                            { confidence: 0.5, end: 4500, start: 500, token: 'Transcribed' },
                            { confidence: 0.5, end: 6500, start: 5500, token: 'text' },
                            { confidence: 0.5, end: 8500, start: 7500, token: 'for' },
                            { confidence: 0.5, end: 10500, start: 9500, token: filename },
                        ],
                    }),
                );

                (getNextApiKey as any).mockImplementation(() => apiKey);
                (getApiKeysCount as any).mockReturnValue(2); // Simulate 2 available API keys

                const callbacks = {
                    onTranscriptionFinished: vitest.fn().mockResolvedValue(null),
                    onTranscriptionProgress: vitest.fn(),
                    onTranscriptionStarted: vitest.fn().mockResolvedValue(null),
                };

                const result = await transcribeAudioChunks(mockChunkFiles, { callbacks, concurrency: 2 });

                expect(result).toEqual([
                    {
                        confidence: 1,
                        end: 10.5,
                        start: 0.5,
                        text: 'Transcribed text for chunk1.mp3',
                        tokens: [
                            { confidence: 0.5, end: 4.5, start: 0.5, text: 'Transcribed' },
                            { confidence: 0.5, end: 6.5, start: 5.5, text: 'text' },
                            { confidence: 0.5, end: 8.5, start: 7.5, text: 'for' },
                            { confidence: 0.5, end: 10.5, start: 9.5, text: 'chunk1.mp3' },
                        ],
                    },
                    {
                        confidence: 1,
                        end: 20.5,
                        start: 10.5,
                        text: 'Transcribed text for chunk2.mp3',
                        tokens: [
                            { confidence: 0.5, end: 14.5, start: 10.5, text: 'Transcribed' },
                            { confidence: 0.5, end: 16.5, start: 15.5, text: 'text' },
                            { confidence: 0.5, end: 18.5, start: 17.5, text: 'for' },
                            { confidence: 0.5, end: 20.5, start: 19.5, text: 'chunk2.mp3' },
                        ],
                    },
                    {
                        confidence: 1,
                        end: 30.5,
                        start: 20.5,
                        text: 'Transcribed text for chunk3.mp3',
                        tokens: [
                            { confidence: 0.5, end: 24.5, start: 20.5, text: 'Transcribed' },
                            { confidence: 0.5, end: 26.5, start: 25.5, text: 'text' },
                            { confidence: 0.5, end: 28.5, start: 27.5, text: 'for' },
                            { confidence: 0.5, end: 30.5, start: 29.5, text: 'chunk3.mp3' },
                        ],
                    },
                ]);

                // Ensure that dictation was called with each chunk filename
                expect(dictation).toHaveBeenCalledWith('chunk1.mp3', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk2.mp3', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk3.mp3', { apiKey });

                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledOnce();
                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledWith(mockChunkFiles.length);

                expect(callbacks.onTranscriptionProgress).toHaveBeenCalledTimes(3);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(1, 0);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(2, 1);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(3, 2);

                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledOnce();
                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledWith(result);
            });

            it('should limit concurrency when more API keys than chunks', async () => {
                const chunkFiles = [
                    { filename: 'chunk1.mp3', range: { end: 10, start: 0 } },
                    { filename: 'chunk2.mp3', range: { end: 20, start: 10 } },
                ];

                (dictation as Mock).mockImplementation((filename) =>
                    Promise.resolve({ text: `Transcribed text for ${filename}` }),
                );

                (getNextApiKey as any).mockImplementation(() => apiKey);
                (getApiKeysCount as any).mockReturnValue(10); // Simulate 10 available API keys

                const result = await transcribeAudioChunks(chunkFiles, { concurrency: 2 });

                expect(result).toHaveLength(2);
                expect(result[0].text).toBe('Transcribed text for chunk1.mp3');
                expect(result[1].text).toBe('Transcribed text for chunk2.mp3');

                expect(dictation).toHaveBeenCalledWith('chunk1.mp3', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk2.mp3', { apiKey });

                expect(getApiKeysCount).toHaveBeenCalled();
            });
        });
    });
});
