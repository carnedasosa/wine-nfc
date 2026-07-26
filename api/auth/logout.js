const {
  AuthProviderError,
  refreshAuthSession,
  revokeAuthSession
} = require('../../lib/supabase-auth');
const {
  clearSessionCookies,
  getCookieNames,
  getRequestCookies,
  requireCsrf
} = require('../../lib/http-security');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../../lib/api-utils');
const { validateEmptyPayload } = require('../../utils/validation');

module.exports = async function logoutHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!requireCsrf(req, res, { force: true })) return undefined;

  try {
    validateRequestBody(req, validateEmptyPayload, { allowEmpty: true });
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  const cookies = getRequestCookies(req);
  const cookieNames = getCookieNames();
  try {
    if (cookies[cookieNames.access]) {
      try {
        await revokeAuthSession(cookies[cookieNames.access]);
      } catch (error) {
        if (
          error instanceof AuthProviderError &&
          error.status < 500 &&
          cookies[cookieNames.refresh]
        ) {
          const renewed = await refreshAuthSession(cookies[cookieNames.refresh]);
          await revokeAuthSession(renewed.accessToken);
        } else {
          throw error;
        }
      }
    } else if (cookies[cookieNames.refresh]) {
      const renewed = await refreshAuthSession(cookies[cookieNames.refresh]);
      await revokeAuthSession(renewed.accessToken);
    }
  } catch (error) {
    // Il logout locale deve riuscire anche se Supabase non è raggiungibile.
    if (error instanceof AuthProviderError && error.status >= 500) {
      console.warn(`Revoca sessione differita dal provider: ${error.code}`);
    }
  } finally {
    clearSessionCookies(res);
  }

  return res.status(204).end();
};
