const prisma = require('../lib/prisma');

module.exports = async function(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const wines = await prisma.wine.findMany();
    return res.status(200).json(wines);
  } catch (error) {
    console.error('Error in /api/wines:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
