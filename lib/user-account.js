const prisma = require('./prisma');
const {
  isUuid,
  normalizeEmail,
  validateEmail,
  validateName
} = require('../utils/validation');

class AccountLinkError extends Error {
  constructor(message, code = 'ACCOUNT_LINK_CONFLICT') {
    super(message);
    this.name = 'AccountLinkError';
    this.code = code;
    this.status = 409;
  }
}

function publicUser(user) {
  return {
    id: user.id,
    nome: user.nome,
    email: user.email
  };
}

function assertIdentity(identity) {
  const authSubject = identity && identity.id;
  let verifiedEmail;
  try {
    verifiedEmail = validateEmail(identity && identity.email);
  } catch {
    verifiedEmail = '';
  }
  if (!isUuid(authSubject) || !verifiedEmail) {
    throw new AccountLinkError('Identità verificata incompleta', 'INVALID_IDENTITY');
  }
  return { authSubject: authSubject.toLowerCase(), verifiedEmail };
}

async function linkVerifiedIdentity(identity, requestedName, db = prisma) {
  const { authSubject, verifiedEmail } = assertIdentity(identity);
  const nome = validateName(requestedName);

  try {
    const user = await db.$transaction(async tx => {
      const linked = await tx.user.findUnique({ where: { authSubject } });
      if (linked) {
        if (linked.email && normalizeEmail(linked.email) !== verifiedEmail) {
          const conflict = await tx.user.findFirst({
            where: {
              email: { equals: verifiedEmail, mode: 'insensitive' },
              id: { not: linked.id }
            }
          });
          if (conflict) {
            throw new AccountLinkError(
              'La nuova email verificata appartiene già a un altro profilo'
            );
          }
        }

        return tx.user.update({
          where: { id: linked.id },
          data: { nome, email: verifiedEmail }
        });
      }

      const candidates = await tx.user.findMany({
        where: { email: { equals: verifiedEmail, mode: 'insensitive' } },
        take: 2
      });

      if (candidates.length > 1) {
        throw new AccountLinkError(
          'Più profili legacy corrispondono alla stessa email'
        );
      }

      if (candidates.length === 1) {
        const candidate = candidates[0];
        if (candidate.authSubject && candidate.authSubject !== authSubject) {
          throw new AccountLinkError(
            'Il profilo è già collegato a un’altra identità'
          );
        }

        if (!candidate.authSubject) {
          const claimed = await tx.user.updateMany({
            where: { id: candidate.id, authSubject: null },
            data: { authSubject, nome, email: verifiedEmail }
          });
          if (claimed.count !== 1) {
            const winner = await tx.user.findUnique({ where: { id: candidate.id } });
            if (!winner || winner.authSubject !== authSubject) {
              throw new AccountLinkError(
                'Il profilo è stato collegato contemporaneamente a un’altra identità'
              );
            }
            return winner;
          }
          return tx.user.findUnique({ where: { id: candidate.id } });
        }

        return tx.user.update({
          where: { id: candidate.id },
          data: { nome, email: verifiedEmail }
        });
      }

      return tx.user.create({
        data: { authSubject, nome, email: verifiedEmail }
      });
    });

    return publicUser(user);
  } catch (error) {
    if (error instanceof AccountLinkError) throw error;
    if (error && error.code === 'P2002') {
      const winner = await db.user.findUnique({ where: { authSubject } });
      if (winner && normalizeEmail(winner.email) === verifiedEmail) {
        const updated = await db.user.update({
          where: { id: winner.id },
          data: { nome, email: verifiedEmail }
        });
        return publicUser(updated);
      }
      throw new AccountLinkError('Conflitto durante il collegamento del profilo');
    }
    throw error;
  }
}

async function findAccountBySubject(authSubject, db = prisma) {
  if (!isUuid(authSubject)) return null;
  const user = await db.user.findUnique({
    where: { authSubject: authSubject.toLowerCase() },
    select: { id: true, nome: true, email: true }
  });
  return user ? publicUser(user) : null;
}

module.exports = {
  AccountLinkError,
  linkVerifiedIdentity,
  findAccountBySubject,
  publicUser
};
