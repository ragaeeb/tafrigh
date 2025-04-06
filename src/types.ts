import type {
    PreprocessingCallbacks,
    PreprocessOptions,
    SplitOnSilenceCallbacks,
    SplitOptions,
    TimeRange,
} from 'ffmpeg-simplified';

export interface Callbacks extends PreprocessingCallbacks, SplitOnSilenceCallbacks, SplitOnSilenceCallbacks {
    onTranscriptionFinished?: (transcripts: Segment[]) => Promise<void>;
    onTranscriptionProgress?: (chunkIndex: number) => void;
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
}

export type Segment = Token & {
    tokens?: Token[];
};

export type Token = TimeRange & {
    confidence?: number;
    text: string;
};

export type TranscribeOptions = {
    callbacks?: Callbacks;
    concurrency?: number;
    preprocessOptions?: PreprocessOptions;
    preventCleanup?: boolean;
    retries?: number;
    splitOptions?: SplitOptions;
};

export type WitAiResponse = {
    confidence?: number;
    text?: string;
    tokens?: WitAiToken[];
};

type WitAiToken = TimeRange & {
    confidence?: number;
    token: string;
};
