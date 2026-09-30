const { maintenance } = require('../lib/availability');
const prisma = require('../lib/prisma');
const { getEvent, assertEventOpen, sendEventError } = require('../lib/event');
const { methodNotAllowed, setNoStore, sendValidationError, sendJsonError } = require('../lib/api-utils');
module.exports = async function wines(req, res) {
  setNoStore(res);
  if (maintenance(res)) return;
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  try {
    const event = await getEvent(prisma, req.query?.eventId);
    const rows = await prisma.eventWine.findMany({ where: { eventId: event.id, attivo: true }, include: { wine: true }, orderBy: [{ ordine: 'asc' }, { wineId: 'asc' }] });
    let open = true;
    try { assertEventOpen(event); } catch { open = false; }
    return res.status(200).json({ event: { id: event.id, nome: event.nome, inizio: event.inizio, fine: event.fine, timezone: event.timezone, open }, wines: rows.map(row => row.wine) });
  } catch (error) {
    if (sendEventError(res, error) || sendValidationError(res, error)) return;
    return sendJsonError(res, 503, 'CATALOG_UNAVAILABLE', 'Catalogo temporaneamente non disponibile');
  }
};
