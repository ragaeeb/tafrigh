import { Command } from 'commander';
import process from 'process';

export function initializeCommand() {
    const program = new Command();

    program
        .option('-f, --files <files...>', 'Input files or URLs')
        .option('-c, --chunk-duration <seconds>', 'Duration of each chunk in seconds', 60)
        .option('-o, --output-format <format>', 'Output format (json, txt, srt)', 'json')
        .option('-n, --output-filename <name>', 'Base name for the output files', 'transcripts')
        .option('-d, --output-dir <directory>', 'Directory where the output files will be saved', 'output')
        .option('--skip-if-output-exist', 'Skip processing if the output file already exists', false)
        .option('--verbose', 'Enable verbose logging', false)
        .option('--min-words-per-segment <number>', 'Minimum number of words per segment', 0)
        .option('--save-files-before-compact', 'Save intermediate files before compacting the output', false)
        .option('--save-yt-dlp-responses', 'Save yt-dlp responses when processing YouTube videos', false);

    program.parse(process.argv);
    return program.opts();
}
