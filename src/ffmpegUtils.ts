import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

import logger from './logger.js';
import { mapSilenceResultsToChunkRanges } from './mediaUtils';
import {
    AudioChunk,
    ConversionOptions,
    NoiseReductionOptions,
    SilenceDetectionOptions,
    SplitOptions,
    TimeRange,
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
        let command = ffmpeg(input).toFormat('wav').audioChannels(1);

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

export const getMediaDuration = async (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);

            resolve(metadata.format.duration || 0); // Return duration in seconds
        });
    });
};

const mapOutputToSilenceResults = (silenceLines: string[]): TimeRange[] => {
    const silences: TimeRange[] = [];
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
): Promise<TimeRange[]> => {
    return new Promise<TimeRange[]>((resolve, reject) => {
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

export const splitAudioFile = async (
    filePath: string,
    outputDir: string,
    options?: SplitOptions,
): Promise<AudioChunk[]> => {
    await fs.mkdir(outputDir, { recursive: true });

    const {
        chunkDuration = 10,
        chunkMinThreshold = 0.9,
        silenceDetection: { silenceThreshold = -35, silenceDuration = 0.2 } = {},
    } = options || {};

    const [totalDuration, silences] = await Promise.all([
        getMediaDuration(filePath),
        detectSilences(filePath, { silenceThreshold, silenceDuration }),
    ]);

    const chunkRanges: TimeRange[] = mapSilenceResultsToChunkRanges(silences, chunkDuration, totalDuration).filter(
        (r) => r.end - r.start > chunkMinThreshold,
    );
    const chunks: AudioChunk[] = chunkRanges.map((range, index) => ({
        range,
        filename: path.join(outputDir, `chunk-${index.toString().padStart(3, '0')}.wav`),
    }));

    if (chunks.length > 0) {
        await Promise.all(
            chunks.map(
                (chunk) =>
                    new Promise<void>((resolve, reject) => {
                        ffmpeg(filePath)
                            .setStartTime(chunk.range.start)
                            .setDuration(chunk.range.end - chunk.range.start)
                            .output(chunk.filename)
                            .on('end', resolve as () => void)
                            .on('error', reject)
                            .run();
                    }),
            ),
        );
    }

    return chunks;
};
