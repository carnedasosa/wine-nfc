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

function calculateAverage(assaggi, field) {
  if (!Array.isArray(assaggi) || assaggi.length === 0) return 0;
  return Math.round(
    assaggi.reduce((sum, tasting) => sum + Number(tasting[field] || 0), 0)
      / assaggi.length
      * 10
  ) / 10;
}

function getTopEmotions(assaggi, count = 3) {
  if (!Array.isArray(assaggi) || assaggi.length === 0) return [];

  const counts = new Map();
  assaggi.forEach(tasting => {
    const emotion = String(tasting.emozione || '');
    if (emotion) counts.set(emotion, (counts.get(emotion) || 0) + 1);
  });

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, count)
    .map(([emotion]) => emotion);
}

function buildTags(assaggi, avgAcidita, avgCorpo, topEmotions) {
  const tags = [];
  if (avgAcidita >= 4) tags.push('Vini tesi');
  else if (avgAcidita <= 2) tags.push('Vini morbidi');
  if (avgCorpo >= 4) tags.push('Struttura densa');
  else if (avgCorpo <= 2) tags.push('Leggerezza');
  topEmotions.forEach(emotion => tags.push(emotion));

  assaggi.forEach(tasting => {
    const territory = typeof tasting.wine?.territorio === 'string'
      ? tasting.wine.territorio.split(',')[1]?.trim()
      : '';
    if (territory && !tags.includes(territory)) tags.push(territory);
  });
  return tags;
}

function generaDNAFallback(acidita, corpo, topEmo) {
  return 'Nei vini che hai descritto, l’acidità media è ' + acidita + '/5 e il corpo medio è ' + corpo + '/5. Le emozioni più ricorrenti sono ' + topEmo.join(', ') + '. Questo riepilogo descrive gli assaggi registrati, senza dedurre preferenze personali.';
}

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

  // 2. Calculates stats
  const assaggiCount = tastings.length;
  const averages = {
    acidita: calculateAverage(tastings, 'acidita'),
    corpo: calculateAverage(tastings, 'corpo'),
    persistenza: calculateAverage(tastings, 'persistenza')
  };
  const topEmotions = getTopEmotions(tastings, 3);
  const cantine = [...new Set(
    tastings
      .map(tasting => tasting.wine?.cantina)
      .filter(cantina => typeof cantina === 'string' && cantina)
  )];
  const tags = buildTags(tastings, averages.acidita, averages.corpo, topEmotions);

  const ultimiVini = tastings.slice(0, 3).map(tasting => {
    const wine = tasting.wine || {};
    return `${wine.nome || 'Vino'} (${wine.territorio || 'territorio non indicato'})`;
  });

  const stats = {
    assaggiCount,
    averages,
    topEmo: topEmotions,
    cantine,
    tags,
    ultimiVini
  };

  // 3. Compute Hash
  const hashInput = tastings.map(t => `${t.id}-${t.updatedAt.getTime()}`).join('|');
  const versionHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  try {
    const result = await generateDna(prisma, { eventId, userId, versionHash, stats,
      fallbackText: generaDNAFallback(averages.acidita, averages.corpo, topEmotions) });
    return res.status(200).json({ ...result, stats });
  } catch (error) {
    console.warn('DNA cache non disponibile', error.code || error.name);
    return res.status(200).json({ dnaText: generaDNAFallback(averages.acidita, averages.corpo, topEmotions), fallback: true, stats });
  }
});
