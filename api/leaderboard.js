const prisma = require('../lib/prisma');
const { withAuth } = require('../lib/auth');
const { getEvent, sendEventError } = require('../lib/event');
const { enforceRateLimit } = require('../lib/rate-limit');
const { methodNotAllowed, setNoStore, sendValidationError, sendJsonError } = require('../lib/api-utils');
const { validatePagination, assertAllowedKeys } = require('../utils/validation');
module.exports = withAuth(async function leaderboard(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  if (!await enforceRateLimit(req, res, { profile: 'LEADERBOARD_IP', identifier: req.authSubject })) return;
  try {
    const query = req.query || {};
    assertAllowedKeys(query, ['eventId', 'page', 'limit']);
    const { page, limit, skip } = validatePagination({ page: query.page, limit: query.limit });
    const event = await getEvent(prisma, query.eventId);
    const ranked = await prisma.tasting.groupBy({ by: ['userId'],
      where: { eventId: event.id, user: { events: { some: { eventId: event.id, consensoLeaderboard: true, nickname: { not: null } } } } },
      _count: { wineId: true }, orderBy: [{ _count: { wineId: 'desc' } }, { userId: 'asc' }], skip, take: limit });
    const participants = await prisma.eventParticipant.findMany({ where: { eventId: event.id, userId: { in: ranked.map(row => row.userId) }, consensoLeaderboard: true }, select: { userId: true, nickname: true } });
    const names = new Map(participants.map(row => [row.userId, row.nickname]));
    return res.status(200).json(ranked.filter(row => names.has(row.userId)).map((row, index) => ({
      rank: (page - 1) * limit + index + 1, nome: names.get(row.userId), tastingsCount: row._count.wineId, isCurrentUser: row.userId === req.userId
    })));
  } catch (error) {
    if (sendEventError(res, error) || sendValidationError(res, error)) return;
    return sendJsonError(res, 503, 'LEADERBOARD_UNAVAILABLE', 'Classifica temporaneamente non disponibile');
  }
});
