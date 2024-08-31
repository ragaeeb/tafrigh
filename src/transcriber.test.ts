import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getNextApiKey } from './apiKeys';
import { transcribeAudioChunks } from './transcriber';
import { AudioChunk } from './types';
import { speechToText } from './wit.ai';

vi.mock('./wit.ai');
vi.mock('./apiKeys');
vi.mock('./logger');

describe('transcribeAudioChunks', () => {
    let mockApiKey;
    let mockChunkFiles: AudioChunk[];

    beforeEach(() => {
        mockApiKey = 'mock-api-key';
        mockChunkFiles = [
            { filename: 'chunk1.wav', range: { start: 0, end: 10 } },
            { filename: 'chunk2.wav', range: { start: 10, end: 20 } },
        ];

        vi.clearAllMocks();
        (getNextApiKey as any).mockReturnValue(mockApiKey);
    });

    it('should transcribe all audio chunks successfully', async () => {
        (speechToText as any)
            .mockResolvedValueOnce({ text: 'Transcription for chunk1' })
            .mockResolvedValueOnce({ text: 'Transcription for chunk2' });

        const result = await transcribeAudioChunks(mockChunkFiles);

        expect(result).toEqual([
            { range: mockChunkFiles[0].range, text: 'Transcription for chunk1' },
            { range: mockChunkFiles[1].range, text: 'Transcription for chunk2' },
        ]);
        expect(speechToText).toHaveBeenCalledWith('chunk1.wav', { apiKey: mockApiKey });
        expect(speechToText).toHaveBeenCalledWith('chunk2.wav', { apiKey: mockApiKey });
    });

    it('should skip non-final transcriptions', async () => {
        (speechToText as any)
            .mockResolvedValueOnce({ text: 'Transcription for chunk1' })
            .mockResolvedValueOnce({ text: undefined });

        const result = await transcribeAudioChunks(mockChunkFiles);

        expect(result).toEqual([{ range: mockChunkFiles[0].range, text: 'Transcription for chunk1' }]);
    });

    it('should log an error and continue if a chunk fails to transcribe', async () => {
        (speechToText as any)
            .mockResolvedValueOnce({ text: 'Transcription for chunk1' })
            .mockRejectedValueOnce(new Error('Network error'));

        const result = await transcribeAudioChunks(mockChunkFiles);

        expect(result).toEqual([{ range: mockChunkFiles[0].range, text: 'Transcription for chunk1' }]);
    });

    it('should return an empty array if all transcriptions fail', async () => {
        (speechToText as any).mockRejectedValue(new Error('Network error'));

        const result = await transcribeAudioChunks(mockChunkFiles);

        expect(result).toEqual([]);
    });
});
