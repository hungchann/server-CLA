const express = require('express');
require('dotenv').config();

// Import services and components
const { setupMiddleware } = require('./middleware');
const { ensureUploadsDir } = require('./services/files/fileManager');

// Import routes
const transcriptionRoutes = require('./routes/transcription');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 6600;

// Setup middleware
setupMiddleware(app);

// Setup routes
app.use('/transcribe', transcriptionRoutes);
app.use('/', healthRoutes);

// Start server
const startServer = async () => {
  await ensureUploadsDir();
  
  app.listen(PORT, () => {
    console.log(`🚀 Speech-to-Text server running on port ${PORT}`);
    console.log(`📡 Health: http://localhost:${PORT}/health`);
    console.log(`🎤 Upload: http://localhost:${PORT}/transcribe`);
  });
};

startServer().catch(console.error);
