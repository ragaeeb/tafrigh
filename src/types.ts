import {
    PreprocessingCallbacks,
    PreprocessOptions,
    SplitOnSilenceCallbacks,
    SplitOptions,
    TimeRange,
} from 'ffmpeg-simplified';

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

export interface Callbacks extends SplitOnSilenceCallbacks, SplitOnSilenceCallbacks, PreprocessingCallbacks {
    onTranscriptionFinished?: (transcripts: Transcript[]) => Promise<void>;
    onTranscriptionProgress?: (chunkIndex: number) => void;
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
}

export enum OutputFormat {
    Json = 'json',
    PlainText = 'txt',
}

export interface TranscriptOutputOptions {
    includeTokens?: boolean;
    outputFile: string;
}

export interface GetTranscriptionOptions {
    callbacks?: Callbacks;
    concurrency?: number;
    preprocessOptions?: PreprocessOptions;
    splitOptions?: SplitOptions;
}

export interface TranscribeFilesOptions extends GetTranscriptionOptions {
    outputOptions?: TranscriptOutputOptions;
    preventCleanup?: boolean;
}

export interface TafrighOptions {
    apiKeys: string[];
}
