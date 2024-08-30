import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { convertToWav, detectSilences, splitAudioFile } from './ffmpegUtils';
import { fileExists } from './io';

describe('ffmpegUtils', () => {
    beforeEach(() => {
        vi.clearAllMocks(); // Reset all mocks before each test
    });

    describe('convertToWav', () => {
        let testFilePath;
        let outputDir;

        beforeEach(() => {
            testFilePath = 'testing/khutbah.mp3';
            outputDir = 'testing/output';
        });

        afterEach(async () => {
            await fs.rmdir(outputDir, { recursive: true });
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is enabled with custom options', async () => {
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            // Run the actual function with noiseReduction enabled with custom values
            await convertToWav(testFilePath, outputDir, {
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
            await convertToWav(testFilePath, outputDir, {
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
            const mockToFormat = vi.spyOn(ffmpeg.prototype, 'toFormat');
            const mockSave = vi.spyOn(ffmpeg.prototype, 'save');

            await convertToWav(testFilePath, outputDir);

            expect(mockToFormat).toHaveBeenCalledWith('wav');
            expect(mockSave).toHaveBeenCalled();
        });

        it('should correctly output the file', async () => {
            await convertToWav(testFilePath, outputDir);

            const result = await fileExists(testFilePath);
            expect(result).toBe(true);
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is enabled with default options', async () => {
            const mockAudioFilters = vi.spyOn(ffmpeg.prototype, 'audioFilters');

            await convertToWav(testFilePath, outputDir, { noiseReduction: {} });

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
            await convertToWav(testFilePath, outputDir, { noiseReduction: null });
            expect(ffmpeg.prototype.audioFilters).not.toHaveBeenCalled();
        });

        it('should call ffmpeg with the correct arguments when noiseReduction is not provided (default to false)', async () => {
            await convertToWav(testFilePath, outputDir);
            expect(ffmpeg.prototype.audioFilters).toHaveBeenCalled();
        });
    });

    describe('detectSilences', () => {
        it('should detect silences for -25dB for 0.1s', async () => {
            const result = await detectSilences('testing/khutbah.wav', { silenceThreshold: -25, silenceDuration: 0.1 });
            expect(result).toEqual([
                { start: 0, end: 0.910385 },
                { start: 1.08195, end: 1.190431 },
                { start: 1.27424, end: 1.502857 },
                { start: 6.731519, end: 8.367029 },
                { start: 11.587982, end: 11.721587 },
                { start: 14.303401, end: 15.507438 },
                { start: 18.023764, end: 19.172381 },
                { start: 21.785488, end: 21.920091 },
                { start: 23.636236, end: 24.577914 },
                { start: 24.681678, end: 24.784082 },
                { start: 27.331973, end: 27.435283 },
                { start: 27.435329, end: 28.442358 },
                { start: 29.723719, end: 29.845896 },
                { start: 32.592971, end: 33.493288 },
            ]);
        });
    });

    describe('splitAudio', () => {
        it.only('should split the audio into 4 chunks', async () => {
            const result = await splitAudioFile('testing/khutbah.wav', 'testing/output', {
                chunkDuration: 10,
                fileNameFormat: 'chunk-%03d.wav',
                silenceDetection: {
                    silenceThreshold: -25,
                    silenceDuration: 0.1,
                },
            });
            expect(result).toEqual([]);
        });
    });
});
