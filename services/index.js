// Export all services for easy importing
module.exports = {
  // Recovery services
  errorHandler: require('./recovery/errorHandler'),
  sessionManager: require('./recovery/sessionManager'),
  
  // Speech services
  speechClient: require('./speech/speechClient'),
  
  // File services
  fileManager: require('./files/fileManager')
};
