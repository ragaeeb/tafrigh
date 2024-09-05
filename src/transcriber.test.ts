import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getApiKeysCount, getNextApiKey } from './apiKeys';
import { transcribeAudioChunks } from './transcriber';
import { AudioChunk } from './types';
import { dictation } from './wit.ai';

vi.mock('./wit.ai');
vi.mock('./apiKeys.js', () => ({
    getNextApiKey: vi.fn(),
    getApiKeysCount: vi.fn(),
}));
vi.mock('./utils/logger');
vi.mock('ora', () => {
    return {
        default: () => ({
            start: vi.fn().mockReturnThis(),
            succeed: vi.fn(),
            warn: vi.fn(),
            fail: vi.fn(),
            stop: vi.fn(),
        }),
    };
});

describe('transcriber', () => {
    describe('transcribeAudioChunks', () => {
        let apiKey;
        let mockChunkFiles: AudioChunk[];

        beforeEach(() => {
            apiKey = 'mock-api-key';
            mockChunkFiles = [
                { filename: 'chunk1.wav', range: { start: 0, end: 10 } },
                { filename: 'chunk2.wav', range: { start: 10, end: 20 } },
            ];

            vi.clearAllMocks();
            (getNextApiKey as any).mockReturnValue(apiKey);
        });

        describe('single threaded', () => {
            it('should transcribe all audio chunks successfully', async () => {
                (dictation as any)
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: 'Transcript for chunk2' });

                const result = await transcribeAudioChunks(mockChunkFiles, 1);

                expect(result).toEqual([
                    { range: mockChunkFiles[0].range, text: 'Transcript for chunk1' },
                    { range: mockChunkFiles[1].range, text: 'Transcript for chunk2' },
                ]);
                expect(dictation).toHaveBeenCalledWith('chunk1.wav', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk2.wav', { apiKey });
            });

            it('should skip non-final transcriptions', async () => {
                (dictation as any)
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: undefined });

                const result = await transcribeAudioChunks(mockChunkFiles, 1);

                expect(result).toEqual([{ range: mockChunkFiles[0].range, text: 'Transcript for chunk1' }]);
            });

            it('should log an error and continue if a chunk fails to transcribe', async () => {
                (dictation as any)
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockRejectedValueOnce(new Error('Network error'));

                await expect(transcribeAudioChunks(mockChunkFiles, 1)).rejects.toThrow('Network error');
            });

            it('should return an empty array if all transcriptions fail', async () => {
                (dictation as any).mockRejectedValue(new Error('Network error'));

                await expect(transcribeAudioChunks(mockChunkFiles, 1)).rejects.toThrow('Network error');
            });
        });

        describe('concurrent threads', () => {
            it('should transcribe multiple chunks in parallel with limited concurrency', async () => {
                const chunkFiles = [
                    { filename: 'chunk1.mp3', range: { start: 0, end: 10 } },
                    { filename: 'chunk2.mp3', range: { start: 10, end: 20 } },
                    { filename: 'chunk3.mp3', range: { start: 20, end: 30 } },
                ];

                const fakeTranscript = (text: string) => ({ text });

                (dictation as any).mockImplementation((filename) =>
                    Promise.resolve(fakeTranscript(`Transcribed text for ${filename}`)),
                );

                (getNextApiKey as any).mockImplementation(() => apiKey);
                (getApiKeysCount as any).mockReturnValue(2); // Simulate 2 available API keys

                const result = await transcribeAudioChunks(chunkFiles, 2);

                expect(result).toHaveLength(3);
                expect(result[0].text).toBe('Transcribed text for chunk1.mp3');
                expect(result[1].text).toBe('Transcribed text for chunk2.mp3');
                expect(result[2].text).toBe('Transcribed text for chunk3.mp3');

                // Ensure that dictation was called with each chunk filename
                expect(dictation).toHaveBeenCalledWith('chunk1.mp3', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk2.mp3', { apiKey });
                expect(dictation).toHaveBeenCalledWith('chunk3.mp3', { apiKey });
            });

            it('should limit concurrency when more API keys than chunks', async () => {
                const chunkFiles = [
                    { filename: 'chunk1.mp3', range: { start: 0, end: 10 } },
                    { filename: 'chunk2.mp3', range: { start: 10, end: 20 } },
                ];

                const fakeTranscript = (text: string) => ({ text });

                (dictation as any).mockImplementation((filename) =>
                    Promise.resolve(fakeTranscript(`Transcribed text for ${filename}`)),
                );

                (getNextApiKey as any).mockImplementation(() => apiKey);
                (getApiKeysCount as any).mockReturnValue(10); // Simulate 10 available API keys
                const concurrencyLimit = 2;

                const result = await transcribeAudioChunks(chunkFiles, concurrencyLimit);

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
