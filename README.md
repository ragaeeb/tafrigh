# tafrigh

[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/ff26a908-ad4b-4da5-9ad4-5283697583be.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/ff26a908-ad4b-4da5-9ad4-5283697583be) [![E2E](https://github.com/ragaeeb/tafrigh/actions/workflows/e2e.yml/badge.svg)](https://github.com/ragaeeb/tafrigh/actions/workflows/e2e.yml) [![Node.js CI](https://github.com/ragaeeb/tafrigh/actions/workflows/build.yml/badge.svg)](https://github.com/ragaeeb/tafrigh/actions/workflows/build.yml) ![GitHub License](https://img.shields.io/github/license/ragaeeb/tafrigh) ![GitHub Release](https://img.shields.io/github/v/release/ragaeeb/tafrigh) [![codecov](https://codecov.io/github/ragaeeb/tafrigh/graph/badge.svg?token=9DWYN1ETDS)](https://codecov.io/github/ragaeeb/tafrigh) [![Size](https://deno.bundlejs.com/badge?q=tafrigh@1.2.0&badge=detailed)](https://bundlejs.com/?q=tafrigh%401.2.0) ![typescript](https://badgen.net/badge/icon/typescript?icon=typescript&label&color=blue)

`tafrigh` is a NodeJS audio processing library that simplifies the process of transcribing audio files using external APIs like `wit.ai`. The library includes built-in support for splitting audio into chunks, noise reduction, and managing multiple API keys to optimize transcription workflows for larger files.

## Features

-   **Audio Splitting**: Automatically splits audio files into manageable chunks based on silence detection, which is ideal for services that impose file or duration size limits.
-   **Noise Reduction**: Apply configurable noise reduction and dialogue enhancement to improve transcription accuracy.
-   **Multiple Inputs Supported**: Supports streams, remote media file urls or a local media file paths.
-   **Transcription**: Seamlessly integrates with Wit.ai to transcribe audio chunks, returning results in `.json` format.
-   **Smart Concurrency**: Supports cycling between multiple Wit.ai API keys to avoid rate limits.
-   **Flexible Configuration**: Offers a range of options to control audio processing, silence detection, chunk duration, and more.
-   **Logging Control**: Uses the `pino` logging library, with logging levels configurable via environment variables.

## Installation

```bash
npm install tafrigh
```

or

```bash
pnpm install tafrigh
```

or

```bash
yarn add tafrigh
```

## Usage

### Basic Example

```javascript
import { init, transcribe } from 'tafrigh';

init({ apiKeys: ['your-wit-ai-key'] });
const outputPath = await transcribe('https://your-domain.com/path/to/media.mp3'); // path to JSON of transcription
```

The language that will be used for transcription will be associated with the language used for the wit.ai API key app.

If your wit.ai key is associated with the English language, and you provide it an Arabic media file it will not produce an accurate transcription and vice-versa.

### Advanced Usage

Tafrigh allows for more advanced configurations:

```javascript
init({ apiKeys: ['wit-ai-key1', 'wit-ai-key2', 'wit-ai-key3'] });

const options = {
    concurrency: 5 // have at most 5 parallel worker threads doing the transcription
    outputOptions: { outputFile: 'path/to/output.json' },
    splitOptions: {
        chunkDuration: 60, // Split audio into 60-second chunks
        chunkMinThreshold: 4,
        silenceDetection: {
            silenceThreshold: -30,
            silenceDuration: 0.5,
        },
    },
    preprocessOptions: {
        noiseReduction: {
            afftdnStart: 1,
            afftdnStop: 1,
            afftdn_nf: -25,
            dialogueEnhance: true,
            lowpass: 1,
            highpass: 200
        },
    },
    callbacks: {
        onPreprocessingFinished: async (filePath: string) => console.log(`Preprocessed ${filePath}`),
        onPreprocessingProgress: async (percent: number) => console.log(`Preprocessing ${percent}% complete`),
        onPreprocessingStarted: async (filePath: string) => console.log(`Preprocessed ${filePath}`),
        onSplittingFinished: async () => console.log(`Finished splitting media`),
        onSplittingProgress: async (chunkFilePath: string, chunkIndex: number) => console.log(`Chunked part ${chunkIndex} ${chunkFilePath}`),
        onSplittingStarted: async (totalChunks: number) => console.log(`Chunking ${totalChunks} parts`),
        onTranscriptionFinished: async (transcripts: Transcript[]) => console.log(`Transcribed ${transcripts.length} chunks`),
        onTranscriptionProgress: async (chunkIndex: number) => console.log(`Transcribing part ${chunkIndex}`),
        onTranscriptionStarted: async (totalChunks: number) => console.log(`Transcribing ${totalChunks} chunks`),
    }
};

const outputPath = await transcribe('path/to/test.mp3', options);
console.log(outputPath); // path/to/output.json
```

## API Documentation

### `init(options: TafrighOptions)`

-   **options**: Global options applicable to the tafrigh library.
    -   **apiKeys**: An array of `wit.ai` API keys that tafrigh will cycle through to prevent hitting rate limits. The more keys you provide the more concurrent processing it can support to speed up the total time.
        -   Note that the keys used here are going to impact the language of the transcription. If the media inputs your app will use for the transcription can vary between multiple languages then make sure you initialize this with the appropriate set of keys that matches the language you want to transcribe from the `wit.ai` keys dashboard.
        -   The API keys can also be set by setting the `WIT_AI_API_KEYS` environment variable like this:
        ```
        WIT_AI_API_KEYS="key1 key2 key3"
        ```

### `transcribe(content: string | Readable, options: TranscribeFilesOptions)`

-   **content**: Any media supported by ffmpeg (ie: wav, mp4, mp3, etc.) or a Readable stream. You can specify it as a local path like `./folder/file.mp3` or as a remote url `https://domain.com/path/to/file.mp3`. You can use this in conjuction with modules like `ytdl-core` to feed it a Stream to transcribe.
-   **options**: A detailed object to configure splitting, noise reduction, concurrency, and more.

#### Options

-   **concurrency**: An upper limit on the total number of concurrent processing threads to allow. The minimum between the total API keys and this value will be used for the actual number of parallel threads to allow. If you have more API keys specified, you can allow for higher concurrency, but you can also limit the total number of threads by setting this value so that your CPU is not taxed.
    -   If this property is omitted `tafrigh` will use the total number of API keys available to determine the optimal number of threads to create based on the total number of chunks created per media.
-   **preventCleanup**: Set this to `true` if you do not want the directory created in the OS temporary folder for processing chunks and noise reduction to be automatically deleted upon transcription completion. This should rarely be set except for troubleshooting and debugging.
-   **splitOptions**: Configuration for splitting audio files. This is important because due to the nature of our strategy for chunking the files so that we can get around maximum duration limitations of the `wit.ai` API. If we split prematurely then we can possibly split in between a word being spoken and the transcription will suffer from inaccuracy. It would be appropriate to spend some time adjusting these values if necessary so that your particular media file can be configured optimally as depending on the amount of times the speaker pauses or the background noise can vary. The audio chunks are padded with some silence and also normalized to improve transcription accuracy on less audible sections of the audio.
    -   `chunkDuration` (default: `60` seconds): Maximum length of each audio chunk. Note that the actual length of the chunk can sometimes be less than this value depending on if we detected that we would have split in the middle of a word so we split at the last possible silence. This value will also affect the final transcription as depending on what value is chosen for this property there will be more granular timestamps.
    -   `chunkMinThreshold` (default: `0.9` seconds): Minimum length of each chunk. If a chunk is detected that falls below this duration it will be filtered out.
    -   `silenceDetection`: Silence-based splitting configuration:
        -   `silenceThreshold` (default: `-25`): The volume level in `dB` considered as silence. If there is more background noise that exists in your media even if the speaker is silence, and you want to have better accuracy on the chunking in the actual silences adjust this value appropriately.
        -   `silenceDuration` (default: `0.1s`): Minimum duration of silence to trigger a split. If your media generally has longer pauses, you can increase this value to get more accurate chunking.
-   **preprocessOptions**: Controls for audio formatting and noise reduction:
    -   `noiseReduction`: Reduce background noise during processing.
        -   You can omit the noise reduction step by setting this to `null`: `transcribe(file, { preprocessOptions: { noiseReduction: null } })`
        -   `highpass` (default: `300`): Frequency in Hz for high-pass filter which isolates the voice frequencies to filter out the noise frequencies. Set this to `null` to omit it entirely and not use the default.
        -   `lowpass` (default: `3000`): Frequency in Hz for low-pass filter to allow frequencies below a specified cutoff frequency to pass through while attenuating frequencies above that cutoff. Set this to `null` to omit it entirely and not use the default.
        -   `afftdnStart` (default: `0`): FFT-based denoiser noise floor adjustment. This is used to specify the time to begin the noise reduction process. This must be used alongside `afftdnStop` to apply. Set this to `null` to omit it entirely and not use the default.
        -   `afftdnStop` (default: `1.5`): The time that specifies when to stop the noise reduction process. This must be used along with `afftdnStart` to be applied. Set this to `null` to omit it entirely and not use the default.
        -   `afftdn_nf` (default: `-20`): Specifies the noise floor parameter in dB for the denoiser. This value helps adjust the threshold for what is considered noise. Set this to `null` to omit it entirely and not use the default.
        -   `dialogueEnhance` (default: `true`): Enhances speech clarity. It typically boosts the midrange frequencies where human speech is most prominent, making dialogue easier to understand.
-   **callbacks**: Callbacks to let the client manage progress and add custom preprocessing:
    -   `onPreprocessingStarted(filePath: string): Promise<void>`: Fired just before preprocessing of the media is started with the `filePath` being the file being preprocessed.
    -   `onPreprocessingFinished(filePath: string): Promise<void>`: Fired just after preprocessing of the media is completed with the `filePath` being the file that was preprocessed.
    -   `onPreprocessingProgress(percent: number): void`: Fired as the file is being preprocessed to track the progress.
    -   `onSplittingStarted(totalChunks: number): Promise<void>`: Fired just before the preprocessed media is starting to get chunked.
    -   `onSplittingFinished(): Promise<void>`: Fired just after splitting of the chunks is completed.
    -   `onSplittingProgress(chunkFilePath: string, chunkIndex: number): void`: Fired as each chunk is created with the `chunkFilePath` pointing to the chunk created and the `chunkIndex` representing the index of the chunk relative to the `totalChunks` from the `onSplittingStarted` callback.
    -   `onTranscriptionStarted(totalChunks: number): Promise<void>`: Fired just before the chunks are ready to be sent to `wit.ai` for transcriptions.
    -   `onTranscriptionFinished(transcripts: Transcript[]): Promise<void>`: Fired after all the transcriptions was processed. The `transcripts` represents the full payload we received from the `wit.ai` API and can contain extra metadata such as word-by-word timestamps which is filtered out from the final json file that gets written out.
    -   `onTranscriptionProgress(chunkIndex: number): void`: Fired as each request is made to the `wit.ai` API with the `chunkIndex` represents the index with respect to the `totalChunks` value sent from the `onTranscriptionStarted` callback.

### Logging

Adjust the level of logging output by setting the `LOG_LEVEL` environment variable to values like `info`, `debug`, or `error`.

#### Output

-   The transcription result is saved in `.json` format in the specified output directory.

The JSON file is an array that looks like this with `start` specifying the time in seconds the `text` starts and `end` marking where it ends. Note that setting an appropriate `chunkDuration` will affect how many elements this produces and the granularity of the transcription:

```json
[
    { "text": "A", "start": 0, "end": 10 },
    { "text": "B", "start": 10, "end": 20 },
    { "text": "C", "start": 20, "end": 30 }
]
```

## Contributing

Contributions are welcome! Please make sure your contributions adhere to the coding standards and are accompanied by relevant tests.

## License

`tafrigh` is released under the MIT License. See the LICENSE file for more details.

## Acknowledgements

This project was inspired by the Python-based [Tafrigh project](https://github.com/ieasybooks/tafrigh), with additional improvements for audio chunking, noise reduction, and concurrency management.
