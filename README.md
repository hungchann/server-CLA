# Server CLA - Speech-to-Text Audio File Transcription

A Node.js server that provides file-based audio transcription using Google Cloud Speech-to-Text API.

## Features

### 🎤 File Upload Transcription

- Upload audio files (M4A, MP3, WAV, FLAC, OGG, WMA, AAC)
- Automatic conversion to WAV format using FFmpeg
- Speech-to-Text transcription with Google Cloud API
- Support for multiple languages (Chinese, English, Japanese, Korean, etc.)
- Confidence scoring and word-level timestamps

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud account with Speech-to-Text API enabled
- Service account key file
- FFmpeg (automatically handled by ffmpeg-static)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd server-CLA
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
# Create .env file
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
PORT=6600
```

4. Start the server:

```bash
npm start
```

## API Endpoints

### File Upload Transcription

- **POST** `/transcribe` - Upload and transcribe audio files
- **GET** `/health` - Health check endpoint

## Configuration

### Supported Languages

- English (en-US)
- Chinese Simplified (zh-CN)
- Chinese Traditional (zh-TW)
- Japanese (ja-JP)
- Korean (ko-KR)
- Spanish (es-ES)
- French (fr-FR)
- German (de-DE)
- And many more...

## Testing

1. **File Upload**: Use the `/transcribe` endpoint to upload M4A files
2. **API Info**: Check `/health` for server status

## Architecture

**Simplified 2-file structure** for easy maintenance:

- **server.js** (60 lines): Express server, routes, middleware
- **transcribe.js** (400 lines): Complete transcription logic
  - File upload handling (multer)
  - Audio conversion (FFmpeg)
  - Google Speech-to-Text integration
  - Retry logic & error handling
  - Request queuing & concurrency control

## Performance Features

- **Request Queuing**: Automatic queuing when at capacity
- **Retry Logic**: Automatic retry with exponential backoff
- **Memory Management**: Efficient file handling and cleanup

## Troubleshooting

### Common Issues

1. **File Format**: Ensure uploaded files are valid audio format (M4A, MP3, WAV, FLAC, OGG, WMA, AAC)
2. **Credentials**: Verify Google Cloud service account setup
3. **Network**: Check API connectivity and quotas

### Debug Information

- Check server console for detailed logs
- Monitor request processing status
- Verify audio file format and size

## License

ISC

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request
