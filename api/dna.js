const crypto = require('node:crypto');
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
  let fallback = 'Un profilo equilibrato che mostra una chiara evoluzione. ';
  if (acidita >= 4) {
    fallback += 'La spiccata propensione per l’acidità rivela un palato che cerca freschezza e tensione, tipiche dei grandi vini verticali. ';
  } else if (acidita <= 2) {
    fallback += 'La preferenza per acidità contenute suggerisce un amore per le morbidezze e i vini avvolgenti. ';
  }

  if (corpo >= 4) {
    fallback += 'L’attrazione verso strutture imponenti denota una ricerca di calore, potenza e longevità nel calice. ';
  } else if (corpo <= 2) {
    fallback += 'La predilezione per corpi snelli indica una ricerca di bevibilità, eleganza e agilità. ';
  }

  if (topEmo && topEmo.length > 0) {
    fallback += `Le sensazioni ricorrenti di ${topEmo.join(', ')} confermano un approccio emotivo e viscerale alla degustazione.`;
  }
  return fallback;
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

  const { eventId } = input;
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

  const viniPreferiti = tastings.slice(0, 3).map(tasting => {
    const wine = tasting.wine || {};
    return `${wine.nome || 'Vino'} (${wine.territorio || 'territorio non indicato'})`;
  });

  const stats = {
    assaggiCount,
    averages,
    topEmo: topEmotions,
    cantine,
    tags,
    viniPreferiti
  };

  // 3. Compute Hash
  const hashInput = tastings.map(t => `${t.id}-${t.updatedAt.getTime()}`).join('|');
  const versionHash = crypto.createHash('sha256').update(hashInput).digest('hex');

  // 4. Check cache
  const cached = await prisma.dnaProfile.findUnique({
    where: {
      eventId_userId_versionHash: { eventId, userId, versionHash }
    }
  });

  if (cached) {
    return res.status(200).json({
      dnaText: cached.testo,
      fallback: cached.fallback,
      stats
    });
  }

  // 5. Build prompt and call Anthropic
  const AI_ENABLED = process.env.AI_ENABLED !== 'false';
  let dnaText = generaDNAFallback(averages.acidita, averages.corpo, topEmotions);
  let isFallback = true;

  if (AI_ENABLED && process.env.GEMINI_API_KEY) {
    const utenteNome = req.authUser.nome;
    const nomeInserito = utenteNome ? ` di ${utenteNome}` : '';
    const prompt = `Sei un sommelier poetico. Analizza questo profilo di degustazione e scrivi un paragrafo breve (3-4 frasi) in italiano, stile letterario, che descrive la personalità enologica di questa persona. Sii specifico, evocativo, usa metafore legate al territorio italiano.

Dati: ${assaggiCount} vini assaggiati${nomeInserito}, acidità media ${averages.acidita}/5, corpo medio ${averages.corpo}/5, persistenza media ${averages.persistenza}/5.
Emozioni prevalenti: ${topEmotions.join(', ')}.
Vini preferiti: ${viniPreferiti.join(', ')}.

Rispondi SOLO con il paragrafo, nessun titolo o introduzione.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 300 }
        }),
        signal: controller.signal
      });

      if (response.ok) {
        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiText) {
          dnaText = aiText;
          isFallback = false;
        }
      } else {
        console.warn(`Gemini fallito con status ${response.status}`);
      }
    } catch (error) {
      console.warn('Gemini timeout o errore di rete:', error.name);
    } finally {
      clearTimeout(timeout);
    }
  }

  // 6. Save to cache (fire and forget)
  prisma.dnaProfile.create({
    data: {
      eventId,
      userId,
      versionHash,
      testo: dnaText,
      fallback: isFallback
    }
  }).catch(e => console.warn('Impossibile salvare in cache DnaProfile:', e));

  return res.status(200).json({ dnaText, fallback: isFallback, stats });
});
