const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  await prisma.eventWine.upsert({
    where: { eventId_wineId: { eventId: 'legacy-event-id', wineId: 'v1' } },
    update: {},
    create: { eventId: 'legacy-event-id', wineId: 'v1' }
  });
  console.log('EventWine ensured.');
}
main().catch(console.error).finally(() => prisma.$disconnect());
