const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { upload, ensureUploadsDir, handleTranscription } = require('./transcribe');

const app = express();
const PORT = process.env.PORT || 6600;

// CORS configuration
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

// Routes
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.post('/transcribe', upload.single('audio'), handleTranscription);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Route not found',
    availableRoutes: {
      health: 'GET /',
      transcribe: 'POST /transcribe'
    }
  });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
const startServer = async () => {
  try {
    await ensureUploadsDir();
    
    app.listen(PORT, () => {
      console.log(`🚀 Speech-to-Text server running on port ${PORT}`);
      console.log(`📡 Health: http://localhost:${PORT}/health`);
      console.log(`🎤 Upload: http://localhost:${PORT}/transcribe`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
