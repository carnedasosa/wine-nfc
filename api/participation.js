const prisma = require('../lib/prisma');
const { withAuth } = require('../lib/auth');
const { getEvent, sendEventError } = require('../lib/event');
const { methodNotAllowed, setNoStore, validateRequestBody, sendValidationError, sendJsonError } = require('../lib/api-utils');
const { assertAllowedKeys, validateName, validateUuid, ValidationError } = require('../utils/validation');

module.exports = withAuth(async function participation(req, res) {
  setNoStore(res);
  if (!['GET', 'PUT'].includes(req.method)) return methodNotAllowed(res, ['GET', 'PUT']);
  try {
    let input;
    if (req.method === 'PUT') input = validateRequestBody(req, body => {
      assertAllowedKeys(body, ['eventId', 'nickname', 'consensoLeaderboard']);
      if (typeof body.consensoLeaderboard !== 'boolean') throw new ValidationError({ consensoLeaderboard: 'Scegli se partecipare' });
      return { eventId: validateUuid(body.eventId, 'eventId'), consensoLeaderboard: body.consensoLeaderboard,
        nickname: body.consensoLeaderboard ? validateName(body.nickname, 'nickname') : null };
    });
    const event = await getEvent(prisma, input?.eventId || req.query?.eventId);
    const where = { eventId_userId: { eventId: event.id, userId: req.userId } };
    const select = { nickname: true, consensoLeaderboard: true };
    const record = req.method === 'GET'
      ? await prisma.eventParticipant.findUnique({ where, select })
      : await prisma.eventParticipant.upsert({ where, select,
        create: { ...input, userId: req.userId },
        update: { nickname: input.nickname, consensoLeaderboard: input.consensoLeaderboard } });
    return res.status(200).json(record || { nickname: '', consensoLeaderboard: false });
  } catch (error) {
    if (sendEventError(res, error) || sendValidationError(res, error)) return;
    return sendJsonError(res, 503, 'PARTICIPATION_UNAVAILABLE', 'Partecipazione temporaneamente non disponibile');
  }
});
