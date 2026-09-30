const crypto = require('node:crypto');
const { EventError, assertEventOpen } = require('./event');

class TastingConflict extends Error {
  constructor(code, message) { super(message); this.code = code; this.status = 409; }
}

// Un registro permanente della richiesta impedisce che un retry vecchio riscriva un voto nuovo.
async function saveTasting(db, userId, input) {
  const { idempotencyKey, ...content } = input;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await db.$transaction(async tx => {
        const previous = await tx.tastingRequest.findUnique({ where: { idempotencyKey } });
        if (previous) {
          if (previous.userId !== userId || previous.requestHash !== requestHash) {
            throw new TastingConflict('IDEMPOTENCY_CONFLICT', 'Questa richiesta è già stata utilizzata. Ricarica gli assaggi.');
          }
          return { tasting: previous.response, replayed: true };
        }
        const event = await tx.event.findUnique({ where: { id: input.eventId } });
        assertEventOpen(event);
        const association = await tx.eventWine.findUnique({
          where: { eventId_wineId: { eventId: input.eventId, wineId: input.wineId } }
        });
        if (!association?.attivo) throw new EventError('WINE_NOT_AVAILABLE', 'Questo vino non è disponibile per l’evento', 404);

        const where = { eventId_userId_wineId: { eventId: input.eventId, userId, wineId: input.wineId } };
        const current = await tx.tasting.findUnique({ where });
        if ((current?.version || 0) !== input.baseVersion) {
          throw new TastingConflict('TASTING_VERSION_CONFLICT', 'Il voto è stato aggiornato altrove. Ricarica gli assaggi prima di modificarlo.');
        }
        const values = { acidita: input.acidita, corpo: input.corpo,
          persistenza: input.persistenza, emozione: input.emozione, idempotencyKey };
        const tasting = current
          ? await tx.tasting.update({ where: { id: current.id }, data: { ...values, version: { increment: 1 } } })
          : await tx.tasting.create({ data: { ...values, userId, eventId: input.eventId, wineId: input.wineId } });
        await tx.eventParticipant.upsert({
          where: { eventId_userId: { eventId: input.eventId, userId } },
          create: { eventId: input.eventId, userId }, update: {}
        });
        const response = JSON.parse(JSON.stringify(tasting));
        await tx.tastingRequest.create({ data: { idempotencyKey, userId, eventId: input.eventId, requestHash, response } });
        return { tasting: response, replayed: false };
      }, { isolationLevel: 'Serializable', maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (!['P2034', 'P2002'].includes(error.code) || attempt === 3) throw error;
      await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

module.exports = { saveTasting, TastingConflict };
