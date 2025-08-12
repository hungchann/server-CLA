const speech = require('@google-cloud/speech');

// Initialize Google Speech-to-Text client with retry logic
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

// Enhanced transcription function
const transcribeAudio = async (audioFilePath, languageCode, requestId = null) => {
  const operation = async () => {
    try {
      const fs = require('fs').promises;
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
      const { RECOVERY_CONFIG } = require('../../config/constants');
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), RECOVERY_CONFIG.REQUEST_TIMEOUT);
      });

      const transcriptionPromise = speechClient.recognize(request);
      const [response] = await Promise.race([transcriptionPromise, timeoutPromise]);
      
      if (!response.results || response.results.length === 0) {
        return { 
          transcription: '', 
          confidence: 0, 
          words: []
        };
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
          
                  // Collect alternatives
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
      console.error('Speech-to-Text error:', error);
      
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

  const { retryWithBackoff } = require('../recovery/errorHandler');
  return retryWithBackoff(operation);
};

module.exports = {
  speechClient,
  transcribeAudio
};
