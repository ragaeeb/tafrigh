import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';

import { transcribe } from './index.js';
import { transcribeAudioChunks } from './transcriber.js';
import { formatMedia, splitAudioFile } from './utils/ffmpegUtils.js';
import { createTempDir, fileExists } from './utils/io.js';

vi.mock('./transcriber.js', () => ({
    transcribeAudioChunks: vi.fn(),
}));
vi.mock('./utils/ffmpegUtils.js', () => ({
    formatMedia: vi.fn(),
    splitAudioFile: vi.fn(),
}));

vi.mock('./utils/logger.js');

describe('transcribe', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('happy path', () => {
        let chunkFiles;
        let testFile;

        beforeEach(() => {
            chunkFiles = [{ filename: 'chunk-001.wav', range: { start: 0, end: 10 } }];
            testFile = 'audio-file.mp3';

            (formatMedia as Mock).mockResolvedValue('processed.mp3');
            (splitAudioFile as Mock).mockResolvedValue(chunkFiles);
            (transcribeAudioChunks as Mock).mockResolvedValue([{ range: { start: 0, end: 10 }, text: 'Hello World' }]);
        });

        it('should process the transcription successfully and not delete the temporary folder where the output was generated', async () => {
            const result = await transcribe(testFile);

            expect(formatMedia).toHaveBeenCalledWith(testFile, expect.any(String), undefined);
            expect(formatMedia).toHaveBeenCalledOnce();

            expect(splitAudioFile).toHaveBeenCalledWith('processed.mp3', '', undefined);
            expect(splitAudioFile).toHaveBeenCalledOnce();

            expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, undefined);
            expect(transcribeAudioChunks).toHaveBeenCalledOnce();

            const data = JSON.parse(await fs.readFile(result, 'utf8'));
            expect(data).toEqual([{ start: 0, end: 10, text: 'Hello World' }]);
        });

        it('should process the transcription successfully and not delete the temporary folder if user specifies it should not be cleaned up', async () => {
            const outputFile = path.join(await createTempDir(), 'output.json');
            const result = await transcribe(testFile, {
                preventCleanup: true,
                outputOptions: { outputFile },
                concurrency: 2,
            });

            expect(transcribeAudioChunks).toHaveBeenCalledWith(chunkFiles, 2);

            const isOutputFileWritten = await fileExists(result);
            expect(isOutputFileWritten).toBe(true);
        });

        it('should process the transcription then delete the temporary directory', async () => {
            const outputFile = path.join(await createTempDir(), 'output.json');

            const result = await transcribe(new Readable(), {
                outputOptions: { outputFile },
            });

            const [, tempOutputDir] = (formatMedia as Mock).mock.lastCall as string[];

            const [isOutputFileWritten, isTemporaryDirectoryStillPresent] = await Promise.all([
                fileExists(result),
                fileExists(tempOutputDir),
            ]);
            expect(isOutputFileWritten).toBe(true);
            expect(isTemporaryDirectoryStillPresent).toBe(false);
        });
    });

    describe('failures', () => {
        it('should reject due to invalid options being provided', async () => {
            await expect(transcribe('audio.mp3', { splitOptions: { chunkDuration: -1 } })).rejects.toThrow(
                'chunkDuration=-1 cannot be less than 4s',
            );

            await expect(transcribe('audio.mp3', { splitOptions: { chunkDuration: 1000 } })).rejects.toThrow(
                'chunkDuration=1000 cannot be greater than 300s',
            );
        });

        it('should return an empty string there was no chunks generated', async () => {
            (formatMedia as Mock).mockResolvedValue('processed.mp3');
            (splitAudioFile as Mock).mockResolvedValue([]);

            const result = await transcribe('audio.mp3');

            expect(transcribeAudioChunks).not.toHaveBeenCalled();
            expect(result).toEqual('');
        });
    });
});
