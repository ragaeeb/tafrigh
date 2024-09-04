import deepmerge from 'deepmerge';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

import {
    AudioChunk,
    NoiseReductionOptions,
    PreprocessOptions,
    SilenceDetectionOptions,
    SplitOptions,
    TimeRange,
} from '../types.js';
import {
    DEFAULT_SHORT_CLIP_PADDING,
    MIN_CHUNK_DURATION,
    NOISE_REDUCTION_OPTIONS_DEFAULTS,
    SPLIT_OPTIONS_DEFAULTS,
} from './constants.js';
import logger from './logger.js';
import { mapSilenceResultsToChunkRanges } from './mediaUtils.js';

const buildConversionFilters = ({
    highpass,
    afftdnStart,
    afftdnStop,
    afftdn_nf,
    dialogueEnhance,
    lowpass,
}: NoiseReductionOptions): string[] => {
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

export const formatMedia = async (input: string, outputDir: string, options?: PreprocessOptions): Promise<string> => {
    logger.debug(`formatMedia: ${input}, outputDir: ${outputDir}`);
    const parsedInput = path.parse(input);
    logger.trace(`parsedInput: ${JSON.stringify(parsedInput)}`);
    const filePath = path.format({
        name: `${parsedInput.name}_preprocessed`,
        dir: outputDir,
        ext: parsedInput.ext,
    });
    logger.debug(`filePath: ${filePath}`);

    await fs.mkdir(outputDir, { recursive: true });

    return new Promise<string>((resolve, reject) => {
        let command = ffmpeg(input).audioChannels(1);

        if (options?.noiseReduction !== null) {
            const filters = buildConversionFilters({ ...NOISE_REDUCTION_OPTIONS_DEFAULTS, ...options?.noiseReduction });
            logger.info(filters, `Using filters`);
            command = command.audioFilters(filters);
        }

        logger.info(`saveTo: ${filePath}`);

        command
            .on('error', (err) => {
                logger.error(`Error during file conversion: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Formatted file: ${filePath}`);
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

    const parsedPath = path.parse(filePath);

    logger.debug(`Split file ${filePath}`);

    const {
        chunkDuration,
        chunkMinThreshold,
        silenceDetection: { silenceThreshold, silenceDuration },
    } = deepmerge(SPLIT_OPTIONS_DEFAULTS, options || {});

    logger.info(
        `Using chunkDuration=${chunkDuration}, chunkMinThreshold=${chunkMinThreshold}, silenceThreshold=${silenceThreshold}, silenceDuration=${silenceDuration}`,
    );

    const totalDuration = await getMediaDuration(filePath);

    if (chunkDuration >= totalDuration) {
        return [{ range: { start: 0, end: totalDuration }, filename: filePath }];
    }

    const silences = await detectSilences(filePath, { silenceThreshold, silenceDuration });

    const chunkRanges: TimeRange[] = mapSilenceResultsToChunkRanges(silences, chunkDuration, totalDuration).filter(
        (r) => r.end - r.start > chunkMinThreshold,
    );

    logger.debug(chunkRanges, 'chunkRanges');

    let chunks: AudioChunk[] = chunkRanges.map((range, index) => ({
        range,
        filename: path.join(
            outputDir,
            `${parsedPath.name}-chunk-${index.toString().padStart(3, '0')}${parsedPath.ext}`,
        ),
    }));

    if (chunks.length > 0) {
        await Promise.all(
            chunks.map(
                (chunk) =>
                    new Promise<void>((resolve, reject) => {
                        const duration = chunk.range.end - chunk.range.start;

                        let command = ffmpeg(filePath)
                            .setStartTime(chunk.range.start)
                            .setDuration(duration)
                            .output(chunk.filename)
                            .on('end', resolve as () => void)
                            .on('error', reject);

                        if (duration < MIN_CHUNK_DURATION) {
                            // add some silence to prevent an error that happens for very short clips.
                            command = command.audioFilters(`apad=pad_dur=${DEFAULT_SHORT_CLIP_PADDING}`);
                        }

                        command.run();
                    }),
            ),
        );
    }

    return chunks;
};
