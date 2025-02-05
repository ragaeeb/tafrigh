import {
    PreprocessingCallbacks,
    PreprocessOptions,
    SplitOnSilenceCallbacks,
    SplitOptions,
    TimeRange,
} from 'ffmpeg-simplified';

export enum OutputFormat {
    Json = 'json',
    PlainText = 'txt',
}

export interface Callbacks extends PreprocessingCallbacks, SplitOnSilenceCallbacks, SplitOnSilenceCallbacks {
    onTranscriptionFinished?: (transcripts: Transcript[]) => Promise<void>;
    onTranscriptionProgress?: (chunkIndex: number) => void;
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
}

export interface GetTranscriptionOptions {
    callbacks?: Callbacks;
    concurrency?: number;
    lineBreakSecondsThreshold?: number;
    preprocessOptions?: PreprocessOptions;
    retries?: number;
    splitOptions?: SplitOptions;
}

export interface TafrighOptions {
    apiKeys: string[];
}

export interface Token {
    confidence: number;
    end: number;
    start: number;
    token: string;
}

export interface TranscribeFilesOptions extends GetTranscriptionOptions {
    outputOptions: TranscriptOutputOptions;
}

export interface Transcript {
    confidence?: number;
    range: TimeRange;
    text: string;
    tokens?: Token[];
}

export interface TranscriptOutputOptions {
    includeTokens?: boolean;
    outputFile: string;
}

export interface WitAiResponse {
    confidence?: number;
    text?: string;
    tokens?: Token[];
}
