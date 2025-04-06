import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    test: {
        coverage: {
            include: ['src/**/*.{ts,tsx,js,jsx}'],
        },
        environment: 'node',
        include: ['src/**/*.test.ts'],
        setupFiles: ['./testing/setupTests.ts'],
    },
});
