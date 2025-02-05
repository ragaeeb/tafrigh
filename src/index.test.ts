import { createTempDir, fileExists, formatMedia, splitFileOnSilences } from 'ffmpeg-simplified';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { getTranscription, transcribe } from './index.js';
import { transcribeAudioChunks } from './transcriber.js';

vi.mock('./transcriber.js', () => ({
    transcribeAudioChunks: vi.fn(),
}));

vi.mock('ffmpeg-simplified', async () => {
    const actual = await vi.importActual<typeof import('ffmpeg-simplified')>('ffmpeg-simplified');
    return {
        ...actual,
        formatMedia: vi.fn(),
        splitFileOnSilences: vi.fn(),
    };
});

vi.mock('./utils/logger.js');

describe('index', () => {
    let outputDir;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    beforeAll(async () => {
        outputDir = await createTempDir();
    });

    afterAll(async () => {
        await fs.rm(outputDir, { recursive: true });
    });

    describe('transcribe', () => {
        describe('happy path', () => {
            let chunkFiles;
            let testFile;
            let outputFile;

            beforeEach(() => {
                chunkFiles = [{ filename: 'chunk-001.wav', range: { end: 10, start: 0 } }];
                testFile = 'audio-file.mp3';

                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue(chunkFiles);
                (transcribeAudioChunks as Mock).mockResolvedValue([
                    { range: { end: 10, start: 0 }, text: 'Hello World' },
                ]);

                outputFile = path.join(outputDir, 'output.json');
            });

            it('should process the transcription successfully and not delete the temporary folder where the output was generated', async () => {
                const result = await transcribe(testFile, { outputOptions: { outputFile } });

                expect(formatMedia).toHaveBeenCalledWith(testFile, expect.any(String), undefined, undefined);
                expect(formatMedia).toHaveBeenCalledOnce();

                expect(splitFileOnSilences).toHaveBeenCalledWith(
                    'processed.mp3',
                    expect.any(String),
                    undefined,
                    undefined,
                );
                expect(splitFileOnSilences).toHaveBeenCalledOnce();

                expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, {
                    callbacks: undefined,
                    retries: undefined,
                });
                expect(transcribeAudioChunks).toHaveBeenCalledOnce();

                const data = JSON.parse(await fs.readFile(result, 'utf8'));
                expect(data).toEqual([{ end: 10, start: 0, text: 'Hello World' }]);
            });

            it('should process the transcription successfully', async () => {
                const result = await transcribe(testFile, {
                    concurrency: 2,
                    outputOptions: { outputFile },
                });

                expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, {
                    callbacks: undefined,
                    concurrency: 2,
                    retries: undefined,
                });

                const isOutputFileWritten = await fileExists(result);
                expect(isOutputFileWritten).toBe(true);
            });
        });

        describe('failures', () => {
            it('should reject due to invalid options being provided', async () => {
                await expect(
                    transcribe('audio.mp3', {
                        outputOptions: { outputFile: 'any.json' },
                        splitOptions: { chunkDuration: -1 },
                    }),
                ).rejects.toThrow('chunkDuration=-1 cannot be less than 4s');

                await expect(
                    transcribe('audio.mp3', {
                        outputOptions: { outputFile: 'any.json' },
                        splitOptions: { chunkDuration: 1000 },
                    }),
                ).rejects.toThrow('chunkDuration=1000 cannot be greater than 300s');
            });

            it('should return an empty string there was no chunks generated', async () => {
                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue([]);

                const result = await transcribe('audio.mp3', { outputOptions: { outputFile: 'any.json' } });

                expect(transcribeAudioChunks).not.toHaveBeenCalled();
                expect(result).toEqual('');
            });
        });
    });

    describe('getTranscription', () => {
        let chunkFiles;
        let testFile;

        beforeEach(() => {
            chunkFiles = [{ filename: 'chunk-001.wav', range: { end: 10, start: 0 } }];
            testFile = 'audio-file.mp3';

            (formatMedia as Mock).mockResolvedValue('processed.mp3');
            (splitFileOnSilences as Mock).mockResolvedValue(chunkFiles);
            (transcribeAudioChunks as Mock).mockResolvedValue([{ range: { end: 10, start: 0 }, text: 'Hello World' }]);
        });

        it('should process the transcription successfully', async () => {
            const transcripts = await getTranscription(testFile);

            expect(formatMedia).toHaveBeenCalledWith(testFile, expect.any(String), undefined, undefined);
            expect(formatMedia).toHaveBeenCalledOnce();

            expect(splitFileOnSilences).toHaveBeenCalledWith('processed.mp3', expect.any(String), undefined, undefined);
            expect(splitFileOnSilences).toHaveBeenCalledOnce();

            expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, {
                callbacks: undefined,
                retries: undefined,
            });
            expect(transcribeAudioChunks).toHaveBeenCalledOnce();

            expect(transcripts).toEqual([{ range: { end: 10, start: 0 }, text: 'Hello World' }]);
        });

        it('should process the transcription with the line breaks without any formatting', async () => {
            (transcribeAudioChunks as Mock).mockResolvedValue([
                {
                    range: { end: 10, start: 0 },
                    text: 'Hello World',
                    tokens: [
                        { end: 4, start: 0, token: 'Hello' },
                        { end: 10, start: 8, token: 'World' },
                    ],
                },
            ]);

            const transcripts = await getTranscription(testFile, {
                lineBreakSecondsThreshold: 2,
                preprocessOptions: { noiseReduction: null },
            });

            expect(splitFileOnSilences).toHaveBeenCalledWith('processed.mp3', expect.any(String), undefined, undefined);

            expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, {
                callbacks: undefined,
                retries: undefined,
            });
            expect(transcribeAudioChunks).toHaveBeenCalledOnce();

            expect(transcripts).toEqual([
                {
                    range: { end: 10, start: 0 },
                    text: 'Hello\nWorld',
                    tokens: [
                        { end: 4, start: 0, token: 'Hello' },
                        { end: 10, start: 8, token: 'World' },
                    ],
                },
            ]);
        });

        describe('failures', () => {
            it('should reject due to invalid options being provided', async () => {
                await expect(getTranscription('audio.mp3', { splitOptions: { chunkDuration: -1 } })).rejects.toThrow(
                    'chunkDuration=-1 cannot be less than 4s',
                );
            });

            it('should return an empty string there was no chunks generated', async () => {
                (formatMedia as Mock).mockResolvedValue('processed.mp3');
                (splitFileOnSilences as Mock).mockResolvedValue([]);

                const result = await getTranscription('audio.mp3');

                expect(transcribeAudioChunks).not.toHaveBeenCalled();
                expect(result).toEqual([]);
            });
        });
    });
});
