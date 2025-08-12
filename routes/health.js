const express = require('express');
const router = express.Router();
const { pendingRequests, requestQueue } = require('../services/recovery/sessionManager');
const { RECOVERY_CONFIG } = require('../config/constants');

// Enhanced health check endpoint with recovery status
router.get('/health', (req, res) => {
  const healthStatus = {
    status: 'OK',
    message: 'Speech-to-Text server is running',
    timestamp: new Date().toISOString(),
    recovery: {
      pendingRequests: pendingRequests.size,
      queuedRequests: requestQueue.length,
      maxConcurrentRequests: RECOVERY_CONFIG.MAX_CONCURRENT_REQUESTS
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    config: {
      maxRetries: RECOVERY_CONFIG.MAX_RETRIES,
      retryDelay: RECOVERY_CONFIG.RETRY_DELAY,
      maxBackoff: RECOVERY_CONFIG.MAX_BACKOFF
    }
  };

  // Check if server is healthy
  const isHealthy = healthStatus.recovery.pendingRequests < RECOVERY_CONFIG.MAX_CONCURRENT_REQUESTS;
  
  res.status(isHealthy ? 200 : 503).json(healthStatus);
});

// Recovery status endpoint
router.get('/recovery/status', (req, res) => {
  const recoveryStatus = {
    pendingRequests: Array.from(pendingRequests.entries()).map(([id, req]) => ({
      requestId: id,
      startTime: req.startTime,
      duration: Date.now() - req.startTime
    })),
    queuedRequests: requestQueue.map(req => ({
      requestId: req.requestId,
      timestamp: req.timestamp,
      waitTime: Date.now() - req.timestamp
    }))
  };

  res.json(recoveryStatus);
});

module.exports = router;
