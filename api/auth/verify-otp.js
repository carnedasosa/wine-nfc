const { verifyEmailOtp, AuthProviderError } = require('../../lib/supabase-auth');
const { AccountLinkError, linkVerifiedIdentity } = require('../../lib/user-account');
const {
  requireSameOrigin,
  getTrustedClientIp,
  setSessionCookies
} = require('../../lib/http-security');
const { enforceRateLimit } = require('../../lib/rate-limit');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../../lib/api-utils');
const { validateOtpVerifyPayload } = require('../../utils/validation');

module.exports = async function verifyOtpHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!requireSameOrigin(req, res, { force: true })) return undefined;

  let input;
  try {
    input = validateRequestBody(req, validateOtpVerifyPayload);
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  const allowed = await enforceRateLimit(req, res, {
    profile: 'OTP_VERIFY_IP',
    identifier: getTrustedClientIp(req)
  });
  if (!allowed) return undefined;

  try {
    const session = await verifyEmailOtp(input.email, input.token);
    const user = await linkVerifiedIdentity(session.identity, input.nome);
    setSessionCookies(res, session);
    return res.status(200).json({ user });
  } catch (error) {
    if (error instanceof AuthProviderError) {
      if (error.status === 429) {
        res.setHeader('Retry-After', '60');
        return sendJsonError(
          res,
          429,
          'OTP_TEMPORARILY_LIMITED',
          'Troppi tentativi. Attendi prima di riprovare.'
        );
      }
      if (error.status >= 500) {
        console.error(`Verifica OTP non disponibile: ${error.code}`);
        return sendJsonError(
          res,
          503,
          'AUTH_PROVIDER_UNAVAILABLE',
          'Il servizio di autenticazione non è temporaneamente disponibile'
        );
      }
      return sendJsonError(
        res,
        401,
        'INVALID_OTP',
        'Codice non valido o scaduto'
      );
    }

    if (error instanceof AccountLinkError) {
      return sendJsonError(
        res,
        error.status,
        error.code,
        'Non è stato possibile collegare in modo sicuro il profilo'
      );
    }

    if (error && error.code === 'P2022') {
      console.error('Schema M1 non applicato: manca User.authSubject');
      return sendJsonError(
        res,
        503,
        'AUTH_SCHEMA_NOT_READY',
        'Il servizio di autenticazione è in fase di aggiornamento'
      );
    }

    console.error('Errore interno durante la verifica OTP');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
