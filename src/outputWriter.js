import fs from 'fs/promises';

import logger from './logger.js';

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
