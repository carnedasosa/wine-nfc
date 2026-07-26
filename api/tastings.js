const prisma = require('../lib/prisma');
const { withAuth } = require('../lib/auth');
const { enforceRateLimit } = require('../lib/rate-limit');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore,
  validateRequestBody
} = require('../lib/api-utils');
const { validateTastingPayload } = require('../utils/validation');
const { getRequestId, logError, logInfo } = require('../lib/logger');

module.exports = withAuth(async function tastingsHandler(req, res) {
  const reqId = getRequestId(req);
  res.setHeader('x-request-id', reqId);
  setNoStore(res);

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const eventId = req.query?.eventId || url.searchParams.get('eventId');
      if (!eventId) {
        logError(reqId, 'Parametro eventId mancante');
        return sendJsonError(res, 400, 'MISSING_EVENT_ID', 'Parametro eventId mancante');
      }

      const tastings = await prisma.tasting.findMany({
        where: { userId: req.userId, eventId },
        include: { wine: true },
        orderBy: { createdAt: 'desc' }
      });
      logInfo(reqId, 'Assaggi recuperati', { count: tastings.length });
      return res.status(200).json(tastings);
    } catch (error) {
      logError(reqId, 'Errore interno durante il recupero degli assaggi', error);
      return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
    }
  }

  if (req.method !== 'POST') {
    logError(reqId, 'Metodo non consentito', { method: req.method });
    return methodNotAllowed(res, ['GET', 'POST']);
  }

  const allowed = await enforceRateLimit(req, res, {
    profile: 'TASTING_USER',
    identifier: req.authSubject
  });
  if (!allowed) {
    logError(reqId, 'Rate limit superato per salvataggio assaggio');
    return undefined;
  }

  let input;
  try {
    input = validateRequestBody(req, validateTastingPayload);
  } catch (error) {
    logError(reqId, 'Errore validazione payload assaggio', error);
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  try {
    const tasting = await prisma.tasting.upsert({
      where: {
        eventId_userId_wineId: {
          eventId: input.eventId,
          userId: req.userId,
          wineId: input.wineId
        }
      },
      create: {
        eventId: input.eventId,
        userId: req.userId,
        wineId: input.wineId,
        acidita: input.acidita,
        corpo: input.corpo,
        persistenza: input.persistenza,
        emozione: input.emozione,
        idempotencyKey: input.idempotencyKey
      },
      update: {
        acidita: input.acidita,
        corpo: input.corpo,
        persistenza: input.persistenza,
        emozione: input.emozione,
        idempotencyKey: input.idempotencyKey,
        version: { increment: 1 }
      }
    });
    logInfo(reqId, 'Assaggio salvato', { tastingId: tasting.id });
    return res.status(201).json(tasting);
  } catch (error) {
    if (error && error.code === 'P2003') {
      logError(reqId, 'Il vino indicato non esiste', error);
      return sendJsonError(res, 400, 'WINE_NOT_FOUND', 'Il vino indicato non esiste');
    }
    logError(reqId, 'Errore interno durante il salvataggio dell’assaggio', error);
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
});
