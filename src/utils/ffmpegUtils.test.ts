import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectSilences, formatMedia, getMediaDuration, splitAudioFile } from './ffmpegUtils';
import { createTempDir, fileExists } from './io';

describe('ffmpegUtils', () => {
    let testFilePath;
    let outputDir;

    beforeAll(async () => {
        outputDir = await createTempDir();
    });

    beforeEach(() => {
        vi.clearAllMocks(); // Reset all mocks before each test
        testFilePath = 'testing/khutbah.mp3';
    });

    describe('getMediaDuration', () => {
        it('should detect the duration of the media', async () => {
            const result = await getMediaDuration('testing/khutbah.wav');
            expect(result).toBeCloseTo(33.593469, 6);
        });
    });

    describe('formatMedia', () => {
        it('should call ffmpeg with the correct arguments when noiseReduction is enabled with custom options', async () => {
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            // Run the actual function with noiseReduction enabled with custom values
            await formatMedia(testFilePath, outputDir, {
                noiseReduction: {
                    highpass: 250,
                    afftdnStart: 0.5,
                    afftdnStop: 2,
                    afftdn_nf: -25,
                    dialogueEnhance: true,
                    lowpass: 3500,
                },
            });

            expect(mockAudioFilters).toHaveBeenCalledWith([
                'highpass=f=250',
                'asendcmd=0.5 afftdn sn start',
                'asendcmd=2 afftdn sn stop',
                'afftdn=nf=-25',
                'dialoguenhance',
                'lowpass=f=3500',
            ]);
        });

        it('should call ffmpeg omitting all the null options', async () => {
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            // Run the actual function with noiseReduction enabled with custom values
            await formatMedia(testFilePath, outputDir, {
                noiseReduction: {
                    highpass: null,
                    afftdnStart: null,
                    afftdnStop: 2,
                    afftdn_nf: null,
                    dialogueEnhance: true,
                    lowpass: null,
                },
            });

            expect(mockAudioFilters).toHaveBeenCalledWith(['dialoguenhance']);
        });

        it('should call ffmpeg with the right format', async () => {
            const mockAudioChannels = vi.spyOn(ffmpeg.prototype, 'audioChannels');
            const mockSave = vi.spyOn(ffmpeg.prototype, 'save');

            await formatMedia(testFilePath, outputDir);

            expect(mockAudioChannels).toHaveBeenCalledWith(1);
            expect(mockSave).toHaveBeenCalled();
        });

        it('should correctly output the file', async () => {
            await formatMedia(testFilePath, outputDir);

            const result = await fileExists(testFilePath);
            expect(result).toBe(true);

            const duration = await getMediaDuration(testFilePath);
            expect(duration).toBeCloseTo(33.5935, 3);
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is enabled with default options', async () => {
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            await formatMedia(testFilePath, outputDir, { noiseReduction: {} });

            expect(mockAudioFilters).toHaveBeenCalledWith([
                'highpass=f=300',
                'asendcmd=0 afftdn sn start',
                'asendcmd=1.5 afftdn sn stop',
                'afftdn=nf=-20',
                'dialoguenhance',
                'lowpass=f=3000',
            ]);
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is disabled', async () => {
            await formatMedia(testFilePath, outputDir, { noiseReduction: null });
            expect(ffmpeg.prototype.audioFilters).not.toHaveBeenCalled();
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is not provided (default to false)', async () => {
            await formatMedia(testFilePath, outputDir);
            expect(ffmpeg.prototype.audioFilters).toHaveBeenCalled();
        });
    });

    describe('detectSilences', () => {
        it('should detect silences for -35dB for 0.2s', async () => {
            const result = await detectSilences('testing/khutbah.wav', { silenceThreshold: -35, silenceDuration: 0.2 });
            expect(result).toEqual([
                { start: 0, end: 0.917551 },
                { start: 1.258957, end: 1.50263 },
                { start: 7.343764, end: 8.355329 },
                { start: 14.573605, end: 14.872517 },
                { start: 14.872562, end: 15.507075 },
                { start: 18.28966, end: 18.541905 },
                { start: 18.591066, end: 19.119955 },
                { start: 23.876961, end: 24.123311 },
                { start: 24.311701, end: 24.571837 },
                { start: 27.561224, end: 27.952517 },
                { start: 28.062132, end: 28.43356 },
                { start: 33.169569, end: 33.384943 },
            ]);
        });

        it('should detect silences for -35dB for 0.2s for the mp3', async () => {
            const result = await detectSilences('testing/khutbah.mp3', { silenceThreshold: -35, silenceDuration: 0.2 });
            expect(result).toEqual([{ start: 0, end: 0.702177 }]);
        });
    });

    describe('splitAudio', () => {
        beforeEach(() => {
            testFilePath = 'testing/khutbah.wav';
        });

        it('should split the audio into 4 chunks', async () => {
            const result = await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 10,
                chunkMinThreshold: 0.01,
                silenceDetection: {
                    silenceThreshold: -35,
                    silenceDuration: 0.2,
                },
            });

            expect(result).toHaveLength(5);

            expect(result[0].range.start).toBeCloseTo(0, 6);
            expect(result[0].range.end).toBeCloseTo(7.343764, 6);
            expect(result[0].filename).toEqual(`${outputDir}/khutbah-chunk-000.wav`);
            expect(await getMediaDuration(result[0].filename)).toBeCloseTo(7.343764, 4);

            expect(result[1].range.start).toBeCloseTo(7.343764, 6);
            expect(result[1].range.end).toBeCloseTo(14.872562, 6);
            expect(result[1].filename).toEqual(`${outputDir}/khutbah-chunk-001.wav`);
            expect(await getMediaDuration(result[1].filename)).toBeCloseTo(7.528798, 4);

            expect(result[2].range.start).toBeCloseTo(14.872562, 6);
            expect(result[2].range.end).toBeCloseTo(24.311701, 6);
            expect(result[2].filename).toEqual(`${outputDir}/khutbah-chunk-002.wav`);
            expect(await getMediaDuration(result[2].filename)).toBeCloseTo(9.439138, 4);

            expect(result[3].range.start).toBeCloseTo(24.311701, 6);
            expect(result[3].range.end).toBeCloseTo(33.169569, 6);
            expect(result[3].filename).toEqual(`${outputDir}/khutbah-chunk-003.wav`);
            expect(await getMediaDuration(result[3].filename)).toBeCloseTo(8.857868, 4);

            expect(result[4].range.start).toBeCloseTo(33.169569, 6);
            expect(result[4].range.end).toBeCloseTo(33.593469, 6);
            expect(result[4].filename).toEqual(`${outputDir}/khutbah-chunk-004.wav`);
            expect(await getMediaDuration(result[4].filename)).toBeCloseTo(0.4239, 4);
        });

        it('should filter out any chunks that are smaller than the threshold', async () => {
            testFilePath = 'testing/khutbah.mp3';

            const result = await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 10,
                chunkMinThreshold: 1,
                silenceDetection: {
                    silenceThreshold: -35,
                    silenceDuration: 0.2,
                },
            });

            expect(result).toHaveLength(4);
        });

        it('should not chunk anything if the total duration of the media <= chunk size', async () => {
            testFilePath = 'testing/khutbah.mp3';
            const mockRun = vi.spyOn(ffmpeg.prototype, 'run');

            const result = await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 60,
            });

            expect(result).toEqual([{ range: { start: 0, end: 33.5935 }, filename: testFilePath }]);
            expect(mockRun).not.toHaveBeenCalled();
        });

        it('should add padding around chunks less than 4s long', async () => {
            testFilePath = 'testing/khutbah.mp3';
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 10,
                chunkMinThreshold: 1,
                silenceDetection: {
                    silenceThreshold: -35,
                    silenceDuration: 0.2,
                },
            });

            expect(mockAudioFilters).toHaveBeenCalledTimes(1);
            expect(mockAudioFilters).toHaveBeenCalledWith('apad=pad_dur=0.5');
        });

        it('should return an empty array if all the chunks are too short', async () => {
            const result = await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 0.5,
                chunkMinThreshold: 1,
                silenceDetection: {
                    silenceThreshold: -35,
                    silenceDuration: 0.2,
                },
            });

            expect(result).toHaveLength(0);
        });

        it('should create 2 chunks', async () => {
            const mockSetStartTime = vi.spyOn(ffmpeg.prototype, 'setStartTime');
            const mockSetDuration = vi.spyOn(ffmpeg.prototype, 'setDuration');

            const result = await splitAudioFile(testFilePath, outputDir, {
                chunkDuration: 20,
                chunkMinThreshold: 1,
            });

            expect(result).toHaveLength(3);

            expect(mockSetStartTime).toHaveBeenCalledTimes(3);
            expect(mockSetStartTime).toHaveBeenNthCalledWith(1, 0);

            expect(mockSetDuration).toHaveBeenCalledTimes(3);
        });

        it('should create chunks using the original directory', async () => {
            const result = await splitAudioFile(testFilePath, '', {
                chunkDuration: 31,
                chunkMinThreshold: 2,
            });

            expect(result).toHaveLength(2);

            expect(result[0].filename.startsWith('testing/')).toBe(true);
            expect(result[1].filename.startsWith('testing/')).toBe(true);

            fs.rm(result[0].filename, { force: true });
            fs.rm(result[1].filename, { force: true });
        });
    });
});
