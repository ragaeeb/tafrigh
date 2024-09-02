import { describe, expect, it } from 'vitest';

import { MAX_CHUNK_DURATION, MIN_CHUNK_DURATION } from './constants.js';
import { validateTranscribeFileOptions } from './validation.js';

describe('validation', () => {
    describe('validateTranscribeFileOptions', () => {
        it('should pass validation if chunkDuration is within range', () => {
            const options = {
                splitOptions: { chunkDuration: MIN_CHUNK_DURATION + 1 },
            };

            expect(() => validateTranscribeFileOptions(options)).not.toThrow();
        });

        it('should throw an error if chunkDuration is less than MIN_CHUNK_DURATION', () => {
            const options = {
                splitOptions: { chunkDuration: MIN_CHUNK_DURATION - 1 },
            };

            expect(() => validateTranscribeFileOptions(options)).toThrowError(
                `chunkDuration=${MIN_CHUNK_DURATION - 1} cannot be less than ${MIN_CHUNK_DURATION}s`,
            );
        });

        it('should throw an error if chunkDuration is greater than MAX_CHUNK_DURATION', () => {
            const options = {
                splitOptions: { chunkDuration: MAX_CHUNK_DURATION + 1 },
            };

            expect(() => validateTranscribeFileOptions(options)).toThrowError(
                `chunkDuration=${MAX_CHUNK_DURATION + 1} cannot be greater than ${MAX_CHUNK_DURATION}s`,
            );
        });

        it('should pass validation if splitOptions is undefined', () => {
            const options = {};

            expect(() => validateTranscribeFileOptions(options)).not.toThrow();
        });

        it('should pass validation if chunkDuration is not provided', () => {
            const options = {
                splitOptions: {},
            };

            expect(() => validateTranscribeFileOptions(options)).not.toThrow();
        });
    });
});
