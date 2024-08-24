import { Dirent, promises as fs, Stats } from 'fs';
import path from 'path';
import { describe, expect, it, vi } from 'vitest';

import { mapInputsToFiles } from './io.ts';

vi.mock('fs', async () => {
    const actualFs = await vi.importActual('fs');
    return {
        ...actualFs,
        promises: {
            stat: vi.fn(),
            readdir: vi.fn(),
        },
    };
});

describe('io', () => {
    describe('mapInputsToFiles', () => {
        it('should return file paths directly if inputs are files', async () => {
            vi.mocked(fs.stat).mockResolvedValue({ isDirectory: () => false } as Stats);

            const files = await mapInputsToFiles(['1.mp3', '2.mp3']);
            expect(files).toEqual(['1.mp3', '2.mp3']);
        });

        it('should return file paths from directories', async () => {
            vi.mocked(fs.stat).mockResolvedValueOnce({ isDirectory: () => true } as Stats);
            vi.mocked(fs.readdir).mockResolvedValue([
                { name: '2.mp3', isFile: () => true } as Dirent,
                { name: '3.mp3', isFile: () => true } as Dirent,
            ]);

            const files = await mapInputsToFiles(['./tmp']);
            expect(files).toEqual([path.join('./tmp', '2.mp3'), 'tmp/3.mp3']);
        });

        it('should handle mixed inputs of files and directories', async () => {
            vi.mocked(fs.stat).mockImplementation(async (input) => {
                if (input === './tmp') {
                    return { isDirectory: () => true } as Stats;
                }
                return { isDirectory: () => false } as Stats;
            });

            vi.mocked(fs.readdir).mockResolvedValue([
                { name: '2.mp3', isFile: () => true } as Dirent,
                { name: '3.mp3', isFile: () => true } as Dirent,
            ]);

            const files = await mapInputsToFiles(['1.mp3', './tmp']);
            expect(files).toEqual(['1.mp3', 'tmp/2.mp3', 'tmp/3.mp3']);
        });
    });
});
