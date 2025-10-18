const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const speech = require('@google-cloud/speech');
const fs = require('fs').promises;
const path = require('path');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Initialize Google Speech-to-Text client
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Configuration
const CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  MAX_BACKOFF: 10000,
  MAX_CONCURRENT_REQUESTS: 10,
  REQUEST_TIMEOUT: 30000,
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
};

// Error types
const ErrorTypes = {
  TRANSIENT: 'TRANSIENT',
  PERMANENT: 'PERMANENT',
  RATE_LIMIT: 'RATE_LIMIT',
  SYSTEM: 'SYSTEM'
};

// Request management
const pendingRequests = new Map();
const requestQueue = [];

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: CONFIG.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (!file || !file.originalname) {
      return cb(new Error('Invalid file data'), false);
    }
    
    const validMimeTypes = [
      'audio/mp4', 'audio/m4a', 'audio/wav', 'audio/mp3', 
      'audio/ogg', 'audio/webm', 'audio/aac'
    ];
    const validExtensions = ['.m4a', '.mp4', '.wav', '.mp3', '.ogg', '.webm', '.aac'];
    
    const isValidMimeType = validMimeTypes.includes(file.mimetype);
    const isValidExtension = validExtensions.includes(path.extname(file.originalname).toLowerCase());
    
    if (isValidMimeType || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Only audio files are allowed! Supported: ${validExtensions.join(', ')}`), false);
    }
  }
});

// Ensure uploads directory exists
const ensureUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads');
  }
};

// Convert audio to WAV using FFmpeg
const convertAudioToWAV = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('wav')
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .audioFrequency(16000)
      .on('end', () => resolve())
      .on('error', reject)
      .save(outputPath);
  });
};

// Clean up temporary files
const cleanupFiles = async (filePaths) => {
  for (const filePath of filePaths) {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error(`Error deleting file ${filePath}:`, error.message);
    }
  }
};

// Classify errors
const classifyError = (error) => {
  if (error.code === 11 || error.code === 14) return ErrorTypes.TRANSIENT;
  if (error.code === 3 || error.code === 9) return ErrorTypes.PERMANENT;
  if (error.code === 8) return ErrorTypes.RATE_LIMIT;
  if (error.code === 13) return ErrorTypes.SYSTEM;
  return ErrorTypes.TRANSIENT;
};

// Retry with exponential backoff
const retryWithBackoff = async (operation, maxRetries = CONFIG.MAX_RETRIES) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);
      
      if (errorType === ErrorTypes.PERMANENT) {
        throw error;
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(
        CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1),
        CONFIG.MAX_BACKOFF
      );
      
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms for error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Transcribe audio with Google Speech-to-Text
const transcribeAudio = async (audioFilePath, languageCode, requestId = null) => {
  const operation = async () => {
    try {
      const audioBytes = await fs.readFile(audioFilePath);
      const request = {
        audio: { content: audioBytes.toString('base64') },
        config: {
          encoding: 'LINEAR16',
          sampleRateHertz: 16000,
          languageCode,
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          maxAlternatives: 3,
          profanityFilter: false
        },
      };

      // Add request timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.REQUEST_TIMEOUT);
      });

      const transcriptionPromise = speechClient.recognize(request);
      const [response] = await Promise.race([transcriptionPromise, timeoutPromise]);
      
      if (!response.results || response.results.length === 0) {
        return { transcription: '', confidence: 0, words: [] };
      }

      let fullTranscription = '';
      let allWords = [];
      let highestConfidence = 0;
      let alternatives = [];

      for (const result of response.results) {
        if (result.alternatives && result.alternatives.length > 0) {
          const alternative = result.alternatives[0];
          if (alternative.transcript) {
            fullTranscription += alternative.transcript + ' ';
          }
          if (alternative.confidence && alternative.confidence > highestConfidence) {
            highestConfidence = alternative.confidence;
          }
          if (alternative.words) {
            allWords = allWords.concat(alternative.words);
          }
          
          alternatives.push({
            transcript: alternative.transcript,
            confidence: alternative.confidence
          });
        }
      }

      return {
        transcription: fullTranscription.trim(),
        confidence: highestConfidence,
        words: allWords,
        alternatives: alternatives
      };
    } catch (error) {
      console.error('Speech-to-Text error:', error.message);
      
      if (requestId) {
        console.error(`Request ID ${requestId} failed:`, {
          error: error.message,
          code: error.code,
          languageCode,
          timestamp: new Date().toISOString()
        });
      }
      
      throw error;
    }
  };

  return retryWithBackoff(operation);
};

// Process queued requests
const processQueue = () => {
  if (requestQueue.length === 0 || pendingRequests.size >= CONFIG.MAX_CONCURRENT_REQUESTS) {
    return;
  }

  const queuedRequest = requestQueue.shift();
  if (queuedRequest) {
    console.log(`Processing queued request ${queuedRequest.requestId}`);
    setTimeout(() => {
      queuedRequest.app._router.handle(queuedRequest.req, queuedRequest.res, () => {});
    }, 100);
  }
};

// Main transcription handler
const handleTranscription = async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let tempFiles = [];
  
  try {
    // Check if at capacity - add to queue
    if (pendingRequests.size >= CONFIG.MAX_CONCURRENT_REQUESTS) {
      return new Promise((resolve) => {
        requestQueue.push({ req, res, requestId, timestamp: Date.now(), app: req.app });
        console.log(`Request ${requestId} queued. Queue length: ${requestQueue.length}`);
      });
    }

    // Track this request
    pendingRequests.set(requestId, { startTime: Date.now() });
    
    if (!req.file) {
      pendingRequests.delete(requestId);
      return res.status(400).json({ 
        success: false, 
        error: 'No audio file uploaded',
        requestId 
      });
    }

    const inputPath = req.file.path;
    const outputPath = path.join('uploads', `converted_${Date.now()}.wav`);
    tempFiles = [inputPath, outputPath];

    // Convert audio format with retry
    await retryWithBackoff(async () => {
      return convertAudioToWAV(inputPath, outputPath);
    });

    // Try language codes with fallback strategy
    const languageCodes = ['zh-CN', 'zh-TW', 'zh-HK', 'zh'];
    let transcriptionResult = null;
    let usedLanguageCode = null;
    let lastError = null;

    for (const code of languageCodes) {
      try {
        const result = await transcribeAudio(outputPath, code, requestId);
        if (result.transcription && result.transcription.trim().length > 0 && result.confidence > 0.5) {
          transcriptionResult = result;
          usedLanguageCode = code;
          break;
        }
      } catch (err) {
        lastError = err;
        const errorType = classifyError(err);
        console.error(`Transcription failed for languageCode ${code}:`, {
          error: err.message,
          type: errorType,
          requestId
        });
        
        // If permanent error, don't try other languages
        if (errorType === ErrorTypes.PERMANENT) {
          break;
        }
      }
    }

    // Clean up temporary files
    await cleanupFiles(tempFiles);
    pendingRequests.delete(requestId);

    if (!transcriptionResult) {
      return res.json({
        success: true,
        transcription: '',
        confidence: 0,
        wordCount: 0,
        languageCodeTried: languageCodes,
        lastError: lastError ? {
          message: lastError.message,
          type: classifyError(lastError)
        } : null,
        requestId,
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      transcription: transcriptionResult.transcription,
      confidence: transcriptionResult.confidence,
      wordCount: transcriptionResult.words?.length || 0,
      languageCode: usedLanguageCode,
      requestId,
      timestamp: new Date().toISOString()
    });

    // Process queued requests
    processQueue();

  } catch (error) {
    console.error(`Error processing audio for request ${requestId}:`, error);
    await cleanupFiles(tempFiles);
    pendingRequests.delete(requestId);
    
    const errorType = classifyError(error);
    res.status(500).json({
      success: false,
      error: 'Failed to process audio file',
      details: error.message,
      errorType,
      requestId,
      timestamp: new Date().toISOString()
    });

    // Process queued requests
    processQueue();
  }
};

// Cleanup stale requests periodically
const cleanupStaleData = () => {
  const now = Date.now();
  
  for (const [requestId, req] of pendingRequests.entries()) {
    if (now - req.startTime > CONFIG.REQUEST_TIMEOUT) {
      console.log(`Cleaning up stale request: ${requestId}`);
      pendingRequests.delete(requestId);
    }
  }
  
  const cutoffTime = now - (CONFIG.REQUEST_TIMEOUT * 2);
  const initialLength = requestQueue.length;
  while (requestQueue.length > 0 && requestQueue[0].timestamp < cutoffTime) {
    requestQueue.shift();
  }
  if (requestQueue.length < initialLength) {
    console.log(`Cleaned up ${initialLength - requestQueue.length} stale queued requests`);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupStaleData, 5 * 60 * 1000);

module.exports = {
  upload,
  ensureUploadsDir,
  handleTranscription
};

