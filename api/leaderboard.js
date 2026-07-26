const prisma = require('../lib/prisma');
const { optionalAuthentication } = require('../lib/auth');
const { getTrustedClientIp } = require('../lib/http-security');
const { enforceRateLimit } = require('../lib/rate-limit');
const {
  methodNotAllowed,
  sendJsonError,
  sendValidationError,
  setNoStore
} = require('../lib/api-utils');
const { validatePagination } = require('../utils/validation');
const { getRequestId, logError, logInfo } = require('../lib/logger');

module.exports = async function leaderboardHandler(req, res) {
  const reqId = getRequestId(req);
  res.setHeader('x-request-id', reqId);
  res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=60');

  if (req.method !== 'GET') {
    logError(reqId, 'Metodo non consentito', { method: req.method });
    return methodNotAllowed(res, 'GET');
  }

  const allowed = await enforceRateLimit(req, res, {
    profile: 'LEADERBOARD_IP',
    identifier: getTrustedClientIp(req)
  });
  if (!allowed) {
    logError(reqId, 'Rate limit superato per leaderboard');
    return undefined;
  }

  let pagination;
  try {
    pagination = validatePagination(req.query || {}, {
      defaultLimit: 50,
      maxLimit: 50,
      maxPage: 1000
    });
  } catch (error) {
    logError(reqId, 'Errore di validazione paginazione', error);
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  try {
    const [currentUser, usersWithCounts] = await Promise.all([
      optionalAuthentication(req),
      prisma.user.findMany({
        where: { tastings: { some: {} } },
        select: {
          id: true,
          nome: true,
          _count: { select: { tastings: true } }
        },
        orderBy: [
          { tastings: { _count: 'desc' } },
          { id: 'asc' }
        ],
        skip: pagination.skip,
        take: pagination.limit
      })
    ]);

    const leaderboard = usersWithCounts.map((user, index) => ({
      rank: pagination.skip + index + 1,
      nome: user.nome || 'Utente',
      tastingsCount: user._count.tastings,
      isCurrentUser: Boolean(currentUser && user.id === currentUser.id)
    }));

    logInfo(reqId, 'Classifica recuperata', { length: leaderboard.length });
    return res.status(200).json(leaderboard);
  } catch (error) {
    logError(reqId, 'Errore interno durante il recupero della classifica', error);
    return sendJsonError(res, 500, 'INTERNAL_ERROR', 'Errore interno del server');
  }
};
