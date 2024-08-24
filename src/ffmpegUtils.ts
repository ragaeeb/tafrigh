import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';

import logger from './logger.js';

interface ConversionOptions {
    noiseReduction: boolean;
}

interface SplitOptions {
    chunkDuration?: number;
    fileNameFormat?: string; // E.g., '%03d'
    silenceThreshold?: string; // E.g., '-50dB'
    silenceDuration?: number; // E.g., 1
}

export interface AudioChunk {
    filename: string;
    start: number;
    end: number;
}

export const convertToWav = async (input: string, outputDir: string, options?: ConversionOptions): Promise<string> => {
    const filePath = `${outputDir}/output.wav`;
    return new Promise<string>((resolve, reject) => {
        let command = ffmpeg(input)
            .toFormat('wav')
            .on('error', (err) => {
                logger.error(`Error during file conversion: ${err.message}`);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Converted file to WAV: ${filePath}`);
                resolve(filePath);
            });

        if (options?.noiseReduction) {
            command = command.audioFilters(['afftdn', 'anlmdn']);
        }

        command.save(filePath);
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

export const splitAudioFile = async (
    filePath: string,
    outputDir: string,
    options?: SplitOptions,
): Promise<AudioChunk[]> => {
    return new Promise<AudioChunk[]>((resolve, reject) => {
        let currentStartTime = 0; // Initialize the start time tracker

        const {
            chunkDuration = 10, // Default chunk duration: 10 seconds
            fileNameFormat = 'chunk-%03d.wav', // Default filename format
            silenceThreshold = '-50dB', // Default silence threshold
            silenceDuration = 0.5, // Default silence duration: 1 second
        } = options || {}; // Use an empty object if options is undefined

        const outputPath = path.join(outputDir, fileNameFormat);
        console.log('LKJF', outputPath);

        ffmpeg(filePath)
            .outputOptions([
                `-f segment`,
                `-segment_time ${chunkDuration}`,
                `-af silenceremove=stop_periods=-1:stop_duration=${silenceDuration}:stop_threshold=${silenceThreshold}`,
            ])
            .output(outputPath) // Specify the output path here
            .on('error', (err) => {
                logger.error(`Error during audio splitting: ${err.message}`);
                reject(err);
            })
            .on('end', async () => {
                logger.info('Audio successfully split into chunks.');

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

                resolve(chunksWithMetadata);
            })
            .run();
    });
};
