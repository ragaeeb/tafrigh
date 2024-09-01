export interface NoiseReductionOptions {
    highpass?: number | null;
    afftdnStart?: number | null;
    afftdnStop?: number | null;
    afftdn_nf?: number | null;
    dialogueEnhance?: boolean;
    lowpass?: number | null;
}

export interface FormattingOptions {
    noiseReduction?: NoiseReductionOptions | null;
    outputFormat?: string;
}

export interface SilenceDetectionOptions {
    silenceThreshold: number; // -50 for '-50dB'
    silenceDuration: number; // in seconds (ie: 0.5 for 0.5s)
}

export interface SplitOptions {
    chunkDuration?: number;
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

export interface Transcription {
    range: TimeRange;
    text: string;
}
