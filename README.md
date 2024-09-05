# Tafrigh

Tafrigh is a TypeScript-based NodeJS audio processing library inspired by the Python Tafrigh project. It simplifies the process of transcribing audio files using external APIs like Wit.ai. The library includes built-in support for splitting audio into chunks, noise reduction, and managing multiple API keys to optimize transcription workflows for larger files.

## Features

-   **Audio Splitting**: Automatically splits audio files into manageable chunks based on silence detection, which is ideal for services that impose file size limits.
-   **Noise Reduction**: Apply configurable noise reduction and dialogue enhancement to improve transcription accuracy.
-   **Transcription**: Seamlessly integrates with Wit.ai to transcribe audio chunks, returning results in `.json` format.
-   **Smart Concurrency**: Supports cycling between multiple Wit.ai API keys to avoid rate limits.
-   **Flexible Configuration**: Offers a range of options to control audio processing, silence detection, chunk duration, and more.
-   **Logging Control**: Uses the `pino` logging library, with logging levels configurable via environment variables.

## Installation

```bash
npm install tafrigh
```

## Usage

### Basic Example

```javascript
const { transcribeFiles, init } = require('tafrigh');

const filePaths = ['path/to/audiofile1.mp3', 'path/to/audiofile2.mp3'];
const options = {
    outputDir: 'path/to/output',
    formattingOptions: {
        noiseReduction: {
            highpass: 300,
            afftdn_nf: -20,
            dialogueEnhance: true,
        },
    },
    splitOptions: {
        chunkDuration: 30,
        silenceDetection: {
            silenceThreshold: -35,
            silenceDuration: 0.3,
        },
    },
};

init({ apiKey: 'your-wit-ai-key' });
transcribeFiles(filePaths, options)
    .then((results) => console.log('Transcription complete:', results))
    .catch((error) => console.error('Transcription failed:', error));
```

### Advanced Usage

Tafrigh allows for more advanced configurations:

```javascript
const options = {
    apiKeyRotation: ['key1', 'key2', 'key3'], // Rotate between multiple API keys
    outputDir: 'path/to/output',
    splitOptions: {
        chunkDuration: 60, // Split audio into 60-second chunks
        silenceDetection: {
            silenceThreshold: -30, // Adjust sensitivity of silence detection
            silenceDuration: 0.5, // Minimum silence length to split at
        },
    },
    formattingOptions: {
        noiseReduction: {
            highpass: 200,
            afftdn_nf: -25,
            dialogueEnhance: true,
        },
    },
    loggingLevel: 'debug', // Control logging verbosity via pino
};

init({ apiKey: 'your-wit-ai-key' });
transcribeFiles(['path/to/audiofile.mp3'], options)
    .then((results) => console.log('Advanced Transcription complete:', results))
    .catch((error) => console.error('Transcription failed:', error));
```

## API Documentation

### `transcribeFiles(filePaths: string[], options: TranscribeFilesOptions)`

-   **filePaths**: An array of file paths or URLs for the audio files to be transcribed.
-   **options**: A detailed object to configure splitting, noise reduction, concurrency, and more.

#### Options

-   **apiKeyRotation**: An array of Wit.ai API keys that Tafrigh will cycle through to prevent hitting rate limits.
-   **outputDir**: The directory where the transcription results will be saved.
-   **splitOptions**: Configuration for splitting audio files:
    -   `chunkDuration` (default: `30` seconds): Length of each audio chunk.
    -   `silenceDetection`: Silence-based splitting configuration:
        -   `silenceThreshold` (default: `-35dB`): The volume level considered as silence.
        -   `silenceDuration` (default: `0.3s`): Minimum duration of silence to trigger a split.
-   **formattingOptions**: Controls for audio formatting and noise reduction:
    -   `noiseReduction`: Reduce background noise during processing:
        -   `highpass` (default: `300Hz`): Frequency for high-pass filter.
        -   `afftdn_nf` (default: `-20dB`): Noise floor adjustment.
        -   `dialogueEnhance` (default: `false`): Enhances speech clarity.
-   **loggingLevel**: Adjust the level of logging output. Set the `LOG_LEVEL` environment variable to values like `info`, `debug`, or `error`.

#### Output

-   The transcription result is saved in `.json` format in the specified output directory.

## Configuration Limits

From `constants.ts`:

-   **Silence Threshold**: Range is from `-50dB` to `-10dB`.
-   **Silence Duration**: Minimum `0.1s`, maximum `2s`.
-   **Chunk Duration**: Maximum `300s` (5 minutes).

## Contributing

Contributions are welcome! Please make sure your contributions adhere to the coding standards and are accompanied by relevant tests.

## License

Tafrigh is released under the MIT License. See the LICENSE file for more details.

## Acknowledgements

This project was inspired by the Python-based [Tafrigh project](https://github.com/ieasybooks/tafrigh), with additional improvements for audio chunking, noise reduction, and concurrency management.
