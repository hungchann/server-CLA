// Recovery and resilience configuration
const RECOVERY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // ms
  MAX_BACKOFF: 10000, // ms
  MAX_CONCURRENT_REQUESTS: 10,
  REQUEST_TIMEOUT: 30000 // ms
};

// Error classification
const ErrorTypes = {
  TRANSIENT: 'TRANSIENT',      // Network issues, temporary failures
  PERMANENT: 'PERMANENT',      // Invalid audio, unsupported format
  RATE_LIMIT: 'RATE_LIMIT',    // API quotas, rate limits
  SYSTEM: 'SYSTEM'             // Server errors, configuration issues
};

module.exports = {
  RECOVERY_CONFIG,
  ErrorTypes
};
