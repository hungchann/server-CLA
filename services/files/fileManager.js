const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs').promises;
const path = require('path');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegStatic);

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Check if file has required properties
    if (!file || !file.originalname) {
      return cb(new Error('Invalid file data'), false);
    }
    
    // Check mimetype and file extension
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
      cb(new Error(`Only audio files are allowed! Supported formats: ${validExtensions.join(', ')}`), false);
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
      console.error(`Error deleting file ${filePath}:`, error);
    }
  }
};

module.exports = {
  upload,
  ensureUploadsDir,
  convertAudioToWAV,
  cleanupFiles
};
