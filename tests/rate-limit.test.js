import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  RATE_LIMITS,
  RateLimitUnavailableError,
  consumeRateLimit,
  enforceRateLimit,
  rateLimitKey,
  resetMemoryStoreForTests,
  resolveRateLimit
} = require('../lib/rate-limit');

function responseDouble() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('rate limiting condiviso M1', () => {
  beforeEach(() => resetMemoryStoreForTests());

  it('non include PII nelle chiavi Redis', () => {
    const key = rateLimitKey('otp:email', 'persona@example.com');
    expect(key).toMatch(/^vino:rl:v1:otp:email:/);
    expect(key).not.toContain('persona');
    expect(key).not.toContain('@');
  });

  it('usa il fallback memoria soltanto fuori produzione', async () => {
    const options = {
      namespace: 'test:user',
      identifier: 'utente-1',
      limit: 2,
      windowMs: 60000,
      env: { NODE_ENV: 'test' },
      now: 1000
    };
    expect((await consumeRateLimit(options)).allowed).toBe(true);
    expect((await consumeRateLimit(options)).remaining).toBe(0);
    const blocked = await consumeRateLimit(options);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(60);
    await expect(consumeRateLimit({
      ...options,
      env: { NODE_ENV: 'production' }
    })).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('esegue un EVAL atomico su Upstash quando configurato', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ result: [1, 59000] })
    }));
    const result = await consumeRateLimit({
      namespace: 'otp:email',
      identifier: 'persona@example.com',
      limit: 3,
      windowMs: 60000,
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://redis.example',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token'
      },
      fetchImpl,
      now: 1000
    });
    expect(result).toMatchObject({ allowed: true, remaining: 2, source: 'upstash' });
    const [, request] = fetchImpl.mock.calls[0];
    const command = JSON.parse(request.body);
    expect(command[0]).toBe('EVAL');
    expect(command[2]).toBe('1');
    expect(command[3]).not.toContain('persona@example.com');
  });

  it('fallisce chiuso in produzione se Upstash non risponde', async () => {
    await expect(consumeRateLimit({
      namespace: 'test:ip',
      identifier: '203.0.113.1',
      limit: 1,
      windowMs: 60000,
      env: {
        NODE_ENV: 'production',
        UPSTASH_REDIS_REST_URL: 'https://redis.example',
        UPSTASH_REDIS_REST_TOKEN: 'secret-token'
      },
      fetchImpl: vi.fn(async () => { throw new Error('network'); })
    })).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('risponde 429 con Retry-After quando la quota è superata', async () => {
    const logger = { warn: vi.fn() };
    const config = {
      namespace: 'test:route',
      identifier: 'same-user',
      limit: 1,
      windowMs: 60000,
      env: { NODE_ENV: 'test' },
      now: 1000,
      logger
    };
    expect(await enforceRateLimit({}, responseDouble(), config)).toBe(true);
    const res = responseDouble();
    expect(await enforceRateLimit({}, res, config)).toBe(false);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('60');
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(logger.warn).toHaveBeenCalledOnce();
    const event = JSON.parse(logger.warn.mock.calls[0][0]);
    expect(event).toMatchObject({
      type: 'security.rate_limit',
      event: 'blocked',
      namespace: 'test:route',
      limit: 1,
      retryAfter: 60
    });
    expect(logger.warn.mock.calls[0][0]).not.toContain('same-user');
  });

  it('emette un evento senza identificatori quando fallisce chiuso', async () => {
    const logger = { warn: vi.fn() };
    const res = responseDouble();
    const allowed = await enforceRateLimit({}, res, {
      profile: 'OTP_IP',
      identifier: '203.0.113.50',
      env: { NODE_ENV: 'production' },
      logger
    });

    expect(allowed).toBe(false);
    expect(res.statusCode).toBe(503);
    const serialized = logger.warn.mock.calls[0][0];
    expect(JSON.parse(serialized)).toMatchObject({
      type: 'security.rate_limit',
      event: 'unavailable',
      profile: 'OTP_IP',
      source: 'fail_closed'
    });
    expect(serialized).not.toContain('203.0.113.50');
  });

  it('consente override validati per traffico NAT dell’evento', () => {
    expect(resolveRateLimit('OTP_IP', { RATE_LIMIT_OTP_IP: '50' })).toEqual({
      namespace: RATE_LIMITS.OTP_IP.namespace,
      limit: 50,
      windowMs: RATE_LIMITS.OTP_IP.windowMs
    });
    expect(resolveRateLimit('OTP_IP', {
      RATE_LIMIT_OTP_IP: '20',
      RATE_LIMIT_OTP_IP_WINDOW_SECONDS: '120'
    }).windowMs).toBe(120000);
    expect(() => resolveRateLimit('OTP_IP', { RATE_LIMIT_OTP_IP: 'nope' })).toThrow(TypeError);
  });
});
