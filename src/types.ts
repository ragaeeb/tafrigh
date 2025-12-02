import type {
    PreprocessingCallbacks,
    PreprocessOptions,
    SplitOnSilenceCallbacks,
    SplitOptions,
    TimeRange,
} from 'ffmpeg-simplified';

/**
 * Callbacks for monitoring and responding to various stages of the transcription process.
 * Extends preprocessing and splitting callbacks from ffmpeg-simplified.
 */
export interface Callbacks extends PreprocessingCallbacks, SplitOnSilenceCallbacks, SplitOnSilenceCallbacks {
    /**
     * Called when all transcription is complete.
     * @param {Segment[]} transcripts - Array of all transcribed segments
     * @returns {Promise<void>}
     */
    onTranscriptionFinished?: (transcripts: Segment[]) => Promise<void>;

    /**
     * Called when each individual chunk is transcribed.
     * @param {number} chunkIndex - Index of the current chunk being processed
     */
    onTranscriptionProgress?: (chunkIndex: number) => void;

    /**
     * Called just before the transcription process begins.
     * @param {number} totalChunks - Total number of chunks to be transcribed
     * @returns {Promise<void>}
     */
    onTranscriptionStarted?: (totalChunks: number) => Promise<void>;
}

/**
 * Logger interface for custom logging implementations.
 * Compatible with the Logger interface from ffmpeg-simplified.
 */
export interface Logger {
    /** Log a debug message */
    debug?: (message: string, ...args: any[]) => void;
    /** Log an error message */
    error?: (message: string, ...args: any[]) => void;
    /** Log an informational message */
    info?: (message: string, ...args: any[]) => void;
    /** Log a trace message */
    trace?: (message: string, ...args: any[]) => void;
    /** Log a warning message */
    warn?: (message: string, ...args: any[]) => void;
}

/**
 * Represents a segment of transcribed audio with timing information.
 * May include detailed token-level information when available.
 */
export type Segment = Token & {
    /**
     * Word-by-word breakdown of the transcription with individual timings
     */
    tokens?: Token[];
};

/**
 * Represents a token (word or phrase) in the transcription with timing information.
 */
export type Token = TimeRange & {
    /**
     * Confidence score for this transcription (between 0 and 1)
     */
    confidence?: number;

    /**
     * The transcribed text
     */
    text: string;
};

/**
 * Configuration options for the transcribe function.
 */
export type TranscribeOptions = {
    /**
     * Callbacks for monitoring progress and responding to events
     */
    callbacks?: Callbacks;

    /**
     * Maximum number of concurrent transcription operations
     * Limited by the number of available API keys
     */
    concurrency?: number;

    /**
     * Options for audio preprocessing (noise reduction, filtering, etc.)
     */
    preprocessOptions?: PreprocessOptions;

    /**
     * If true, temporary processing directories won't be deleted
     * Useful for debugging
     */
    preventCleanup?: boolean;

    /**
     * Number of retry attempts for failed transcription requests
     * Uses exponential backoff
     */
    retries?: number;

    /**
     * Options for splitting audio into chunks
     */
    splitOptions?: SplitOptions;
};

/**
 * Response structure from the Wit.ai API.
 * @internal
 */
export type WitAiResponse = {
    /**
     * Confidence score for the entire transcription (between 0 and 1)
     */
    confidence?: number;

    /**
     * The transcribed text
     */
    text?: string;

    /**
     * Array of token objects with detailed timing information
     */
    tokens?: WitAiToken[];
};

/**
 * Token structure as returned by the Wit.ai API.
 * @internal
 */
type WitAiToken = TimeRange & {
    /**
     * Confidence score for this token (between 0 and 1)
     */
    confidence?: number;

    /**
     * The transcribed token text
     */
    token: string;
};
