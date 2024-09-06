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

export interface Token {
    confidence: number;
    end: number;
    start: number;
    token: string;
}

export interface WitAiResponse {
    text?: string;
    confidence?: number;
    tokens?: Token[];
}

export interface Transcript {
    confidence?: number;
    range: TimeRange;
    text: string;
    tokens?: Token[];
}

export interface Callbacks {
    onPreprocessingStarted?: (filePath: string) => Promise<void>;
    onPreprocessingFinished?: (filePath: string) => Promise<void>;
    onPreprocessingProgress?: (percent: number) => void;
    onSplittingStarted?: (totalChunks: number) => Promise<void>;
    onSplittingProgress?: (chunkFilePath: string, chunkIndex: number) => void;
    onSplittingFinished?: () => Promise<void>;
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
    onTranscriptionProgress?: (chunkIndex: number) => void;
    onTranscriptionFinished?: (transcripts: Transcript[]) => Promise<void>;
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
    preventCleanup?: boolean;
    preprocessOptions?: PreprocessOptions;
    splitOptions?: SplitOptions;
}

export interface TafrighOptions {
    apiKeys: string[];
}
