# Speech-to-Text Server

A Node.js server that handles M4A audio file uploads, converts them to WAV format, and transcribes them using Google Speech-to-Text API.

## Features

- 📁 Upload M4A audio files via REST API
- 🔄 Convert M4A to WAV format using FFmpeg
- 🎤 Transcribe audio using Google Speech-to-Text
- 🧹 Automatic cleanup of temporary files
- ⚡ Fast and efficient processing
- 🔒 File size limits and validation

## Prerequisites

- Node.js (v14 or higher)
- Google Cloud account with Speech-to-Text API enabled
- Google Cloud service account key

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
cd server-CLA
npm install
```

### 2. Google Cloud Setup

1. Create a Google Cloud project
2. Enable the Speech-to-Text API
3. Create a service account and download the JSON key file
4. Place the key file in your project directory

### 3. Environment Configuration

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your configuration:

   ```env
   PORT=3000
   GOOGLE_APPLICATION_CREDENTIALS=./path/to/your/service-account-key.json
   GOOGLE_CLOUD_PROJECT_ID=your-project-id
   ```

### 4. Start the Server

Development mode (with auto-reload):

```bash
npm run dev  # Requires nodemon: npm install -g nodemon
```

Production mode:

```bash
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

Response:

```json
{
  "status": "OK",
  "message": "Speech-to-Text server is running"
}
```

### Transcribe Audio

```
POST /transcribe
Content-Type: multipart/form-data
```

Parameters:

- `audio`: M4A audio file (max 10MB)

Response:

```json
{
  "success": true,
  "transcription": "Your transcribed text here",
  "confidence": 0.95,
  "wordCount": 25,
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Usage Example

### Using curl

```bash
curl -X POST \
  -F "audio=@your-audio-file.m4a" \
  http://localhost:3000/transcribe
```

### Using Expo/React Native

```javascript
const uploadAudio = async (audioUri) => {
  const formData = new FormData();
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  });

  try {
    const response = await fetch('http://localhost:3000/transcribe', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const result = await response.json();
    console.log('Transcription:', result.transcription);
  } catch (error) {
    console.error('Upload error:', error);
  }
};
```

## Configuration Options

### Audio Processing

- Input format: M4A
- Output format: WAV (16kHz, mono, 16-bit)
- Max file size: 10MB
- Language: English (US) - configurable in server.js

### Google Speech-to-Text Settings

- Automatic punctuation: Enabled
- Word time offsets: Enabled
- Sample rate: 16000 Hz
- Encoding: LINEAR16

## Error Handling

The server handles various error scenarios:

- Invalid file formats
- File size limits
- Google API errors
- FFmpeg conversion errors
- Network issues

## Security Considerations

- File type validation
- File size limits
- Temporary file cleanup
- CORS enabled for cross-origin requests

## Deployment

### Local Development

```bash
npm run dev
```

### Production Deployment Options

1. **Heroku**
2. **AWS EC2/Lambda**
3. **Google Cloud Run**
4. **Vercel**
5. **Docker**

Make sure to:

- Set environment variables in your deployment platform
- Upload your Google Cloud service account key securely
- Configure appropriate file storage for larger deployments

## Troubleshooting

### Common Issues

1. **FFmpeg not found**: Ensure ffmpeg-static is installed
2. **Google Cloud authentication**: Check service account key path
3. **File upload issues**: Verify file format and size
4. **CORS errors**: Configure CORS settings for your frontend domain

### Logs

The server provides detailed logging for:

- File uploads
- Audio conversion progress
- Transcription results
- Error details

## License

ISC
