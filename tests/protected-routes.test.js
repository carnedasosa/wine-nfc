import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prisma = require('../lib/prisma');
const tastingsHandler = require('../api/tastings');
const dnaHandler = require('../api/dna');
const updateProfileHandler = require('../api/users/[id]');
const exchangeHandler = require('../api/auth/exchange');
const { resetMemoryStoreForTests } = require('../lib/rate-limit');

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333';
const WINE_ID = '550e8400-e29b-41d4-a716-446655440000';

function jwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  return [
    jwtPart({ alg: 'RS256', typ: 'JWT' }),
    jwtPart({
      iss: 'https://project.supabase.co/auth/v1',
      aud: 'authenticated',
      sub: SUBJECT,
      role: 'authenticated',
      iat: now - 10,
      exp: now + 600
    }),
    'provider-signature'
  ].join('.');
}

function responseDouble() {
  return {
    headers: {},
    statusCode: 200,
    payload: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    getHeader(name) { return this.headers[name]; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; }
  };
}

function request(method, body, options = {}) {
  return {
    method,
    body,
    query: options.query || {},
    params: options.params || {},
    headers: {
      cookie: `vino_access=${accessToken()}; vino_csrf=csrf-test`,
      origin: 'https://app.example.com',
      'x-csrf-token': 'csrf-test',
      host: 'localhost'
    },
    url: options.url || '/api/tastings',
    socket: { remoteAddress: '203.0.113.20', encrypted: true }
  };
}

function providerUserResponse() {
  return new Response(JSON.stringify({
    id: SUBJECT,
    email: 'ada@example.com',
    email_confirmed_at: '2026-01-01T00:00:00.000Z'
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}

describe('isolamento route protette M1', () => {
  beforeEach(() => {
    resetMemoryStoreForTests();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_ORIGIN', 'https://app.example.com');
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => providerUserResponse()));
    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: USER_ID,
      nome: 'Ada',
      email: 'ada@example.com'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('GET tastings usa sempre lo userId derivato dal subject, ignorando ownership client', async () => {
    const findMany = vi.spyOn(prisma.tasting, 'findMany').mockResolvedValue([]);
    const res = responseDouble();

    await tastingsHandler(request('GET', undefined, {
      query: { userId: OTHER_USER_ID },
      url: '/api/tastings?eventId=legacy-event-id'
    }), res);

    expect(res.statusCode).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: USER_ID, eventId: 'legacy-event-id' }
    }));
  });

  it('POST tasting rifiuta un userId controllato dal client prima del database', async () => {
    const upsert = vi.spyOn(prisma.tasting, 'upsert').mockResolvedValue({});
    const res = responseDouble();

    await tastingsHandler(request('POST', {
      eventId: '11111111-1111-4111-8111-111111111111',
      userId: OTHER_USER_ID,
      wineId: WINE_ID,
      acidita: 3,
      corpo: 3,
      persistenza: 3,
      emozione: 'Pace',
      idempotencyKey: '22222222-2222-4222-8222-222222222222'
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('VALIDATION_ERROR');
    expect(upsert).not.toHaveBeenCalled();
  });

  it('Wine DNA rifiuta ownership e campi extra controllati dal client', async () => {
    const res = responseDouble();

    await dnaHandler(request('POST', {
      userId: OTHER_USER_ID,
      assaggiCount: 1,
      avgAcidita: 3,
      avgCorpo: 3,
      avgPersistenza: 3,
      topEmo: ['Pace'],
      viniPreferiti: ['Vino'],
      utenteNome: 'Ada'
    }), res);

    expect(res.statusCode).toBe(400);
    expect(res.payload.code).toBe('VALIDATION_ERROR');
  });

  it('la route DNA importa le regole condivise senza arrotondare 3.5 a una soglia', async () => {
    const eventId = '11111111-1111-4111-8111-111111111111';
    vi.spyOn(prisma.event, 'findUnique').mockResolvedValue({ id: eventId, stato: 'active' });
    vi.spyOn(prisma.tasting, 'findMany').mockResolvedValue([3, 4].map((acidita, index) => ({
      id: String(index), updatedAt: new Date(), wine: { nome: 'Test', cantina: 'Cantina' }, acidita, corpo: 3, persistenza: 2, emozione: 'Pace'
    })));
    vi.spyOn(prisma.dnaProfile, 'findUnique').mockRejectedValue(new Error('Database cache non disponibile'));
    const res = responseDouble(); await dnaHandler(request('POST', { eventId }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.stats.averages.acidita).toBe(3.5);
    expect(res.payload.stats.tags).not.toContain('Vini tesi');
    expect(res.payload.fallback).toBe(true);
    expect(res.payload.dnaText).toContain('acidità 3.5/5');
  });

  it('Magic Link emette cookie preservando il nome del profilo esistente', async () => {
    vi.spyOn(prisma, '$transaction').mockImplementation(operation => operation(prisma));
    vi.spyOn(prisma.user, 'updateMany').mockResolvedValue({ count: 0 });
    const update = vi.spyOn(prisma.user, 'update').mockResolvedValue({ id: USER_ID, nome: 'Nome scelto', email: 'ada@example.com' });
    const res = responseDouble();
    await exchangeHandler(request('POST', { accessToken: accessToken(), refreshToken: 'synthetic-refresh' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.payload.user.nome).toBe('Nome scelto');
    expect(update.mock.calls[0][0].data).not.toHaveProperty('nome');
    expect(res.headers['Set-Cookie']).toBeDefined();
  });

  it('profilo nega IDOR e non aggiorna il record di un altro utente', async () => {
    const update = vi.spyOn(prisma.user, 'update').mockResolvedValue({});
    const res = responseDouble();

    await updateProfileHandler(request('PUT', { nome: 'Attacker' }, {
      query: { id: OTHER_USER_ID }
    }), res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('FORBIDDEN_PROFILE_UPDATE');
    expect(update).not.toHaveBeenCalled();
  });
});
