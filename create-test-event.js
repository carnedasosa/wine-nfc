const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: 'load-test-2' },
    update: {},
    create: {
      id: 'legacy-event-id',
      nome: 'Load Test Event 2',
      slug: 'load-test-2',
      inizio: new Date(),
      fine: new Date(Date.now() + 10000000000),
      timezone: 'UTC',
      stato: 'ATTIVO'
    }
  });
  console.log('Event created:', event.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
