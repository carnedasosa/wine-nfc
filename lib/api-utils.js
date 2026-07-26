const {
  validateJsonBody,
  validationErrorResponse
} = require('../utils/validation');

function setNoStore(res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
}

function methodNotAllowed(res, allowedMethods) {
  const methods = Array.isArray(allowedMethods) ? allowedMethods : [allowedMethods];
  res.setHeader('Allow', methods.join(', '));
  return res.status(405).json({
    code: 'METHOD_NOT_ALLOWED',
    message: 'Metodo non consentito',
    fields: {}
  });
}

function validateRequestBody(req, validator, options = {}) {
  const contentLength = req && req.headers
    ? req.headers['content-length'] || req.headers['Content-Length']
    : undefined;
  const declaredLength = contentLength === undefined || contentLength === ''
    ? 0
    : Number(contentLength);
  if (
    options.allowEmpty &&
    (req.body === undefined || req.body === null) &&
    declaredLength === 0
  ) {
    return validator(req.body);
  }
  validateJsonBody(req.body, contentLength);
  return validator(req.body);
}

function sendValidationError(res, error) {
  return validationErrorResponse(res, error);
}

function sendJsonError(res, statusCode, code, message, fields = {}) {
  return res.status(statusCode).json({ code, message, fields });
}

module.exports = {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
};
