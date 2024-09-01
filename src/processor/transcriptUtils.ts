import fs from 'fs/promises';

import logger from '../logger.js';

export const processTranscripts = (rawTranscripts, minWordsPerSegment) => {
    const transcripts = [...rawTranscripts];
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

export const writeOutput = async (transcripts, format, fileName, outputDir) => {
    try {
        const outputFilePath = `${outputDir}/${fileName}.${format}`;

        await fs.mkdir(outputDir, { recursive: true });

        const outputData = format === 'json' ? JSON.stringify(transcripts, null, 2) : transcripts.join('\n');
        await fs.writeFile(outputFilePath, outputData, 'utf8');

        logger.info(`Transcriptions written to: ${outputFilePath}`);
    } catch (error) {
        logger.error(`Failed to write output: ${error.message}`);
    }
};
