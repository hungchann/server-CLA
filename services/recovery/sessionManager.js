const { RECOVERY_CONFIG } = require('../../config/constants');

// File processing request management
const pendingRequests = new Map();
const requestQueue = [];

// Cleanup stale requests
const cleanupStaleData = () => {
  const now = Date.now();
  
  // Clean up stale pending requests
  for (const [requestId, req] of pendingRequests.entries()) {
    if (now - req.startTime > RECOVERY_CONFIG.REQUEST_TIMEOUT) {
      console.log(`Cleaning up stale request: ${requestId}`);
      pendingRequests.delete(requestId);
    }
  }
  
  // Clean up old queued requests
  const cutoffTime = now - (RECOVERY_CONFIG.REQUEST_TIMEOUT * 2);
  const initialLength = requestQueue.length;
  requestQueue = requestQueue.filter(req => req.timestamp > cutoffTime);
  if (requestQueue.length < initialLength) {
    console.log(`Cleaned up ${initialLength - requestQueue.length} stale queued requests`);
  }
};

// Process queued requests
const processQueue = () => {
  if (requestQueue.length === 0 || pendingRequests.size >= RECOVERY_CONFIG.MAX_CONCURRENT_REQUESTS) {
    return;
  }

  const queuedRequest = requestQueue.shift();
  if (queuedRequest) {
    console.log(`Processing queued request ${queuedRequest.requestId}`);
    // Re-process the queued request
    setTimeout(() => {
      queuedRequest.app._router.handle(queuedRequest.req, queuedRequest.res, () => {});
    }, 100);
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupStaleData, 5 * 60 * 1000);

module.exports = {
  pendingRequests,
  requestQueue,
  cleanupStaleData,
  processQueue
};
