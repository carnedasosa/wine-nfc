import { describe, expect, it } from 'vitest';

const {
  AccountLinkError,
  linkVerifiedIdentity,
  publicUser
} = require('../lib/user-account');

const SUBJECT = '11111111-1111-4111-8111-111111111111';

function memoryDb(initialUsers = []) {
  const users = initialUsers.map(user => ({ authSubject: null, ...user }));

  const matchesEmail = (user, criterion) =>
    typeof user.email === 'string' &&
    user.email.toLowerCase() === String(criterion.equals).toLowerCase();

  const api = {
    async findUnique({ where }) {
      if (where.authSubject !== undefined) {
        return users.find(user => user.authSubject === where.authSubject) || null;
      }
      if (where.id !== undefined) return users.find(user => user.id === where.id) || null;
      return null;
    },
    async findFirst({ where }) {
      return users.find(user =>
        matchesEmail(user, where.email) &&
        (!where.id?.not || user.id !== where.id.not)
      ) || null;
    },
    async findMany({ where, take }) {
      return users.filter(user => matchesEmail(user, where.email)).slice(0, take);
    },
    async update({ where, data }) {
      const user = users.find(candidate => candidate.id === where.id);
      if (!user) throw Object.assign(new Error('not found'), { code: 'P2025' });
      Object.assign(user, data);
      return { ...user };
    },
    async updateMany({ where, data }) {
      const user = users.find(candidate =>
        candidate.id === where.id && candidate.authSubject === where.authSubject
      );
      if (!user) return { count: 0 };
      Object.assign(user, data);
      return { count: 1 };
    },
    async create({ data }) {
      if (users.some(user =>
        user.email === data.email ||
        (data.authSubject && user.authSubject === data.authSubject)
      )) {
        throw Object.assign(new Error('unique'), { code: 'P2002' });
      }
      const user = {
        id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(users.length + 1).padStart(12, '0')}`,
        ...data
      };
      users.push(user);
      return { ...user };
    }
  };

  return {
    users,
    user: api,
    async $transaction(callback) { return callback({ user: api }); }
  };
}

describe('linking identità Supabase', () => {
  it('collega una sola corrispondenza legacy case-insensitive dopo verifica', async () => {
    const db = memoryDb([{
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'Vecchio nome',
      email: 'Ada@Example.com'
    }]);

    const user = await linkVerifiedIdentity({
      id: SUBJECT,
      email: 'ada@example.com'
    }, 'Ada', db);

    expect(user).toEqual({
      id: '22222222-2222-4222-8222-222222222222',
      nome: 'Ada',
      email: 'ada@example.com'
    });
    expect(db.users[0].authSubject).toBe(SUBJECT);
  });

  it('non collega automaticamente duplicati case-insensitive', async () => {
    const db = memoryDb([
      {
        id: '22222222-2222-4222-8222-222222222222',
        nome: 'Uno',
        email: 'same@example.com'
      },
      {
        id: '33333333-3333-4333-8333-333333333333',
        nome: 'Due',
        email: 'SAME@example.com'
      }
    ]);

    await expect(linkVerifiedIdentity({
      id: SUBJECT,
      email: 'same@example.com'
    }, 'Nome', db)).rejects.toBeInstanceOf(AccountLinkError);
    expect(db.users.every(user => user.authSubject === null)).toBe(true);
  });

  it('impedisce di sostituire un subject già collegato', async () => {
    const db = memoryDb([{
      id: '22222222-2222-4222-8222-222222222222',
      authSubject: '99999999-9999-4999-8999-999999999999',
      nome: 'Ada',
      email: 'ada@example.com'
    }]);

    await expect(linkVerifiedIdentity({
      id: SUBJECT,
      email: 'ada@example.com'
    }, 'Attacker', db)).rejects.toMatchObject({ code: 'ACCOUNT_LINK_CONFLICT' });
    expect(db.users[0].authSubject).toBe('99999999-9999-4999-8999-999999999999');
  });

  it('crea un profilo nuovo solo con email e subject verificati', async () => {
    const db = memoryDb();
    const user = await linkVerifiedIdentity({
      id: SUBJECT,
      email: 'new@example.com'
    }, 'Nuovo utente', db);

    expect(user).toMatchObject({ nome: 'Nuovo utente', email: 'new@example.com' });
    expect(db.users).toHaveLength(1);
    expect(db.users[0].authSubject).toBe(SUBJECT);
  });

  it('non espone mai authSubject nel profilo pubblico', () => {
    expect(publicUser({
      id: 'id',
      nome: 'Ada',
      email: 'ada@example.com',
      authSubject: SUBJECT
    })).toEqual({ id: 'id', nome: 'Ada', email: 'ada@example.com' });
  });
});
