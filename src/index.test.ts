import { promises as fs } from 'node:fs';
import { type AudioChunk, formatMedia, splitFileOnSilences } from 'ffmpeg-simplified';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { TranscriptionError } from './errors.js';
import { transcribe } from './index.js';
import { transcribeAudioChunks } from './transcriber.js';

vi.mock('./transcriber.js', () => ({
    resumeFailedTranscriptions: vi.fn(),
    transcribeAudioChunks: vi.fn(),
}));

vi.mock('ffmpeg-simplified', async () => {
    return {
        formatMedia: vi.fn(),
        splitFileOnSilences: vi.fn(),
    };
});

vi.mock('./utils/logger.js');

describe('index', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('transcribe', () => {
        describe('happy path', () => {
            let chunkFiles: AudioChunk[];
            let testFile: string;

            beforeEach(() => {
                chunkFiles = [{ filename: 'chunk-001.wav', range: { end: 10, start: 0 } }];
                testFile = 'audio-file.mp3';

                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue(chunkFiles);
                (transcribeAudioChunks as Mock).mockResolvedValue({
                    failures: [],
                    transcripts: [{ end: 10, start: 0, text: 'Hello World' }],
                });
            });

            it('should process the transcription successfully', async () => {
                const result = await transcribe(testFile);

                expect(formatMedia).toHaveBeenCalledExactlyOnceWith(testFile, expect.any(String), undefined, undefined);

                expect(splitFileOnSilences).toHaveBeenCalledWith(
                    'processed.mp3',
                    expect.any(String),
                    undefined,
                    undefined,
                );
                expect(splitFileOnSilences).toHaveBeenCalledOnce();

                expect(transcribeAudioChunks).toHaveBeenCalledExactlyOnceWith(chunkFiles, {
                    callbacks: undefined,
                    concurrency: undefined,
                    retries: undefined,
                });

                expect(result).toEqual([{ end: 10, start: 0, text: 'Hello World' }]);
            });

            it('should process the transcription successfully', async () => {
                const result = await transcribe(testFile, {
                    concurrency: 2,
                });

                expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, {
                    callbacks: undefined,
                    concurrency: 2,
                    retries: undefined,
                });

                expect(result).toEqual([{ end: 10, start: 0, text: 'Hello World' }]);
            });
        });

        describe('failures', () => {
            it('should reject due to invalid options being provided', async () => {
                await expect(
                    transcribe('audio.mp3', {
                        splitOptions: { chunkDuration: -1 },
                    }),
                ).rejects.toThrow('chunkDuration=-1 cannot be less than 4s');

                await expect(
                    transcribe('audio.mp3', {
                        splitOptions: { chunkDuration: 1000 },
                    }),
                ).rejects.toThrow('chunkDuration=1000 cannot be greater than 300s');
            });

            it('should return an empty array when no chunks were generated', async () => {
                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue([]);

                const result = await transcribe('audio.mp3');

                expect(transcribeAudioChunks).not.toHaveBeenCalled();
                expect(result).toEqual([]);
            });

            it('should throw a TranscriptionError when a chunk fails to transcribe', async () => {
                const failingChunks = [
                    { filename: 'chunk-001.wav', range: { end: 10, start: 0 } },
                    { filename: 'chunk-002.wav', range: { end: 20, start: 10 } },
                ];

                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue(failingChunks);
                (transcribeAudioChunks as Mock).mockResolvedValue({
                    failures: [
                        {
                            chunk: failingChunks[1],
                            error: new Error('Rate limited'),
                            index: 1,
                        },
                    ],
                    transcripts: [{ end: 10, start: 0, text: 'Partial transcript' }],
                });

                let caughtError: unknown;

                try {
                    await transcribe('audio.mp3');
                } catch (error) {
                    caughtError = error;
                }

                expect(caughtError).toBeInstanceOf(TranscriptionError);

                const transcriptionError = caughtError as TranscriptionError;

                expect(transcriptionError.failures).toHaveLength(1);
                expect(transcriptionError.transcripts).toEqual([{ end: 10, start: 0, text: 'Partial transcript' }]);
                expect(transcriptionError.outputDir).toBeDefined();

                expect(transcribeAudioChunks).toHaveBeenCalledWith(failingChunks, {
                    callbacks: undefined,
                    concurrency: undefined,
                    retries: undefined,
                });

                await fs.rm(transcriptionError.outputDir!, { force: true, recursive: true });
            });
        });
    });
});
