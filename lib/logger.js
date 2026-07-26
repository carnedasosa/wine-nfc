const crypto = require('crypto');

function generateRequestId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function getRequestId(req) {
  return req.headers['x-request-id'] || generateRequestId();
}

function logInfo(requestId, message, data = {}) {
  console.log(JSON.stringify({
    level: 'INFO',
    requestId,
    message,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

function logError(requestId, message, error = {}, data = {}) {
  console.error(JSON.stringify({
    level: 'ERROR',
    requestId,
    message,
    error: error.message || error,
    timestamp: new Date().toISOString(),
    ...data
  }));
}

module.exports = {
  generateRequestId,
  getRequestId,
  logInfo,
  logError
};
