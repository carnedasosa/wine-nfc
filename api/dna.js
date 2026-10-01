const crypto = require('node:crypto');
const { generateDna } = require('../lib/dna-generation');
const { getEvent, sendEventError } = require('../lib/event');
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
const { validateDnaPayload } = require('../utils/validation');

module.exports = withAuth(async function dnaHandler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');

  const allowed = await enforceRateLimit(req, res, {
    profile: 'DNA_USER',
    identifier: req.authSubject
  });
  if (!allowed) return undefined;

  let input;
  try {
    input = validateRequestBody(req, validateDnaPayload);
  } catch (error) {
    if (sendValidationError(res, error)) return undefined;
    return sendJsonError(res, 400, 'INVALID_REQUEST', 'Richiesta non valida');
  }

  let eventId;
  try { eventId = (await getEvent(prisma, input.eventId)).id; }
  catch (error) { if (sendEventError(res, error) || sendValidationError(res, error)) return; throw error; }
  const userId = req.userId;

  // 1. Fetches tastings
  const tastings = await prisma.tasting.findMany({
    where: { userId, eventId },
    include: { wine: true },
    orderBy: { createdAt: 'desc' }
  });

  if (tastings.length === 0) {
    return res.status(200).json({
      dnaText: 'Nessun assaggio trovato.',
      fallback: true,
      stats: null
    });
  }

  const { buildSensoryStats, describeSensoryStats, SENSORY_VERSION } = await import('../src/domain/sensory.mjs');
  const stats = buildSensoryStats(tastings);
  const fallbackText = describeSensoryStats(stats);

  // 3. Compute Hash
  const hashInput = tastings.map(t => `${t.id}-${t.updatedAt.getTime()}`).join('|');
  const versionHash = crypto.createHash('sha256').update(SENSORY_VERSION + '|' + hashInput).digest('hex');

  try {
    const result = await generateDna(prisma, { eventId, userId, versionHash, stats,
      fallbackText });
    return res.status(200).json({ ...result, stats });
  } catch (error) {
    console.warn('DNA cache non disponibile', error.code || error.name);
    return res.status(200).json({ dnaText: fallbackText, fallback: true, stats });
  }
});
