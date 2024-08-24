import { promises as fs } from 'fs';
import mime from 'mime-types';
import path from 'path';

export const mapInputsToFiles = async (inputs: string[]): Promise<string[]> => {
    const filePromises = inputs.map(async (input) => {
        const stat = await fs.stat(input);

        if (stat.isDirectory()) {
            const dirents = await fs.readdir(input, { withFileTypes: true });
            return dirents.filter((dirent) => dirent.isFile()).map((dirent) => path.join(input, dirent.name));
        } else {
            return [input];
        }
    });

    const filesArray = await Promise.all(filePromises);
    return filesArray.flat();
};

export const filterMediaFiles = (paths: string[]): string[] => {
    const filteredMediaFiles = paths.filter((filePath) => {
        const mimeType = mime.lookup(filePath);

        if (mimeType) {
            const [type] = mimeType.split('/');
            return type === 'audio' || type === 'video';
        }

        return false;
    });

    return filteredMediaFiles;
};

export const getMediasToConvert = (mediaFiles: string[]): { waveFiles: string[]; conversionNeeded: string[] } => {
    const waveFiles = mediaFiles.filter((mediaFile) => mediaFile.toLowerCase().endsWith('.wav'));
    const conversionNeeded = mediaFiles.filter((mediaFile) => {
        const name = mediaFile.toLowerCase();
        return name.endsWith('.mp4') || name.endsWith('.mp3') || name.endsWith('.m4a');
    });

    return { waveFiles, conversionNeeded };
};
