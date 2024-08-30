import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

import logger from './logger.js';
import {
    AudioChunk,
    ConversionOptions,
    NoiseReductionOptions,
    SilenceDetectionOptions,
    SilenceDetectionResult,
    SplitOptions,
} from './types.js';

const buildConversionFilters = (noiseReductionOptions: NoiseReductionOptions): string[] => {
    const {
        highpass = 300,
        afftdnStart = 0.0,
        afftdnStop = 1.5,
        afftdn_nf = -20,
        dialogueEnhance = true,
        lowpass = 3000,
    } = noiseReductionOptions;

    const filters = [
        highpass !== null && `highpass=f=${highpass}`,
        afftdnStart !== null &&
            afftdnStop !== null && [`asendcmd=${afftdnStart} afftdn sn start`, `asendcmd=${afftdnStop} afftdn sn stop`],
        afftdn_nf !== null && `afftdn=nf=${afftdn_nf}`,
        dialogueEnhance && 'dialoguenhance',
        lowpass && `lowpass=f=${lowpass}`,
    ]
        .flat()
        .filter(Boolean) as string[]; // Flatten and filter out undefined values

    return filters;
};

export const convertToWav = async (input: string, outputDir: string, options?: ConversionOptions): Promise<string> => {
    const filePath = `${outputDir}/output.wav`;
    await fs.mkdir(outputDir, { recursive: true });

    return new Promise<string>((resolve, reject) => {
        let command = ffmpeg(input).toFormat('wav');

        if (options?.noiseReduction !== null) {
            const filters = buildConversionFilters(options?.noiseReduction || {});
            command = command.audioFilters(filters);
        }

        command
            .on('error', (err) => {
                logger.error(`Error during file conversion: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Converted file to WAV: ${filePath}`);
                resolve(filePath);
            })
            .save(filePath);
    });
};

const getMediaDuration = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            resolve(metadata.format.duration || 0); // Return duration in seconds
        });
    });
};

const collectChunkMetadata = async (outputDir: string): Promise<AudioChunk[]> => {
    let currentStartTime = 0; // Initialize the start time tracker
    const chunkFiles = await fs.readdir(outputDir);
    const chunkFilePaths = chunkFiles.map((filename) => path.join(outputDir, filename));

    const durations = await Promise.all(chunkFilePaths.map(getMediaDuration));

    const chunksWithMetadata: AudioChunk[] = chunkFilePaths.map((chunkFilePath, index) => {
        const duration = durations[index];
        const chunkMetadata = {
            filename: chunkFilePath,
            start: currentStartTime,
            end: currentStartTime + duration,
        };
        currentStartTime += duration;
        return chunkMetadata;
    });

    return chunksWithMetadata;
};

const mapOutputToSilenceResults = (silenceLines: string[]): SilenceDetectionResult[] => {
    const silences: SilenceDetectionResult[] = [];
    let currentSilenceStart: number | null = null;

    silenceLines.forEach((line) => {
        if (line.includes('silence_start')) {
            currentSilenceStart = parseFloat(line.match(/silence_start: (\d+\.\d+)/)?.[1] || '0');
        } else if (line.includes('silence_end') && currentSilenceStart !== null) {
            const silenceEnd = parseFloat(line.match(/silence_end: (\d+\.\d+)/)?.[1] || '0');
            silences.push({ start: currentSilenceStart, end: silenceEnd });
            currentSilenceStart = null; // Reset for the next detection
        }
    });

    return silences;
};

export const detectSilences = (
    filePath: string,
    { silenceDuration, silenceThreshold }: SilenceDetectionOptions,
): Promise<SilenceDetectionResult[]> => {
    return new Promise<SilenceDetectionResult[]>((resolve, reject) => {
        const silenceLines: string[] = [];

        ffmpeg(filePath)
            .outputOptions([`-af silencedetect=n=${silenceThreshold}dB:d=${silenceDuration}`, '-f null'])
            .output('NUL') // Use '/dev/null' on Unix or 'NUL' on Windows
            .on('stderr', (stderrLine) => {
                silenceLines.push(stderrLine);
            })
            .on('end', () => {
                const silences = mapOutputToSilenceResults(silenceLines);
                resolve(silences);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
};

const mapChunksToTimeRanges = (silences: SilenceDetectionResult[], chunksWithMetadata: AudioChunk[]): AudioChunk[] => {
    // Adjust start/end times based on detected silences
    let adjustedChunks: AudioChunk[] = [];
    let currentSilenceIndex = 0;

    for (const chunk of chunksWithMetadata) {
        while (currentSilenceIndex < silences.length && silences[currentSilenceIndex].end <= chunk.start) {
            currentSilenceIndex++;
        }

        const adjustedStart =
            currentSilenceIndex < silences.length
                ? Math.max(chunk.start, silences[currentSilenceIndex].end)
                : chunk.start;

        const adjustedEnd =
            currentSilenceIndex < silences.length
                ? Math.min(chunk.end, silences[currentSilenceIndex].start)
                : chunk.end;

        adjustedChunks.push({
            filename: chunk.filename,
            start: adjustedStart,
            end: adjustedEnd,
        });
    }

    return adjustedChunks;
};

export const splitAudioFile = async (
    filePath: string,
    outputDir: string,
    options?: SplitOptions,
): Promise<AudioChunk[]> => {
    await fs.mkdir(outputDir, { recursive: true });

    const {
        chunkDuration = 10, // Default chunk duration: 10 seconds
        fileNameFormat = 'chunk-%03d.wav', // Default filename format
        silenceDetection,
    } = options || {}; // Use an empty object if options is undefined

    const {
        silenceThreshold = -25, // Default silence threshold
        silenceDuration = 0.5, // Default silence duration: 0.5 seconds
    } = silenceDetection || {};

    const silences = await detectSilences(filePath, { silenceThreshold, silenceDuration });

    // Perform the splitting using FFmpeg based on detected silences
    return new Promise<AudioChunk[]>((resolve, reject) => {
        const outputPath = path.join(outputDir, fileNameFormat);

        ffmpeg(filePath)
            .outputOptions([
                `-f segment`,
                `-segment_time ${chunkDuration}`,
                `-af silenceremove=stop_periods=-1:stop_duration=${silenceDuration}:stop_threshold=${silenceThreshold}dB`,
            ])
            .output(outputPath)
            .on('error', (err) => {
                logger.error(`Error during audio splitting: ${err.message}`);
                reject(err);
            })
            .on('end', async () => {
                logger.info('Audio successfully split into chunks.');

                const chunksWithMetadata: AudioChunk[] = await collectChunkMetadata(outputDir);
                const adjustedChunks = mapChunksToTimeRanges(silences, chunksWithMetadata);

                resolve(adjustedChunks);
            })
            .run();
    });
};
