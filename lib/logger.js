const crypto = require('crypto');

function generateRequestId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString('hex');
}

function getRequestId(req) {
  const supplied = req.headers?.['x-request-id'];
  return typeof supplied === 'string' && /^[a-f0-9-]{36}$/i.test(supplied) ? supplied : generateRequestId();
}

// Allowlist: i dati di dominio, body, cookie e messaggi dei provider non sono loggabili.
function safeData(data) {
  return Object.fromEntries(['count', 'status', 'durationMs'].filter(key => Number.isFinite(data[key]))
    .map(key => [key, data[key]]));
}

function errorCategory(error) {
  const code = error?.code;
  if (typeof code === 'string' && /^(P\d{4}|[A-Z][A-Z0-9_]{2,63})$/.test(code)) return code;
  return ['TypeError', 'RangeError', 'SyntaxError', 'AbortError'].includes(error?.name) ? error.name : 'INTERNAL_ERROR';
}

function logInfo(requestId, message, data = {}) {
  console.log(JSON.stringify({
    level: 'INFO',
    requestId,
    message,
    timestamp: new Date().toISOString(),
    ...safeData(data)
  }));
}

function logError(requestId, message, error = {}, data = {}) {
  console.error(JSON.stringify({
    level: 'ERROR',
    requestId,
    message,
    error: errorCategory(error),
    timestamp: new Date().toISOString(),
    ...safeData(data)
  }));
}

module.exports = {
  generateRequestId,
  getRequestId,
  logInfo,
  logError
};
