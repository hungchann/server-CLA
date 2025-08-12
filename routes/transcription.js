const express = require('express');
const router = express.Router();
const path = require('path');
const { upload, convertAudioToWAV, cleanupFiles } = require('../services/files/fileManager');
const { transcribeAudio } = require('../services/speech/speechClient');
const { retryWithBackoff } = require('../services/recovery/errorHandler');
const { classifyError } = require('../services/recovery/errorHandler');
const { pendingRequests, requestQueue, processQueue } = require('../services/recovery/sessionManager');
const { RECOVERY_CONFIG } = require('../config/constants');

// Enhanced main endpoint for audio transcription with recovery
router.post('/', upload.single('audio'), async (req, res) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let tempFiles = [];
  
  try {
    // Check if we're at capacity
    if (pendingRequests.size >= RECOVERY_CONFIG.MAX_CONCURRENT_REQUESTS) {
      // Add to queue instead of rejecting
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

    // Try language codes with enhanced fallback strategy
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
        
        // If it's a permanent error, don't try other languages
        if (errorType === 'PERMANENT') {
          break;
        }
      }
    }

    // Clean up temporary files
    await cleanupFiles(tempFiles);

    // Remove from pending requests
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
});



module.exports = router;
