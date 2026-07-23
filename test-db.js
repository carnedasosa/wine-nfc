const prisma = require('./lib/prisma');
async function test() {
  try {
    const wines = await prisma.wine.findMany();
    console.log('WINES:', wines);
    const users = await prisma.user.findMany();
    console.log('USERS:', users);
  } catch (e) {
    console.error('ERROR:', e);
  }
}
test();
