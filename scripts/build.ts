import { existsSync } from 'node:fs';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import esbuild from 'esbuild';
import ts from 'typescript';

type TsdownConfig = {
    clean?: boolean;
    dts?: boolean;
    entries?: string | string[];
    entry?: string | string[];
    format?: esbuild.Format | esbuild.Format[];
    minify?: boolean;
    outDir?: string;
    sourcemap?: boolean;
    target?: esbuild.BuildOptions['target'];
    tsconfig?: string;
};

type LoadedConfig = {
    config: TsdownConfig;
    path: string;
};

const CONFIG_FILES = ['tsdown.config.mjs', 'tsdown.config.js', 'tsdown.config.cjs', 'tsdown.config.json'];
const FORMAT_HOST: ts.FormatDiagnosticsHost = {
    getCanonicalFileName: (filePath) => filePath,
    getCurrentDirectory: () => process.cwd(),
    getNewLine: () => '\n',
};

async function loadConfig(): Promise<LoadedConfig> {
    for (const file of CONFIG_FILES) {
        const fullPath = path.join(process.cwd(), file);
        if (!existsSync(fullPath)) {
            continue;
        }

        if (fullPath.endsWith('.json')) {
            const raw = await readFile(fullPath, 'utf8');
            return { config: JSON.parse(raw) as TsdownConfig, path: fullPath };
        }

        const module = await import(pathToFileURL(fullPath).href);
        const config = (module.default ?? module) as TsdownConfig;
        return { config, path: fullPath };
    }

    throw new Error('Unable to locate tsdown configuration file.');
}

async function emitDeclarations(tsconfigPath: string): Promise<void> {
    const tsconfigFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

    if (tsconfigFile.error) {
        throw new Error(ts.formatDiagnosticsWithColorAndContext([tsconfigFile.error], FORMAT_HOST));
    }

    const parsed = ts.parseJsonConfigFileContent(tsconfigFile.config, ts.sys, path.dirname(tsconfigPath));
    const compilerOptions: ts.CompilerOptions = {
        ...parsed.options,
        declaration: true,
        emitDeclarationOnly: true,
    };

    const program = ts.createProgram(parsed.fileNames, compilerOptions);
    const preDiagnostics = ts.getPreEmitDiagnostics(program);

    if (preDiagnostics.length > 0) {
        throw new Error(ts.formatDiagnosticsWithColorAndContext(preDiagnostics, FORMAT_HOST));
    }

    const emitResult = program.emit(undefined, undefined, undefined, true);

    if (emitResult.diagnostics.length > 0) {
        throw new Error(ts.formatDiagnosticsWithColorAndContext(emitResult.diagnostics, FORMAT_HOST));
    }
}

async function run(): Promise<void> {
    const { config, path: configPath } = await loadConfig();
    const entries = config.entries ?? config.entry ?? [];
    const entryPoints = Array.isArray(entries) ? entries : [entries];

    if (entryPoints.length === 0) {
        throw new Error('The tsdown configuration must provide at least one entry.');
    }

    const outDir = config.outDir ?? 'dist';

    if (config.clean) {
        await rm(outDir, { force: true, recursive: true });
    }

    const format = Array.isArray(config.format) ? config.format[0] : config.format;

    await esbuild.build({
        bundle: true,
        entryPoints,
        format: format ?? 'esm',
        logLevel: 'info',
        minify: config.minify ?? false,
        outdir: outDir,
        packages: 'external',
        platform: 'node',
        sourcemap: config.sourcemap ?? false,
        target: config.target ?? 'esnext',
        tsconfig: config.tsconfig ?? 'tsconfig.json',
    });

    if (config.dts) {
        const tsconfigPath = path.resolve(process.cwd(), config.tsconfig ?? 'tsconfig.json');
        await emitDeclarations(tsconfigPath);
    }

    console.info(
        `Built ${entryPoints.length} module${entryPoints.length === 1 ? '' : 's'} using tsdown (${configPath}).`,
    );
}

run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
