const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

const WINE_IDS = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'];

async function main() {
  for (const wineId of WINE_IDS) {
    await prisma.eventWine.upsert({
      where: { eventId_wineId: { eventId: 'legacy-event-id', wineId } },
      update: {},
      create: { eventId: 'legacy-event-id', wineId, ordine: WINE_IDS.indexOf(wineId) }
    });
    console.log(`EventWine ensured for ${wineId}`);
  }
  console.log(`\nAll ${WINE_IDS.length} wines linked to event.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
