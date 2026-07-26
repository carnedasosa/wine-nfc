const { requestEmailOtp, AuthProviderError } = require('../../lib/supabase-auth');
const { requireSameOrigin, getTrustedClientIp } = require('../../lib/http-security');
const { enforceRateLimit } = require('../../lib/rate-limit');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../../lib/api-utils');
const { validateOtpRequestPayload } = require('../../utils/validation');

function accepted(res) {
  return res.status(202).json({
    code: 'OTP_REQUEST_ACCEPTED',
    message: 'Se l’indirizzo può ricevere il codice, riceverai a breve un’email.'
  });
}

module.exports = async function requestOtpHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!requireSameOrigin(req, res, { force: true })) return undefined;

  let input;
  try {
    input = validateRequestBody(req, validateOtpRequestPayload);
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  const ipAllowed = await enforceRateLimit(req, res, {
    profile: 'OTP_IP',
    identifier: getTrustedClientIp(req)
  });
  if (!ipAllowed) return undefined;

  const emailAllowed = await enforceRateLimit(req, res, {
    profile: 'OTP_EMAIL',
    identifier: input.email
  });
  if (!emailAllowed) return undefined;

  try {
    await requestEmailOtp(input.email);
    return accepted(res);
  } catch (error) {
    if (error instanceof AuthProviderError) {
      if (error.status === 429) {
        res.setHeader('Retry-After', '60');
        return sendJsonError(
          res,
          429,
          'OTP_TEMPORARILY_LIMITED',
          'Attendi prima di richiedere un altro codice'
        );
      }
      if (error.status >= 500) {
        console.error(`Richiesta OTP non disponibile: ${error.code}`);
        return sendJsonError(
          res,
          503,
          'AUTH_PROVIDER_UNAVAILABLE',
          'Il servizio di autenticazione non è temporaneamente disponibile'
        );
      }

      // Non distinguere indirizzi esistenti, non esistenti o rifiutati dal provider.
      return accepted(res);
    }

    console.error('Errore interno durante la richiesta OTP');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
