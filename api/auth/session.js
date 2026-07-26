const { authenticateRequest, sendAuthError } = require('../../lib/auth');
const {
  methodNotAllowed,
  sendJsonError,
  setNoStore
} = require('../../lib/api-utils');

module.exports = async function sessionHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');

  try {
    const user = await authenticateRequest(req);
    return res.status(200).json({ user });
  } catch (error) {
    const response = sendAuthError(res, error);
    if (response) return response;
    if (error && error.code === 'P2022') {
      return sendJsonError(
        res,
        503,
        'AUTH_SCHEMA_NOT_READY',
        'Il servizio di autenticazione è in fase di aggiornamento'
      );
    }
    console.error('Errore interno durante il recupero della sessione');
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
