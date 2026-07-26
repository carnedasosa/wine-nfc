const prisma = require('../lib/prisma');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError
} = require('../lib/api-utils');
const { assertAllowedKeys, assertPlainObject } = require('../utils/validation');
const { getRequestId, logError, logInfo } = require('../lib/logger');

module.exports = async function winesHandler(req, res) {
  const reqId = getRequestId(req);
  res.setHeader('x-request-id', reqId);
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');

  if (req.method !== 'GET') {
    logError(reqId, 'Metodo non consentito', { method: req.method });
    return methodNotAllowed(res, 'GET');
  }

  try {
    assertPlainObject(req.query || {}, 'query');
    assertAllowedKeys(req.query || {}, []);
  } catch (error) {
    logError(reqId, 'Errore di validazione', error);
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  try {
    const wines = await prisma.wine.findMany({
      orderBy: [{ nome: 'asc' }, { id: 'asc' }]
    });
    logInfo(reqId, 'Catalogo recuperato con successo', { count: wines.length });
    return res.status(200).json(wines);
  } catch (error) {
    logError(reqId, 'Errore interno durante il recupero del catalogo', error);
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
