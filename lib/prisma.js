const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.DATABASE_URL || '';
if (process.env.VERCEL && dbUrl && !dbUrl.includes('connection_limit')) {
  const separator = dbUrl.includes('?') ? '&' : '?';
  dbUrl = `${dbUrl}${separator}connection_limit=1&pool_timeout=10`;
}

const prismaOptions = {
  datasources: {
    db: {
      url: dbUrl
    }
  }
};

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient(dbUrl ? prismaOptions : undefined);
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient(dbUrl ? prismaOptions : undefined);
  }
  prisma = global.prisma;
}

module.exports = prisma;
