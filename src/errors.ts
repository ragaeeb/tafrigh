import type { AudioChunk } from 'ffmpeg-simplified';

import type { Segment } from './types.js';

export type FailedTranscription = {
    chunk: AudioChunk;
    error: unknown;
    index: number;
};

type TranscriptionErrorOptions = {
    chunkFiles?: AudioChunk[];
    failures: FailedTranscription[];
    outputDir?: string;
    transcripts: Segment[];
};

export class TranscriptionError extends Error {
    public readonly chunkFiles: AudioChunk[];

    public readonly failures: FailedTranscription[];

    public readonly outputDir?: string;

    public readonly transcripts: Segment[];

    constructor(message: string, { chunkFiles = [], failures, outputDir, transcripts }: TranscriptionErrorOptions) {
        super(message);
        this.name = 'TranscriptionError';
        this.chunkFiles = chunkFiles;
        this.failures = failures;
        this.outputDir = outputDir;
        this.transcripts = transcripts;
    }

    get failedChunks(): AudioChunk[] {
        return this.failures.map((failure) => failure.chunk);
    }

    get hasFailures(): boolean {
        return this.failures.length > 0;
    }
}
