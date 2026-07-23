const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');

/**
 * Tenta di estrarre userId dal token, ma non blocca se manca.
 * L'endpoint resta pubblico — il token è un "nice to have".
 * @param {import('express').Request} req
 * @returns {string|null}
 */
function tryExtractUserId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.sub || null;
  } catch {
    return null;
  }
}

module.exports = async function(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const currentUserId = tryExtractUserId(req);

    const usersWithCounts = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        _count: {
          select: { tastings: true }
        }
      },
      orderBy: {
        tastings: {
          _count: 'desc'
        }
      },
      take: 50
    });

    // Filtriamo chi ha 0 assaggi e NON esponiamo l'id nella response
    const leaderboard = usersWithCounts
      .filter(u => u._count.tastings > 0)
      .map((u, index) => ({
        rank: index + 1,
        nome: u.nome || 'Utente',
        tastingsCount: u._count.tastings,
        isCurrentUser: currentUserId ? u.id === currentUserId : false
      }));

    return res.status(200).json(leaderboard);
  } catch (error) {
    console.error('Error in GET /api/leaderboard:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
