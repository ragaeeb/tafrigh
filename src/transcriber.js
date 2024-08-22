import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import PQueue from 'p-queue';
import process from 'process';

import logger from './logger.js';

// Retrieve multiple Wit.ai keys from environment variables
const WIT_AI_API_KEYS = process.env.WIT_AI_API_KEYS ? process.env.WIT_AI_API_KEYS.split(',') : [];

if (WIT_AI_API_KEYS.length === 0) {
    logger.error('At least one Wit.ai API key is required. Please set them in your environment variables.');
    process.exit(1);
}

let currentKeyIndex = 0;

const getNextApiKey = () => {
    const key = WIT_AI_API_KEYS[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % WIT_AI_API_KEYS.length;
    return key;
};

export const transcribeAudioChunks = async (chunkFiles, minWordsPerSegment) => {
    const transcripts = [];
    const queue = new PQueue({ concurrency: 3 });

    for (const [index, filePath] of chunkFiles.entries()) {
        queue.add(async () => {
            try {
                const formData = new FormData();
                formData.append('file', fs.createReadStream(filePath));
                formData.append('Content-Type', 'audio/wav');

                const response = await axios.post('https://api.wit.ai/speech', formData, {
                    headers: {
                        ...formData.getHeaders(),
                        Authorization: `Bearer ${getNextApiKey()}`,
                    },
                });

                const transcript = response.data.text;
                const wordCount = transcript.split(' ').length;

                transcripts.push({
                    index,
                    file: filePath,
                    transcript,
                    wordCount,
                });

                logger.info(`Transcription successful for chunk: ${filePath}`);
            } catch (error) {
                logger.error(`Failed to transcribe chunk ${filePath}: ${error.message}`);
            }
        });
    }

    await queue.onIdle();

    // Sort transcripts by original index to maintain order
    transcripts.sort((a, b) => a.index - b.index);

    // Merge segments based on minWordsPerSegment
    if (minWordsPerSegment > 0) {
        const mergedTranscripts = [];
        let currentSegment = transcripts[0];

        for (let i = 1; i < transcripts.length; i++) {
            if (currentSegment.wordCount < minWordsPerSegment) {
                currentSegment.transcript += ` ${transcripts[i].transcript}`;
                currentSegment.wordCount += transcripts[i].wordCount;
            } else {
                mergedTranscripts.push(currentSegment);
                currentSegment = transcripts[i];
            }
        }
        mergedTranscripts.push(currentSegment); // Add the last segment

        return mergedTranscripts.map(({ transcript }) => transcript);
    }

    return transcripts.map(({ transcript }) => transcript);
};
