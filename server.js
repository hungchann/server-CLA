const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const speech = require('@google-cloud/speech');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Initialize Google Speech-to-Text client
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Path to your service account key
});

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mp4' || file.mimetype === 'audio/m4a' || path.extname(file.originalname).toLowerCase() === '.m4a') {
      cb(null, true);
    } else {
      cb(new Error('Only .m4a files are allowed!'), false);
    }
  }
});

// Create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads');
  }
};

// Convert M4A to WAV using FFmpeg
const convertM4AToWAV = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => {
        console.log('Audio conversion completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('Audio conversion error:', err);
        reject(err);
      })
      .save(outputPath);
  });
};

// Transcribe audio using Google Speech-to-Text
const transcribeAudio = async (audioFilePath) => {
  try {
    const audioBytes = await fs.readFile(audioFilePath);

    const request = {
      audio: {
        content: audioBytes.toString('base64'),
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US', // Change this to your preferred language
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
      },
    };

    const [response] = await speechClient.recognize(request);
    const transcription = response.results
      .map(result => result.alternatives[0].transcript)
      .join('\n');

    return {
      transcription,
      confidence: response.results[0]?.alternatives[0]?.confidence || 0,
      words: response.results[0]?.alternatives[0]?.words || []
    };
  } catch (error) {
    console.error('Speech-to-Text error:', error);
    throw error;
  }
};

// Clean up temporary files
const cleanupFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Speech-to-Text server is running' });
});

// Main endpoint for audio transcription
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  let tempFiles = [];
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    console.log('Received file:', req.file.originalname);
    
    const inputPath = req.file.path;
    const outputPath = path.join('uploads', `converted_${Date.now()}.wav`);
    tempFiles = [inputPath, outputPath];

    // Convert M4A to WAV
    console.log('Converting audio format...');
    await convertM4AToWAV(inputPath, outputPath);

    // Transcribe audio
    console.log('Transcribing audio...');
    const transcriptionResult = await transcribeAudio(outputPath);

    // Clean up temporary files
    await cleanupFiles(tempFiles);

    // Send response
    res.json({
      success: true,
      transcription: transcriptionResult.transcription,
      confidence: transcriptionResult.confidence,
      wordCount: transcriptionResult.words.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing audio:', error);
    
    // Clean up temporary files in case of error
    await cleanupFiles(tempFiles);
    
    res.status(500).json({
      success: false,
      error: 'Failed to process audio file',
      details: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
    }
  }
  
  res.status(500).json({ error: error.message });
});

// Start server
const startServer = async () => {
  await ensureUploadsDir();
  
  app.listen(PORT, () => {
    console.log(`🚀 Speech-to-Text server is running on port ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/health`);
    console.log(`🎤 Upload endpoint: http://localhost:${PORT}/transcribe`);
  });
};

startServer().catch(console.error);
