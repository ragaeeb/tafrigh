# Tafrigh

Tafrigh is a NodeJS library designed to streamline the transcription of audio and video files using external APIs such as Wit.ai. It includes built-in features for audio processing like noise reduction, silence detection, and automatic chunking, allowing the processing of large files in a more efficient manner. Tafrigh also enables smart concurrency management for parallel transcriptions and offers advanced configuration options to improve transcription accuracy.

## Features

-   **Audio Splitting**: Automatically splits audio into manageable chunks based on silence detection, making large files easier to process.
-   **Noise Reduction**: Built-in noise reduction filters, such as high-pass filters and dialogue enhancement, improve transcription accuracy.
-   **API Integration**: Uses Wit.ai for transcription of audio chunks.
-   **Concurrency Management**: Utilizes a dynamic approach to determine the optimal number of concurrent transcription processes based on the number of available API keys and the client's specified limits.
-   **Error Handling & Logging**: Provides robust error handling and custom logging using the pino logging framework, with configurable verbosity.
-   **Output**: Transcriptions are currently saved in .json format, making it easy to work with structured data.

## Installation

```bash
npm install tafrigh
```

## Usage

Here is a simple example of how to use Tafrigh to transcribe audio files:

```javascript
const { transcribeFiles } = require('tafrigh');

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

transcribeFiles(filePaths, options)
    .then((results) => console.log('Transcription complete:', results))
    .catch((error) => console.error('Transcription failed:', error));
```

## API Documentation

transcribeFiles(filePaths, options): Main function to process and transcribe audio files. Accepts an array of file paths and options for processing and transcription.

## Configuration

Detailed configuration options are provided to adjust the preprocessing and transcription process according to the requirements.

## Contributing

Contributions are welcome! Please ensure your code follows the established linting and formatting rules, and include appropriate tests for any new features or bug fixes.

## License

Tafrigh is released under the MIT License. See the LICENSE file for more details.
