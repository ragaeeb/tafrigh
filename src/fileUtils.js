import mime from 'mime-types';

export const filterMediaFiles = (paths) => {
    const filteredMediaFiles = [];
    for (const filePath of paths) {
        const mimeType = mime.lookup(filePath);
        if (!mimeType) continue;

        const type = mimeType.split('/')[0];
        if (type === 'audio' || type === 'video') {
            filteredMediaFiles.push(filePath);
        }
    }
    return filteredMediaFiles;
};
