import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  AuthProviderError,
  assertVerifiedClaims,
  getVerifiedIdentity,
  refreshAuthSession,
  revokeAuthSession,
  requestEmailOtp,
  verifyEmailOtp
} = require('../lib/supabase-auth');

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const BASE_URL = 'https://project.supabase.co';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function makeToken(claimOverrides = {}, headerOverrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', ...headerOverrides };
  const claims = {
    iss: `${BASE_URL}/auth/v1`,
    aud: 'authenticated',
    sub: SUBJECT,
    role: 'authenticated',
    is_anonymous: false,
    iat: now - 10,
    exp: now + 3600,
    ...claimOverrides
  };
  return `${encode(header)}.${encode(claims)}.signature`;
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

function providerUser(overrides = {}) {
  return {
    id: SUBJECT,
    email: 'utente@example.com',
    email_confirmed_at: new Date().toISOString(),
    ...overrides
  };
}

describe('Supabase Auth server-side', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SUPABASE_URL', BASE_URL);
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    delete process.env.SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('valida issuer, audience, algoritmo, scadenza e subject dopo la verifica provider', () => {
    expect(assertVerifiedClaims(makeToken(), providerUser()).sub).toBe(SUBJECT);

    const invalidTokens = [
      makeToken({ iss: 'https://attacker.example/auth/v1' }),
      makeToken({ aud: 'anon' }),
      makeToken({ exp: Math.floor(Date.now() / 1000) - 1 }),
      makeToken({ sub: '22222222-2222-4222-8222-222222222222' }),
      makeToken({}, { alg: 'none' })
    ];

    for (const token of invalidTokens) {
      expect(() => assertVerifiedClaims(token, providerUser())).toThrow(AuthProviderError);
    }
  });

  it('autentica il token tramite /user e non tramite un bearer dichiarato dal client', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, providerUser()));
    vi.stubGlobal('fetch', fetchMock);
    const token = makeToken();

    const identity = await getVerifiedIdentity(token);

    expect(identity).toMatchObject({ id: SUBJECT, email: 'utente@example.com' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/v1/user`);
    expect(options.headers.Authorization).toBe(`Bearer ${token}`);
    expect(options.headers.apikey).toBe('sb_publishable_test');
  });

  it('rifiuta una email provider non confermata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, providerUser({
      email_confirmed_at: null,
      confirmed_at: null
    }))));

    await expect(getVerifiedIdentity(makeToken())).rejects.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED',
      status: 403
    });
  });

  it('richiede OTP senza inviare nome o altri dati personali', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);

    await requestEmailOtp('utente@example.com');

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/auth/v1/otp`);
    expect(JSON.parse(options.body)).toEqual({
      email: 'utente@example.com',
      create_user: true
    });
  });

  it('verifica OTP, poi verifica autorevolmente la sessione e non espone i token nel profilo', async () => {
    const accessToken = makeToken();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        access_token: accessToken,
        refresh_token: 'refresh-secret',
        expires_in: 3600
      }))
      .mockResolvedValueOnce(jsonResponse(200, providerUser()));
    vi.stubGlobal('fetch', fetchMock);

    const session = await verifyEmailOtp('utente@example.com', '123456');

    expect(session.identity).toMatchObject({ id: SUBJECT, email: 'utente@example.com' });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      `${BASE_URL}/auth/v1/verify`,
      `${BASE_URL}/auth/v1/user`
    ]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'utente@example.com',
      token: '123456',
      type: 'magiclink'
    });
  });

  it('ruota il refresh token e revoca globalmente la sessione', async () => {
    const accessToken = makeToken();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, {
        access_token: accessToken,
        refresh_token: 'refresh-rotated',
        expires_in: 3600
      }))
      .mockResolvedValueOnce(jsonResponse(200, providerUser()))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const session = await refreshAuthSession('refresh-old');
    expect(session.refreshToken).toBe('refresh-rotated');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      refresh_token: 'refresh-old'
    });
    expect(fetchMock.mock.calls[0][0]).toContain('grant_type=refresh_token');

    await revokeAuthSession(accessToken);
    expect(fetchMock.mock.calls[2][0]).toBe(`${BASE_URL}/auth/v1/logout?scope=global`);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe(`Bearer ${accessToken}`);
  });

  it('distingue indisponibilità provider da sessione rifiutata senza propagare il dettaglio', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, {
      message: 'internal provider detail'
    })));
    await expect(getVerifiedIdentity(makeToken())).rejects.toMatchObject({
      code: 'AUTH_REJECTED',
      status: 503
    });
  });
});
