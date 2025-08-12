const { ErrorTypes, RECOVERY_CONFIG } = require('../../config/constants');

// Error classification function
const classifyError = (error) => {
  if (error.code === 11 || error.code === 14) return ErrorTypes.TRANSIENT;
  if (error.code === 3 || error.code === 9) return ErrorTypes.PERMANENT;
  if (error.code === 8) return ErrorTypes.RATE_LIMIT;
  if (error.code === 13) return ErrorTypes.SYSTEM;
  return ErrorTypes.TRANSIENT; // Default to transient for unknown errors
};

// Exponential backoff retry function
const retryWithBackoff = async (operation, maxRetries = RECOVERY_CONFIG.MAX_RETRIES) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorType = classifyError(error);
      
      if (errorType === ErrorTypes.PERMANENT) {
        throw error; // Don't retry permanent errors
      }
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = Math.min(
        RECOVERY_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1),
        RECOVERY_CONFIG.MAX_BACKOFF
      );
      
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms for error:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

module.exports = {
  classifyError,
  retryWithBackoff
};
