const prisma = require('../lib/prisma');
const { methodNotAllowed, setNoStore } = require('../lib/api-utils');
const { getEvent } = require('../lib/event');
module.exports = async function health(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  try {
    if (process.env.MAINTENANCE_MODE === 'true') throw new Error('Maintenance');
    await getEvent(prisma);
    await prisma.tastingRequest.findFirst({ select: { idempotencyKey: true } });
    await prisma.dnaProfile.findFirst({ select: { generationToken: true, leaseUntil: true } });
    return res.status(200).json({ ready: true });
  } catch { return res.status(503).json({ ready: false }); }
};
