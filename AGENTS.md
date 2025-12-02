# Agent Guidelines

## Tooling
- Use **Bun** for all developer workflows.
  - Run unit tests with `bun test` (end-to-end tests in `testing/e2e.test.ts` require valid Wit.ai keys and `ffmpeg`; keep them disabled unless you have credentials and `RUN_E2E=true`).
  - Build artifacts with `bun run build`. This executes the TypeScript build runner located at `scripts/build.ts`, which mirrors `tsdown`'s behaviour (bundles via `esbuild`, emits declarations through `tsc`, and reads `tsdown.config.mjs`).
  - Lint and format with `bun run lint` (Biome handles linting, formatting, and import organization).
- Do **not** re-introduce a vendored copy of `tsdown`. If you need to tweak the build, update `scripts/build.ts` or `tsdown.config.mjs` instead.

## Repository structure
- `src/`: Library source. Keep business logic in focused modules (e.g., `wit.ai.ts`, `transcriber.ts`, utilities in `src/utils/`).
- `src/**/*.test.ts`: Bun test suites colocated with the code under test.
- `testing/e2e.test.ts`: opt-in Wit.ai integration test. It should stay skipped unless explicitly invoked.
- `scripts/build.ts`: lightweight tsdown-compatible build runner.
- `tsdown.config.mjs`: Build inputs/outputs used by `scripts/build.ts`.
- `README.md`: Public API and contributor docs. Update the feature list and API tables when exports change.
- `biome.json`: Single source of truth for formatting/lint rules.

## Coding conventions
- This is an **ESM + TypeScript** codebase. Prefer named exports, `async`/`await`, and immutable data structures.
- Keep functions pure when practical and include concise **JSDoc** blocks for exported helpers, classes, and complex internal utilities.
- Error handling: throw typed errors (`TranscriptionError`, etc.) and propagate causes. Avoid swallowing stack traces.
- Logging is performed through `src/utils/logger.ts`. The logger is configured via the `init()` function, allowing clients to provide any logger implementation they prefer. Do not instantiate additional loggers outside that helper.
- Tests should rely on Bun's `bun:test` primitives (`describe`, `it`, `mock.module`, etc.) and avoid global state leakage. Mock Wit.ai/network access with inline helpers.
- Follow Biome's formatting (4-space indentation, 120-column width, single quotes). Run `bun run lint --apply` when you change more than a few files.

## Pull requests & verification
- Before committing, run:
  1. `bun run lint`
  2. `bun run build`
  3. `bun test`
- Document any environment limitations (e.g., registry/network 403) in your summary when they block toolchain updates.
