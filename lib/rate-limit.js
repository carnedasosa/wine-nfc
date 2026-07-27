'use strict';

const crypto = require('node:crypto');
const { isProduction } = require('./http-security');

const RATE_LIMITS = Object.freeze({
  OTP_EMAIL: Object.freeze({ namespace: 'otp:email', limit: 3, windowMs: 15 * 60 * 1000 }),
  OTP_IP: Object.freeze({ namespace: 'otp:ip', limit: 5, windowMs: 15 * 60 * 1000 }),
  OTP_VERIFY_IP: Object.freeze({ namespace: 'otp-verify:ip', limit: 10, windowMs: 15 * 60 * 1000 }),
  TASTING_USER: Object.freeze({ namespace: 'tasting:user', limit: 30, windowMs: 60 * 1000 }),
  DNA_USER: Object.freeze({ namespace: 'dna:user', limit: 3, windowMs: 10 * 60 * 1000 }),
  LEADERBOARD_IP: Object.freeze({ namespace: 'leaderboard:ip', limit: 60, windowMs: 60 * 1000 })
});

function readPositiveInteger(value, name, maximum) {
  if (value === undefined || value === '') return undefined;
  if (!/^\d+$/.test(String(value))) throw new TypeError(`${name} non valido`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new TypeError(`${name} non valido`);
  }
  return parsed;
}

function resolveRateLimit(name, env = process.env) {
  const defaults = RATE_LIMITS[name];
  if (!defaults) throw new TypeError('Profilo rate limit sconosciuto');
  const limitName = `RATE_LIMIT_${name}`;
  const windowName = `${limitName}_WINDOW_SECONDS`;
  const limit = readPositiveInteger(env[limitName], limitName, 100000) ?? defaults.limit;
  const seconds = readPositiveInteger(env[windowName], windowName, 24 * 60 * 60);
  return {
    namespace: defaults.namespace,
    limit,
    windowMs: seconds === undefined ? defaults.windowMs : seconds * 1000
  };
}

const INCREMENT_SCRIPT = [
  `local current = redis.call('INCR', KEYS[1])`,
  `if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end`,
  `local ttl = redis.call('PTTL', KEYS[1])`,
  `return {current, ttl}`
].join('\n');

const MEMORY_STORE_SYMBOL = Symbol.for('vino-passport.rate-limit.memory.v1');
const memoryStore = globalThis[MEMORY_STORE_SYMBOL] || new Map();
globalThis[MEMORY_STORE_SYMBOL] = memoryStore;

class RateLimitUnavailableError extends Error {
  constructor(message = 'Rate limiter non disponibile') {
    super(message);
    this.name = 'RateLimitUnavailableError';
    this.code = 'RATE_LIMIT_UNAVAILABLE';
    this.statusCode = 503;
  }
}

function assertOptions({ namespace, identifier, limit, windowMs }) {
  if (typeof namespace !== 'string' || !/^[a-z0-9:_-]{1,64}$/i.test(namespace)) {
    throw new TypeError('Namespace rate limit non valido');
  }
  if (typeof identifier !== 'string' || !identifier.trim() || identifier.length > 512) {
    throw new TypeError('Identificatore rate limit non valido');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100000) {
    throw new TypeError('Limite non valido');
  }
  if (!Number.isSafeInteger(windowMs) || windowMs < 1000 || windowMs > 24 * 60 * 60 * 1000) {
    throw new TypeError('Finestra rate limit non valida');
  }
}

function rateLimitKey(namespace, identifier, env = process.env) {
  const keySecret = env.RATE_LIMIT_KEY_SECRET || env.UPSTASH_REDIS_REST_TOKEN;
  const digest = keySecret
    ? crypto.createHmac('sha256', keySecret).update(identifier.trim()).digest('base64url')
    : crypto.createHash('sha256').update(identifier.trim()).digest('base64url');
  return `vino:rl:v1:${namespace}:${digest}`;
}

function buildResult(count, ttlMs, limit, now, source) {
  const safeTtl = Number.isFinite(ttlMs) && ttlMs > 0 ? Math.ceil(ttlMs) : 1000;
  const allowed = count <= limit;
  return {
    allowed,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: now + safeTtl,
    retryAfter: allowed ? 0 : Math.max(1, Math.ceil(safeTtl / 1000)),
    source
  };
}

function emitRateLimitEvent(event, details = {}, logger = console) {
  if (!logger || typeof logger.warn !== 'function') return;
  const payload = {
    type: 'security.rate_limit',
    event,
    profile: typeof details.profile === 'string' ? details.profile : 'custom',
    namespace: typeof details.namespace === 'string' ? details.namespace : 'unknown',
    source: typeof details.source === 'string' ? details.source : 'unknown'
  };
  if (Number.isSafeInteger(details.limit)) payload.limit = details.limit;
  if (Number.isSafeInteger(details.retryAfter)) payload.retryAfter = details.retryAfter;

  // Non includere mai identificatori, chiavi Redis, IP, email o subject provider.
  try { logger.warn(JSON.stringify(payload)); } catch { /* Telemetria best effort. */ }
}

