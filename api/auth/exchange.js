const { getVerifiedIdentity, AuthProviderError } = require('../../lib/supabase-auth');
const { linkVerifiedIdentity, AccountLinkError } = require('../../lib/user-account');
const { requireSameOrigin, setSessionCookies } = require('../../lib/http-security');
const {
  methodNotAllowed,
  sendJsonError,
  setNoStore
} = require('../../lib/api-utils');

/**
 * POST /api/auth/exchange
 *
 * Scambia una coppia (accessToken, refreshToken) emessa da Supabase — tipicamente
 * proveniente da un Magic Link — con una sessione sicura basata su cookie HttpOnly.
 *
 * Sicurezza:
 * - Solo POST (nessun token in query string o GET)
 * - requireSameOrigin { force: true }: blocca richieste cross-origin
 * - Il CSRF non può essere richiesto qui: i cookie di sessione (e il cookie CSRF)
 *   non esistono ancora prima di questo scambio. È questo endpoint a crearli.
 * - Il token viene validato server-side tramite Supabase prima di essere accettato.
 */
module.exports = async function exchangeHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!requireSameOrigin(req, res, { force: true })) return undefined;

  const body = req.body;
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken.trim() : '';
  const refreshToken = typeof body?.refreshToken === 'string' ? body.refreshToken.trim() : '';

  if (!accessToken || !refreshToken) {
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Token mancanti o non validi');
  }

  let identity;
  try {
    identity = await getVerifiedIdentity(accessToken);
  } catch (error) {
    if (error instanceof AuthProviderError) {
      if (error.status >= 500) {
        console.error(`Exchange token non disponibile: ${error.code}`);
        return sendJsonError(
          res,
          503,
          'AUTH_PROVIDER_UNAVAILABLE',
          'Il servizio di autenticazione non è temporaneamente disponibile'
        );
      }
      return sendJsonError(res, 401, 'INVALID_TOKEN', 'Token non valido o scaduto');
    }
    console.error('Errore interno durante la verifica del token');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }

  // Il Magic Link non trasmette il nome scelto dall'utente. Usiamo la parte
  // locale dell'email come nome di fallback, che l'utente potrà aggiornare
  // in seguito nelle impostazioni.
  const fallbackName = identity.email.split('@')[0].slice(0, 60) || 'Utente';

  let user;
  try {
    user = await linkVerifiedIdentity(identity, fallbackName);
  } catch (error) {
    if (error instanceof AccountLinkError) {
      return sendJsonError(
        res,
        error.status,
        error.code,
        'Non è stato possibile collegare in modo sicuro il profilo'
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
    console.error('Errore interno durante il collegamento del profilo');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }

  // expiresIn non è disponibile dal Magic Link: usiamo il valore massimo
  // consentito da setSessionCookies (3600 s = 1 ora), coerente con il resto.
  const session = {
    accessToken,
    refreshToken,
    expiresIn: 3600
  };

  setSessionCookies(res, session);
  return res.status(200).json({ user });
};
