import { beforeEach, describe, expect, it, mock, vi } from 'bun:test';
import type { AudioChunk } from 'ffmpeg-simplified';

const dictationMock = vi.fn();

mock.module('./wit.ai.js', () => ({
    dictation: dictationMock,
}));

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

const { setApiKeys } = await import('./apiKeys.js');
const { resumeFailedTranscriptions, transcribeAudioChunks } = await import('./transcriber.ts');

describe('transcriber', () => {
    describe('transcribeAudioChunks', () => {
        let apiKey: string;
        let mockChunkFiles: AudioChunk[];

        beforeEach(() => {
            apiKey = 'mock-api-key';
            mockChunkFiles = [
                { filename: 'chunk1.wav', range: { end: 10, start: 0 } },
                { filename: 'chunk2.wav', range: { end: 20, start: 10 } },
            ];

            dictationMock.mockReset();
            for (const fn of Object.values(loggerMock)) {
                fn.mockReset();
            }
            setApiKeys([apiKey]);
        });

        describe('single threaded', () => {
            it('should transcribe all audio chunks successfully', async () => {
                dictationMock
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: 'Transcript for chunk2' });

                const callbacks = {
                    onTranscriptionFinished: vi.fn().mockResolvedValue(undefined),
                    onTranscriptionProgress: vi.fn(),
                    onTranscriptionStarted: vi.fn().mockResolvedValue(undefined),
                };

                const result = await transcribeAudioChunks(mockChunkFiles, { callbacks, concurrency: 1 });

                expect(result).toEqual({
                    failures: [],
                    transcripts: [
                        { ...mockChunkFiles[0].range, text: 'Transcript for chunk1' },
                        { ...mockChunkFiles[1].range, text: 'Transcript for chunk2' },
                    ],
                });
                expect(dictationMock).toHaveBeenCalledWith('chunk1.wav', { apiKey });
                expect(dictationMock).toHaveBeenCalledWith('chunk2.wav', { apiKey });

                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledTimes(1);
                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledWith(mockChunkFiles.length);

                expect(callbacks.onTranscriptionProgress).toHaveBeenCalledTimes(2);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(1, 0);
                expect(callbacks.onTranscriptionProgress).toHaveBeenNthCalledWith(2, 1);

                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledTimes(1);
                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledWith(result.transcripts);
            });

            it('should skip non-final transcriptions', async () => {
                dictationMock
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockResolvedValueOnce({ text: undefined });

                const result = await transcribeAudioChunks(mockChunkFiles, { concurrency: 1 });

                expect(result).toEqual({
                    failures: [],
                    transcripts: [{ ...mockChunkFiles[0].range, text: 'Transcript for chunk1' }],
                });
            });

            it('should return an object with info if all transcriptions fail', async () => {
                dictationMock.mockRejectedValue(new Error('Network error'));

                const callbacks = {
                    onTranscriptionFinished: vi.fn(),
                    onTranscriptionProgress: vi.fn(),
                };

                const result = await transcribeAudioChunks(mockChunkFiles, { callbacks, retries: 1 });

                expect(result.transcripts).toEqual([]);
                expect(result.failures).toHaveLength(mockChunkFiles.length);
                expect(result.failures[0]).toMatchObject({ chunk: mockChunkFiles[0], index: 0 });
                expect(callbacks.onTranscriptionProgress).toHaveBeenCalledTimes(mockChunkFiles.length);
                expect(callbacks.onTranscriptionFinished).not.toHaveBeenCalled();
            });

            it('should allow resuming failed chunks', async () => {
                dictationMock
                    .mockResolvedValueOnce({ text: 'Transcript for chunk1' })
                    .mockRejectedValueOnce(new Error('Rate limited'));

                const initialResult = await transcribeAudioChunks(mockChunkFiles, { concurrency: 1, retries: 1 });

                expect(initialResult.failures).toHaveLength(1);
                expect(initialResult.transcripts).toEqual([
                    { ...mockChunkFiles[0].range, text: 'Transcript for chunk1' },
                ]);

                dictationMock.mockResolvedValueOnce({ text: 'Transcript for chunk2 (retry)' });

                const resumed = await resumeFailedTranscriptions(initialResult, { concurrency: 1 });

                expect(dictationMock).toHaveBeenCalledTimes(3);

                expect(resumed.failures).toHaveLength(0);
                expect(resumed.transcripts).toEqual([
                    { ...mockChunkFiles[0].range, text: 'Transcript for chunk1' },
                    { ...mockChunkFiles[1].range, text: 'Transcript for chunk2 (retry)' },
                ]);
            });
        });

        describe('concurrent threads', () => {
            it('should transcribe multiple chunks in parallel with limited concurrency and adjust timings from tokens', async () => {
                mockChunkFiles = [
                    { filename: 'chunk1.mp3', range: { end: 10, start: 0 } },
                    { filename: 'chunk2.mp3', range: { end: 20, start: 10 } },
                    { filename: 'chunk3.mp3', range: { end: 30, start: 20 } },
                ];

                dictationMock.mockImplementation((filename: string) =>
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

                setApiKeys(['mock-api-key-1', 'mock-api-key-2']);

                const callbacks = {
                    onTranscriptionFinished: vi.fn().mockResolvedValue(undefined),
                    onTranscriptionProgress: vi.fn(),
                    onTranscriptionStarted: vi.fn().mockResolvedValue(undefined),
                };

                const result = await transcribeAudioChunks(mockChunkFiles, { callbacks, concurrency: 2 });

                expect(result).toEqual({
                    failures: [],
                    transcripts: [
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
                    ],
                });

                expect(callbacks.onTranscriptionStarted).toHaveBeenCalledWith(mockChunkFiles.length);
                expect(callbacks.onTranscriptionProgress.mock.calls).toHaveLength(mockChunkFiles.length);
                expect(callbacks.onTranscriptionFinished).toHaveBeenCalledWith(result.transcripts);
            });
        });
    });
});
