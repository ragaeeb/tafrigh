import { promises as fs } from 'fs';
import path from 'path';
import process from 'process';

export const writeOutput = async (transcripts, format) => {
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    if (format === 'json') {
        await fs.writeFile(path.join(outputDir, 'transcripts.json'), JSON.stringify(transcripts, null, 2));
    } else if (format === 'txt') {
        const txtContent = transcripts.map((t) => `${t.file}: ${t.transcript.text}`).join('\n\n');
        await fs.writeFile(path.join(outputDir, 'transcripts.txt'), txtContent);
    } else if (format === 'srt') {
        let srtContent = '';
        transcripts.forEach((t, index) => {
            srtContent += `${index + 1}\n`;
            srtContent += `${t.transcript.start} --> ${t.transcript.end}\n`;
            srtContent += `${t.transcript.text}\n\n`;
        });
        await fs.writeFile(path.join(outputDir, 'transcripts.srt'), srtContent);
    }
};
