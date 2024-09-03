import { TranscribeFilesOptions } from '../types.js';
import { MAX_CHUNK_DURATION, MIN_CHUNK_DURATION } from './constants.js';

export const validateTranscribeFileOptions = (options: TranscribeFilesOptions) => {
    if (options.splitOptions?.chunkDuration) {
        const { chunkDuration } = options.splitOptions;

        if (chunkDuration < MIN_CHUNK_DURATION) {
            throw new Error(`chunkDuration=${chunkDuration} cannot be less than ${MIN_CHUNK_DURATION}s`);
        }

        if (chunkDuration > MAX_CHUNK_DURATION) {
            throw new Error(`chunkDuration=${chunkDuration} cannot be greater than ${MAX_CHUNK_DURATION}s`);
        }
    }
};