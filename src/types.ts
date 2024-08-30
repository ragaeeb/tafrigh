export interface NoiseReductionOptions {
    highpass?: number | null;
    afftdnStart?: number | null;
    afftdnStop?: number | null;
    afftdn_nf?: number | null;
    dialogueEnhance?: boolean;
    lowpass?: number | null;
}

export interface ConversionOptions {
    noiseReduction?: NoiseReductionOptions | null;
}

export interface SilenceDetectionOptions {
    silenceThreshold: number; // -50 for '-50dB'
    silenceDuration: number; // in seconds (ie: 0.5 for 0.5s)
}

export interface SplitOptions {
    chunkDuration?: number;
    fileNameFormat?: string; // E.g., '%03d'
    silenceDetection: SilenceDetectionOptions;
}

export interface AudioChunk {
    filename: string;
    start: number;
    end: number;
}

export interface SilenceDetectionResult {
    start: number;
    end: number;
}
