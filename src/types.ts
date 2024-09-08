export interface NoiseReductionOptions {
    afftdnStart?: number | null;
    afftdnStop?: number | null;
    afftdn_nf?: number | null;
    dialogueEnhance?: boolean;
    highpass?: number | null;
    lowpass?: number | null;
}

export interface PreprocessOptions {
    noiseReduction?: NoiseReductionOptions | null;
}

export interface SilenceDetectionOptions {
    // -50 for '-50dB'
    silenceDuration: number;
    silenceThreshold: number; // in seconds (ie: 0.5 for 0.5s)
}

export interface SplitOptions {
    chunkDuration?: number; // defaults to 60
    chunkMinThreshold?: number;
    silenceDetection?: SilenceDetectionOptions;
}

export interface TimeRange {
    end: number;
    start: number;
}

export interface AudioChunk {
    filename: string;
    range: TimeRange;
}

export interface Token {
    confidence: number;
    end: number;
    start: number;
    token: string;
}

export interface WitAiResponse {
    confidence?: number;
    text?: string;
    tokens?: Token[];
}

export interface Transcript {
    confidence?: number;
    range: TimeRange;
    text: string;
    tokens?: Token[];
}

export interface Callbacks {
    onPreprocessingFinished?: (filePath: string) => Promise<void>;
    onPreprocessingProgress?: (percent: number) => void;
    onPreprocessingStarted?: (filePath: string) => Promise<void>;
    onSplittingFinished?: () => Promise<void>;
    onSplittingProgress?: (chunkFilePath: string, chunkIndex: number) => void;
    onSplittingStarted?: (totalChunks: number) => Promise<void>;
    onTranscriptionFinished?: (transcripts: Transcript[]) => Promise<void>;
    onTranscriptionProgress?: (chunkIndex: number) => void;
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
}

export enum OutputFormat {
    Json = 'json',
}

export interface TranscriptOutputOptions {
    outputFile: string;
}

export interface TranscribeFilesOptions {
    callbacks?: Callbacks;
    concurrency?: number;
    outputOptions?: TranscriptOutputOptions;
    preprocessOptions?: PreprocessOptions;
    preventCleanup?: boolean;
    splitOptions?: SplitOptions;
}

export interface TafrighOptions {
    apiKeys: string[];
}
