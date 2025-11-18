import { afterAll, beforeEach, describe, expect, it, mock, vi } from 'bun:test';
import type { AudioChunk } from 'ffmpeg-simplified';

const mkdtempMock = vi.fn<() => Promise<string>>().mockResolvedValue('temp-dir');
const rmMock = vi.fn<() => Promise<void>>().mockResolvedValue();

mock.module('node:fs', () => ({
    default: {
        promises: {
            mkdtemp: mkdtempMock,
            rm: rmMock,
        },
    },
    promises: {
        mkdtemp: mkdtempMock,
        rm: rmMock,
    },
}));

const formatMediaMock =
    vi.fn<(source: string, destination: string, preprocess?: unknown, callbacks?: unknown) => Promise<string>>();
const splitFileOnSilencesMock =
    vi.fn<
        (filePath: string, outputDir: string, splitOptions?: unknown, callbacks?: unknown) => Promise<AudioChunk[]>
    >();

mock.module('ffmpeg-simplified', () => ({
    formatMedia: formatMediaMock,
    splitFileOnSilences: splitFileOnSilencesMock,
}));

const transcribeAudioChunksMock = vi.fn();

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

const transcriberModule = await import('./transcriber.js');
const transcribeAudioChunksSpy = vi
    .spyOn(transcriberModule, 'transcribeAudioChunks')
    .mockImplementation(transcribeAudioChunksMock);

const { promises: fs } = await import('node:fs');
const { TranscriptionError } = await import('./errors.js');
const { transcribe } = await import('./index.js');

describe('index', () => {
    beforeEach(() => {
        mkdtempMock.mockReset().mockResolvedValue('temp-dir');
        rmMock.mockReset().mockResolvedValue();
        formatMediaMock.mockReset();
        splitFileOnSilencesMock.mockReset();
        transcribeAudioChunksMock.mockReset();
        for (const fn of Object.values(loggerMock)) {
            fn.mockReset();
        }
    });

    describe('transcribe', () => {
        describe('happy path', () => {
            let chunkFiles: AudioChunk[];
            let testFile: string;

            beforeEach(() => {
                chunkFiles = [{ filename: 'chunk-001.wav', range: { end: 10, start: 0 } }];
                testFile = 'audio-file.mp3';

                formatMediaMock.mockResolvedValue('processed.mp3');
                splitFileOnSilencesMock.mockResolvedValue(chunkFiles);
                transcribeAudioChunksMock.mockResolvedValue({
                    failures: [],
                    transcripts: [{ end: 10, start: 0, text: 'Hello World' }],
                });
            });

            it('should process the transcription successfully', async () => {
                const result = await transcribe(testFile);

                expect(formatMediaMock).toHaveBeenCalledTimes(1);
                expect(formatMediaMock).toHaveBeenCalledWith(testFile, expect.any(String), undefined, undefined);

                expect(splitFileOnSilencesMock).toHaveBeenCalledWith(
                    'processed.mp3',
                    expect.any(String),
                    undefined,
                    undefined,
                );
                expect(splitFileOnSilencesMock).toHaveBeenCalledTimes(1);

                expect(transcribeAudioChunksMock).toHaveBeenCalledTimes(1);
                expect(transcribeAudioChunksMock).toHaveBeenCalledWith(chunkFiles, {
                    callbacks: undefined,
                    concurrency: undefined,
                    retries: undefined,
                });

                expect(result).toEqual([{ end: 10, start: 0, text: 'Hello World' }]);
            });

            it('should forward the provided concurrency option', async () => {
                const result = await transcribe(testFile, {
                    concurrency: 2,
                });

                expect(transcribeAudioChunksMock).toHaveBeenCalledWith(chunkFiles, {
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
                formatMediaMock.mockResolvedValue('processed.mp3');
                splitFileOnSilencesMock.mockResolvedValue([]);

                const result = await transcribe('audio.mp3');

                expect(transcribeAudioChunksMock).not.toHaveBeenCalled();
                expect(result).toEqual([]);
            });

            it('should throw a TranscriptionError when a chunk fails to transcribe', async () => {
                const failingChunks = [
                    { filename: 'chunk-001.wav', range: { end: 10, start: 0 } },
                    { filename: 'chunk-002.wav', range: { end: 20, start: 10 } },
                ];

                formatMediaMock.mockResolvedValue('processed.mp3');
                splitFileOnSilencesMock.mockResolvedValue(failingChunks);
                transcribeAudioChunksMock.mockResolvedValue({
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

                expect(transcribeAudioChunksMock).toHaveBeenCalledWith(failingChunks, {
                    callbacks: undefined,
                    concurrency: undefined,
                    retries: undefined,
                });

                await fs.rm(transcriptionError.outputDir!, { force: true, recursive: true });
            });
        });

        afterAll(() => {
            transcribeAudioChunksSpy.mockRestore();
        });
    });
});
