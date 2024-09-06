import { OutputFormat } from '../types.js';

export const MAX_CHUNK_DURATION = 60 * 5; // wit.ai supports up to 5 mins

export const MIN_CHUNK_DURATION = 4; // minimum 4s duration

export const MIN_CONCURRENCY = 1;

export const DEFAULT_OUTPUT_EXTENSION = OutputFormat.Json;

export const DEFAULT_SHORT_CLIP_PADDING = 0.5;

export const SPLIT_OPTIONS_DEFAULTS = {
    chunkDuration: 60,
    chunkMinThreshold: 0.9,
    silenceDetection: { silenceThreshold: -25, silenceDuration: 0.1 },
};

export const NOISE_REDUCTION_OPTIONS_DEFAULTS = {
    afftdnStart: 0,
    afftdnStop: 1.5,
    afftdn_nf: -20,
    dialogueEnhance: true,
    highpass: 300,
    lowpass: 3000,
};
