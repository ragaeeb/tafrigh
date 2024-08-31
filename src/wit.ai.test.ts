import fs from 'fs';
import fetch from 'node-fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { speechToText } from './wit.ai';

vi.mock('fs');
vi.mock('node-fetch', () => ({
    default: vi.fn(),
}));

describe('wit.ai', () => {
    describe('speechToText', () => {
        const mockApiKey = 'mock-api-key';
        const mockFilePath = 'mock-file-path.wav';
        const mockOptions = { apiKey: mockApiKey };

        beforeEach(() => {
            vi.clearAllMocks(); // Reset all mocks before each test
        });

        it('should call the Wit.ai API with the correct parameters and return the text', async () => {
            const mockStream = 'mock-stream';
            const mockResponse = {
                ok: true,
                json: vi.fn().mockResolvedValue({ text: 'Hello World' }),
            };

            (fs.createReadStream as unknown as any).mockReturnValue(mockStream);
            (fetch as any).mockResolvedValue(mockResponse);

            const result = await speechToText(mockFilePath, mockOptions);

            expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
            expect(fetch).toHaveBeenCalledWith('https://api.wit.ai/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'audio/wav',
                    Accept: 'application/vnd.wit.20200513+json',
                    Authorization: `Bearer ${mockApiKey}`,
                },
                body: mockStream,
            });
            expect(mockResponse.json).toHaveBeenCalled();
            expect(result).toEqual({ text: 'Hello World' });
        });

        it('should throw an error if the API response is not ok', async () => {
            const mockStream = 'mock-stream';
            const mockResponse = {
                ok: false,
                status: 400,
            };

            (fs.createReadStream as any).mockReturnValue(mockStream);
            (fetch as any).mockResolvedValue(mockResponse);

            await expect(speechToText(mockFilePath, mockOptions)).rejects.toThrow('HTTP error! status: 400');

            expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
            expect(fetch).toHaveBeenCalledWith('https://api.wit.ai/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'audio/wav',
                    Accept: 'application/vnd.wit.20200513+json',
                    Authorization: `Bearer ${mockApiKey}`,
                },
                body: mockStream,
            });
        });

        it('should handle JSON parsing errors gracefully', async () => {
            const mockStream = 'mock-stream';
            const mockResponse = {
                ok: true,
                json: vi.fn().mockRejectedValue(new Error('JSON parsing error')),
            };

            (fs.createReadStream as any).mockReturnValue(mockStream);
            (fetch as any).mockResolvedValue(mockResponse);

            await expect(speechToText(mockFilePath, mockOptions)).rejects.toThrow('JSON parsing error');

            expect(fs.createReadStream).toHaveBeenCalledWith(mockFilePath);
            expect(fetch).toHaveBeenCalledWith('https://api.wit.ai/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'audio/wav',
                    Accept: 'application/vnd.wit.20200513+json',
                    Authorization: `Bearer ${mockApiKey}`,
                },
                body: mockStream,
            });
            expect(mockResponse.json).toHaveBeenCalled();
        });
    });
});
