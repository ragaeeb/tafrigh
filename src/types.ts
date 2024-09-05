export interface NoiseReductionOptions {
    highpass?: number | null;
    afftdnStart?: number | null;
    afftdnStop?: number | null;
    afftdn_nf?: number | null;
    dialogueEnhance?: boolean;
    lowpass?: number | null;
}

export interface PreprocessOptions {
    noiseReduction?: NoiseReductionOptions | null;
}

export interface SilenceDetectionOptions {
    silenceThreshold: number; // -50 for '-50dB'
    silenceDuration: number; // in seconds (ie: 0.5 for 0.5s)
}

export interface SplitOptions {
    chunkDuration?: number; // defaults to 60
    chunkMinThreshold?: number;
    silenceDetection?: SilenceDetectionOptions;
}

export interface TimeRange {
    start: number;
    end: number;
}

export interface AudioChunk {
    filename: string;
    range: TimeRange;
}

export interface Transcript {
    range: TimeRange;
    text: string;
}

export enum OutputFormat {
    Json = 'json',
}

export interface TranscriptOutputOptions {
    outputFile: string;
}

export interface TranscribeFilesOptions {
    concurrency?: number;
    outputOptions?: TranscriptOutputOptions;
    preventCleanup?: boolean;
    preprocessOptions?: PreprocessOptions;
    splitOptions?: SplitOptions;
}

export interface TafrighOptions {
    apiKeys: string[];
}
