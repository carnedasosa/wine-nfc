const { validateUuid } = require('../utils/validation');
const { isProduction } = require('./http-security');

class EventError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function resolveEventId(value, env = process.env) {
  const configured = env.ACTIVE_EVENT_ID;
  const id = value || configured || (!isProduction(env) ? 'legacy-event-id' : '');
  if (!id) throw new EventError('EVENT_NOT_CONFIGURED', 'Evento non ancora disponibile', 503);
  const validated = validateUuid(id, 'eventId');
  if (configured && validated !== configured.toLowerCase()) {
    throw new EventError('EVENT_NOT_AVAILABLE', 'Questo link appartiene a un altro evento', 404);
  }
  if (isProduction(env) && validated === 'legacy-event-id') {
    throw new EventError('EVENT_NOT_CONFIGURED', 'Evento non ancora disponibile', 503);
  }
  return validated;
}

function assertEventOpen(event, now = new Date()) {
  if (!event) throw new EventError('EVENT_NOT_FOUND', 'Evento non trovato', 404);
  if (event.stato !== 'active' || now < event.inizio || now >= event.fine) {
    throw new EventError('EVENT_CLOSED', 'Le degustazioni per questo evento non sono aperte', 409);
  }
}

async function getEvent(db, value) {
  const id = resolveEventId(value);
  const event = await db.event.findUnique({ where: { id } });
  if (!event || !['active', 'closed'].includes(event.stato)) {
    throw new EventError('EVENT_NOT_FOUND', 'Evento non disponibile', 404);
  }
  return event;
}

function sendEventError(res, error) {
  if (!(error instanceof EventError)) return false;
  res.status(error.status).json({ code: error.code, message: error.message, fields: {} });
  return true;
}

module.exports = { EventError, resolveEventId, assertEventOpen, getEvent, sendEventError };
