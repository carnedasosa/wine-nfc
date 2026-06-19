const prisma = require('../lib/prisma');

module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, wineId, acidita, corpo, persistenza, emozione } = req.body;

    if (!userId || !wineId) {
      return res.status(400).json({ error: 'userId e wineId sono obbligatori' });
    }

    const tasting = await prisma.tasting.create({
      data: {
        userId: userId,
        wineId: wineId,
        acidita: acidita !== undefined && acidita !== null ? Number(acidita) : undefined,
        corpo: corpo !== undefined && corpo !== null ? Number(corpo) : undefined,
        persistenza: persistenza !== undefined && persistenza !== null ? Number(persistenza) : undefined,
        emozione: emozione
      }
    });

    return res.status(201).json(tasting);
  } catch (error) {
    console.error('Error in /api/tastings:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
