# Tafrigh

Tafrigh is an audio processing library designed to facilitate audio file transcription using external APIs like Wit.ai. It provides utilities to handle audio file preprocessing, including splitting audio into chunks and noise reduction, making it easier to transcribe large audio files or streams efficiently.

## Features

-   **Audio Splitting**: Split audio files into manageable chunks based on silence detection, which can then be sent to transcription services.
-   **Noise Reduction**: Apply noise reduction filters to improve transcription accuracy.
-   **Transcription**: Integrate with Wit.ai to transcribe audio chunks and compile the results.
-   **Flexible Configuration**: Customize the behavior through various options, including silence sensitivity and chunk duration.

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

Contributions to Tafrigh are welcome. Please ensure that your contributions adhere to the project's coding standards and include appropriate tests.

## License

Tafrigh is released under the MIT License. See the LICENSE file for more details.