function consumeMemory(key, limit, windowMs, now) {
  let entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  memoryStore.set(key, entry);

  if (memoryStore.size > 10000) {
    for (const [storedKey, stored] of memoryStore) {
      if (stored.resetAt <= now || memoryStore.size > 10000) memoryStore.delete(storedKey);
    }
  }
  return buildResult(entry.count, entry.resetAt - now, limit, now, 'memory');
}

function getUpstashConfig(env) {
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || !['http:', 'https:'].includes(parsed.protocol)) throw new Error();
    if (isProduction(env) && parsed.protocol !== 'https:') throw new Error();
    return { url: parsed.toString().replace(/\/$/, ''), token };
  } catch {
    throw new RateLimitUnavailableError('Configurazione rate limiter non valida');
  }
}

async function consumeUpstash(config, key, limit, windowMs, now, fetchImpl, timeoutMs) {
  if (typeof fetchImpl !== 'function') throw new RateLimitUnavailableError();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(['EVAL', INCREMENT_SCRIPT, '1', key, String(windowMs)]),
      signal: controller.signal
    });
  } catch {
    throw new RateLimitUnavailableError();
  } finally {
    clearTimeout(timeout);
  }

  if (!response || !response.ok) throw new RateLimitUnavailableError();
  let payload;
  try { payload = await response.json(); } catch { throw new RateLimitUnavailableError(); }
  if (!payload || payload.error || !Array.isArray(payload.result) || payload.result.length !== 2) {
    throw new RateLimitUnavailableError();
  }

  const count = Number(payload.result[0]);
  const ttlMs = Number(payload.result[1]);
  if (!Number.isSafeInteger(count) || count < 1 || !Number.isFinite(ttlMs)) {
    throw new RateLimitUnavailableError();
  }
  return buildResult(count, ttlMs > 0 ? ttlMs : windowMs, limit, now, 'upstash');
}

async function consumeRateLimit(options) {
  const {
    namespace,
    identifier,
    limit,
    windowMs,
    env = process.env,
    fetchImpl = globalThis.fetch,
    now = Date.now(),
    timeoutMs = 2000
  } = options || {};
  assertOptions({ namespace, identifier, limit, windowMs });
  const key = rateLimitKey(namespace, identifier, env);

  let config;
  try { config = getUpstashConfig(env); } catch (error) {
    console.warn('Avviso: configurazione Upstash non valida, fallback su memoria');
    return consumeMemory(key, limit, windowMs, now);
  }
  if (!config) {
    console.warn('Avviso: Upstash non configurato, fallback su memoria');
    return consumeMemory(key, limit, windowMs, now);
  }

  try {
    return await consumeUpstash(config, key, limit, windowMs, now, fetchImpl, timeoutMs);
  } catch (error) {
    console.warn('Avviso: errore con Upstash, fallback su memoria', error.message);
    return consumeMemory(key, limit, windowMs, now);
  }
}

function setRateLimitHeaders(res, result) {
  res.setHeader('RateLimit-Limit', String(result.limit));
  res.setHeader('RateLimit-Remaining', String(result.remaining));
  res.setHeader('RateLimit-Reset', String(Math.ceil(result.resetAt / 1000)));
}

async function enforceRateLimit(req, res, options) {
  let resolvedOptions;
  try {
    resolvedOptions = options?.profile
      ? { ...resolveRateLimit(options.profile, options.env || process.env), ...options }
      : options;
    const rawIdentifier = typeof resolvedOptions?.identifier === 'function'
      ? await resolvedOptions.identifier(req)
      : resolvedOptions?.identifier;
    const result = await consumeRateLimit({
      ...resolvedOptions,
      identifier: String(rawIdentifier || '')
    });
    setRateLimitHeaders(res, result);
    if (result.allowed) return true;
    if (result.count === result.limit + 1 || result.count % 100 === 0) {
      emitRateLimitEvent('blocked', {
        profile: resolvedOptions?.profile,
        namespace: resolvedOptions?.namespace,
        source: result.source,
        limit: result.limit,
        retryAfter: result.retryAfter
      }, resolvedOptions?.logger);
    }
    res.setHeader('Retry-After', String(result.retryAfter));
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Troppe richieste. Riprova più tardi.',
      fields: {}
    });
    return false;
  } catch (error) {
    console.error('Rate Limit error caught:', error);
    if (!(error instanceof RateLimitUnavailableError) && !(error instanceof TypeError)) throw error;
    emitRateLimitEvent('unavailable', {
      profile: resolvedOptions?.profile || options?.profile,
      namespace: resolvedOptions?.namespace || options?.namespace,
      source: 'fail_closed',
      retryAfter: 5
    }, resolvedOptions?.logger || options?.logger);
    res.setHeader('Retry-After', '5');
    res.status(503).json({
      code: error.code || 'RATE_LIMIT_CONFIGURATION_ERROR',
      message: 'Servizio temporaneamente non disponibile',
      fields: {}
    });
    return false;
  }
}

function resetMemoryStoreForTests() {
  memoryStore.clear();
}

module.exports = {
  INCREMENT_SCRIPT,
  RATE_LIMITS,
  RateLimitUnavailableError,
  consumeRateLimit,
  emitRateLimitEvent,
  enforceRateLimit,
  rateLimitKey,
  resolveRateLimit,
  resetMemoryStoreForTests,
  setRateLimitHeaders
};
