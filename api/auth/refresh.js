const { refreshAuthSession, AuthProviderError } = require('../../lib/supabase-auth');
const { findAccountBySubject } = require('../../lib/user-account');
const {
  clearSessionCookies,
  getCookieNames,
  getRequestCookies,
  requireCsrf,
  setSessionCookies
} = require('../../lib/http-security');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../../lib/api-utils');
const { validateEmptyPayload } = require('../../utils/validation');

module.exports = async function refreshHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!requireCsrf(req, res, { force: true })) return undefined;

  try {
    validateRequestBody(req, validateEmptyPayload, { allowEmpty: true });
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  const refreshToken = getRequestCookies(req)[getCookieNames().refresh];
  if (!refreshToken) {
    clearSessionCookies(res);
    return sendJsonError(
      res,
      401,
      'REFRESH_REQUIRED',
      'La sessione non può essere rinnovata'
    );
  }

  try {
    const session = await refreshAuthSession(refreshToken);
    // Persisti subito la coppia ruotata. Supabase applica la propria politica di
    // rotazione, inclusa la breve finestra di riuso configurata sul progetto.
    setSessionCookies(res, session);
    const user = await findAccountBySubject(session.identity.id);
    if (!user) {
      clearSessionCookies(res);
      return sendJsonError(
        res,
        403,
        'ACCOUNT_NOT_LINKED',
        'L’identità verificata non è collegata a un profilo'
      );
    }

    return res.status(200).json({ user });
  } catch (error) {
    if (error instanceof AuthProviderError) {
      if (error.status >= 500 || error.status === 429) {
        if (error.status === 429) res.setHeader('Retry-After', '5');
        return sendJsonError(
          res,
          503,
          'AUTH_PROVIDER_UNAVAILABLE',
          'Il servizio di autenticazione non è temporaneamente disponibile'
        );
      }
      clearSessionCookies(res);
      return sendJsonError(
        res,
        401,
        'INVALID_REFRESH_TOKEN',
        'La sessione è scaduta. Effettua nuovamente l’accesso.'
      );
    }

    if (error && error.code === 'P2022') {
      return sendJsonError(
        res,
        503,
        'AUTH_SCHEMA_NOT_READY',
        'Il servizio di autenticazione è in fase di aggiornamento'
      );
    }

    console.error('Errore interno durante il rinnovo della sessione');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
