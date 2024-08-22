import inquirer from 'inquirer';

import { initializeCommand } from './commandUtils.js';
import { processFiles } from './mediaUtils.js';

async function main() {
    const options = initializeCommand();

    let files = options.files;

    if (!files || files.length === 0) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'files',
                message: 'Please enter the files or URLs (separated by space):',
                filter: (input) => input.split(' '),
            },
        ]);
        files = answers.files;
    }

    const config = {
        skipIfOutputExist: options.skipIfOutputExist,
        playlistItems: '',
        downloadRetries: 3,
        verbose: options.verbose,
        minWordsPerSegment: options.minWordsPerSegment,
        saveFilesBeforeCompact: options.saveFilesBeforeCompact,
        saveYtDlpResponses: options.saveYtDlpResponses,
    };

    // Apply defaults for missing options
    const chunkDuration = options.chunkDuration || 60;
    const outputFormat = options.outputFormat || 'json';
    const outputFileName = options.outputFilename || 'transcripts';
    const outputDir = options.outputDir || 'output';

    await processFiles(files, chunkDuration, outputFormat, outputFileName, outputDir, config);
}

main();
