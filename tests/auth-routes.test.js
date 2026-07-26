import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requestOtpHandler = require('../api/auth/request-otp');
const refreshHandler = require('../api/auth/refresh');
const logoutHandler = require('../api/auth/logout');
const { resetMemoryStoreForTests } = require('../lib/rate-limit');

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

function request(body, origin = 'https://app.example.com', ip = '203.0.113.10') {
  return {
    method: 'POST',
    body,
    headers: {
      origin,
      host: 'app.example.com'
    },
    socket: { remoteAddress: ip, encrypted: true }
  };
}

function providerResponse(status, body = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('route OTP M1', () => {
  beforeEach(() => {
    resetMemoryStoreForTests();
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('APP_ORIGIN', 'https://app.example.com');
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    delete process.env.RATE_LIMIT_OTP_EMAIL;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('restituisce la stessa risposta anti-enumerazione per provider success e rifiuto', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(providerResponse(200))
      .mockResolvedValueOnce(providerResponse(400, { message: 'user detail' }));
    vi.stubGlobal('fetch', fetchMock);

    const success = responseDouble();
    await requestOtpHandler(request({ email: 'one@example.com' }), success);
    const rejected = responseDouble();
    await requestOtpHandler(request({ email: 'two@example.com' }), rejected);

    expect(success.statusCode).toBe(202);
    expect(rejected.statusCode).toBe(202);
    expect(rejected.payload).toEqual(success.payload);
    expect(JSON.stringify(success.payload)).not.toContain('one@example.com');
  });

  it('rifiuta origin estranei prima di contattare il provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = responseDouble();

    await requestOtpHandler(request({ email: 'one@example.com' }, 'https://evil.example'), res);

    expect(res.statusCode).toBe(403);
    expect(res.payload.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('non nasconde una indisponibilità operativa del provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(providerResponse(503)));
    const res = responseDouble();

    await requestOtpHandler(request({ email: 'one@example.com' }), res);

    expect(res.statusCode).toBe(503);
    expect(res.payload.code).toBe('AUTH_PROVIDER_UNAVAILABLE');
  });

  it('un IP già bloccato non consuma la quota email di una vittima', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(providerResponse(200)));

    for (let index = 0; index < 5; index += 1) {
      const res = responseDouble();
      await requestOtpHandler(request({ email: `other-${index}@example.com` }), res);
      expect(res.statusCode).toBe(202);
    }

    const blocked = responseDouble();
    await requestOtpHandler(request({ email: 'victim@example.com' }), blocked);
    expect(blocked.statusCode).toBe(429);

    const allowed = responseDouble();
    await requestOtpHandler(
      request({ email: 'victim@example.com' }, 'https://app.example.com', '203.0.113.11'),
      allowed
    );
    expect(allowed.statusCode).toBe(202);
    expect(allowed.headers['RateLimit-Remaining']).toBe('2');
  });

  it('cancella sempre i cookie nel logout locale anche senza sessione provider', async () => {
    const res = responseDouble();
    await logoutHandler({
      method: 'POST',
      body: undefined,
      headers: {
        origin: 'https://app.example.com',
        'x-csrf-token': 'csrf-value',
        cookie: 'vino_csrf=csrf-value'
      }
    }, res);

    expect(res.statusCode).toBe(204);
    expect(res.headers['Set-Cookie']).toHaveLength(3);
    expect(res.headers['Set-Cookie'].every(cookie => cookie.includes('Max-Age=0'))).toBe(true);
  });

  it('rifiuta il refresh senza refresh cookie e pulisce la sessione locale', async () => {
    const res = responseDouble();
    await refreshHandler({
      method: 'POST',
      body: undefined,
      headers: {
        origin: 'https://app.example.com',
        'x-csrf-token': 'csrf-value',
        cookie: 'vino_csrf=csrf-value'
      }
    }, res);

    expect(res.statusCode).toBe(401);
    expect(res.payload.code).toBe('REFRESH_REQUIRED');
    expect(res.headers['Set-Cookie']).toHaveLength(3);
  });
});
