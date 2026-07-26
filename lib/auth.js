const { getVerifiedIdentity, AuthProviderError } = require('./supabase-auth');
const { findAccountBySubject } = require('./user-account');
const {
  SAFE_METHODS,
  getCookieNames,
  getRequestCookies,
  requireCsrf
} = require('./http-security');

class AuthenticationError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function sendAuthError(res, error) {
  if (error instanceof AuthenticationError) {
    return res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
      fields: {}
    });
  }

  if (error instanceof AuthProviderError) {
    const unavailable = error.status >= 500 || error.status === 429;
    return res.status(unavailable ? 503 : error.status || 401).json({
      code: unavailable ? 'AUTH_PROVIDER_UNAVAILABLE' : 'INVALID_SESSION',
      message: unavailable
        ? 'Il servizio di autenticazione non è temporaneamente disponibile'
        : 'Sessione assente, scaduta o non valida',
      fields: {}
    });
  }

  return null;
}

async function authenticateRequest(req, dependencies = {}) {
  const verifyIdentity = dependencies.getVerifiedIdentity || getVerifiedIdentity;
  const findAccount = dependencies.findAccountBySubject || findAccountBySubject;
  const accessToken = getRequestCookies(req)[getCookieNames().access];
  if (!accessToken) {
    throw new AuthenticationError(
      'SESSION_REQUIRED',
      'È necessario effettuare l’accesso'
    );
  }

  const identity = await verifyIdentity(accessToken);
  const user = await findAccount(identity.id);
  if (!user) {
    throw new AuthenticationError(
      'ACCOUNT_NOT_LINKED',
      'L’identità verificata non è collegata a un profilo',
      403
    );
  }

  req.userId = user.id;
  req.authSubject = identity.id;
  req.authUser = user;
  return user;
}

async function optionalAuthentication(req, dependencies = {}) {
  const verifyIdentity = dependencies.getVerifiedIdentity || getVerifiedIdentity;
  const findAccount = dependencies.findAccountBySubject || findAccountBySubject;
  const accessToken = getRequestCookies(req)[getCookieNames().access];
  if (!accessToken) return null;

  try {
    const identity = await verifyIdentity(accessToken);
    const user = await findAccount(identity.id);
    if (!user) return null;
    req.userId = user.id;
    req.authSubject = identity.id;
    req.authUser = user;
    return user;
  } catch {
    return null;
  }
}

function withAuth(handler, dependencies = {}) {
  return async function protectedHandler(req, res) {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    const method = String(req.method || 'GET').toUpperCase();
    if (!SAFE_METHODS.has(method) && !requireCsrf(req, res)) return undefined;

    try {
      await authenticateRequest(req, dependencies);
      return await handler(req, res);
    } catch (error) {
      const response = sendAuthError(res, error);
      if (response) return response;
      console.error('Errore interno durante l’autenticazione');
      return res.status(500).json({
        code: 'INTERNAL_ERROR',
        message: 'Errore interno del server',
        fields: {}
      });
    }
  };
}

module.exports = {
  AuthenticationError,
  authenticateRequest,
  optionalAuthentication,
  sendAuthError,
  withAuth
};
