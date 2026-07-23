const prisma = require('../lib/prisma');
const { withAuth } = require('../lib/auth');

function isValidRating(val) {
  if (val === undefined || val === null) return false;
  const num = Number(val);
  return Number.isInteger(num) && num >= 1 && num <= 5;
}

/**
 * Handler per GET e POST /api/tastings.
 *
 * Il userId NON viene più accettato dal client (query string o body):
 * viene letto esclusivamente da req.userId, iniettato dal middleware JWT.
 * Questo elimina l'IDOR (Insecure Direct Object Reference) precedente.
 */
module.exports = withAuth(async function(req, res) {
  // ── GET /api/tastings ─────────────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      // req.userId è garantito dal middleware auth — nessuna validazione extra necessaria
      const tastings = await prisma.tasting.findMany({
        where: { userId: req.userId },
        include: { wine: true },
        orderBy: { createdAt: 'desc' }
      });

      return res.status(200).json(tastings);
    } catch (error) {
      console.error('Error in GET /api/tastings:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── POST /api/tastings ────────────────────────────────────────────────
  try {
    const { wineId, acidita, corpo, persistenza, emozione } = req.body;

    if (!wineId || typeof wineId !== 'string' || !wineId.trim()) {
      return res.status(400).json({ error: 'wineId valido è obbligatorio' });
    }
    if (!isValidRating(acidita) || !isValidRating(corpo) || !isValidRating(persistenza)) {
      return res.status(400).json({ error: 'acidita, corpo e persistenza devono essere interi tra 1 e 5' });
    }
    if (!emozione || typeof emozione !== 'string' || !emozione.trim()) {
      return res.status(400).json({ error: 'emozione valida è obbligatoria' });
    }

    const tasting = await prisma.tasting.create({
      data: {
        userId: req.userId,   // ← da token JWT, non dal body
        wineId: wineId.trim(),
        acidita: Number(acidita),
        corpo: Number(corpo),
        persistenza: Number(persistenza),
        emozione: emozione.trim()
      }
    });

    return res.status(201).json(tasting);
  } catch (error) {
    console.error('Error in /api/tastings:', error);
    // Errore Prisma: Foreign key constraint failed
    if (error.code === 'P2003') {
      return res.status(400).json({ error: 'Utente o vino non esistente' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});
