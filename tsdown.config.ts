import { defineConfig } from 'tsdown';

export default defineConfig({
    clean: true,
    dts: true,
    entry: ['src/index.ts'],
    external: ['ffmpeg-simplified'],
    format: ['esm'],
    outDir: 'dist',
    sourcemap: true,
    target: 'node24',
});
