'use strict';

const crypto = require('node:crypto');
const net = require('node:net');

const COOKIE_NAMES = Object.freeze({ access: 'vino_access', refresh: 'vino_refresh', csrf: 'vino_csrf' });
const HOST_COOKIE_NAMES = Object.freeze({
  access: '__Host-vino-access',
  refresh: '__Host-vino-refresh',
  csrf: '__Host-vino-csrf'
});
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ACCESS_TOKEN_MAX_AGE_SECONDS = 3600;
const REFRESH_TOKEN_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

const CONTENT_SECURITY_POLICY = [
  `default-src 'self'`,
  `script-src 'self' https://cdnjs.cloudflare.com`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `img-src 'self' data: blob:`,
  `connect-src 'self'`,
  `worker-src 'self'`,
  `manifest-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `frame-ancestors 'none'`,
  `form-action 'self'`
].join('; ');

const BASE_SECURITY_HEADERS = Object.freeze({
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
});

class HttpSecurityError extends Error {
  constructor(code, message, statusCode = 403) {
    super(message);
    this.name = 'HttpSecurityError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function isProduction(env = process.env) {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
}

function getCookieNames(env = process.env) {
  return isProduction(env) ? HOST_COOKIE_NAMES : COOKIE_NAMES;
}

function getHeader(req, name) {
  if (!req || !req.headers) return undefined;
  const value = req.headers[name.toLowerCase()] ?? req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function parseCookies(cookieHeader) {
  const cookies = Object.create(null);
  if (typeof cookieHeader !== 'string') return cookies;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    if (!name || Object.hasOwn(cookies, name)) continue;
    const value = part.slice(separator + 1).trim();
    try { cookies[name] = decodeURIComponent(value); } catch { cookies[name] = value; }
  }
  return cookies;
}

function getRequestCookies(req) {
  return parseCookies(getHeader(req, 'cookie'));
}

function serializeCookie(name, value, options = {}) {
  if (!/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(name)) throw new TypeError('Nome cookie non valido');
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new TypeError('Valore cookie non valido');
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) {
    const maxAge = Math.max(0, Math.floor(Number(options.maxAge)));
    if (!Number.isFinite(maxAge)) throw new TypeError('Max-Age cookie non valido');
    parts.push(`Max-Age=${maxAge}`);
  }
  if (options.expires instanceof Date) parts.push(`Expires=${options.expires.toUTCString()}`);
  parts.push(`Path=${options.path || '/'}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  const sameSite = options.sameSite || 'Lax';
  if (!['Strict', 'Lax', 'None'].includes(sameSite) || (sameSite === 'None' && !options.secure)) {
    throw new TypeError('SameSite cookie non valido');
  }
  parts.push(`SameSite=${sameSite}`);
  return parts.join('; ');
}

function appendSetCookie(res, cookie) {
  if (typeof res.append === 'function') return res.append('Set-Cookie', cookie);
  const current = typeof res.getHeader === 'function' ? res.getHeader('Set-Cookie') : undefined;
  const existing = current === undefined ? [] : Array.isArray(current) ? current : [current];
  res.setHeader('Set-Cookie', [...existing, cookie]);
}

function createCsrfToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function setSessionCookies(res, session, options = {}) {
  if (!session || typeof session.accessToken !== 'string' || typeof session.refreshToken !== 'string') {
    throw new TypeError('Sessione non valida');
  }
  const env = options.env || process.env;
  const secure = options.secure ?? isProduction(env);
  const cookieNames = getCookieNames(env);
  const hostPrefixed = cookieNames === HOST_COOKIE_NAMES;
  if (hostPrefixed && !secure) throw new TypeError('I cookie __Host- richiedono Secure');
  const refreshPath = hostPrefixed ? '/' : '/api/auth';
  const expires = Number(session.expiresIn);
  const accessMaxAge = Number.isFinite(expires) ? Math.max(60, Math.min(Math.floor(expires), 3600)) : 3600;
  const refreshMaxAge = options.refreshMaxAge || REFRESH_TOKEN_MAX_AGE_SECONDS;
  const csrfToken = session.csrfToken || createCsrfToken();
  appendSetCookie(res, serializeCookie(cookieNames.access, session.accessToken,
    { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: accessMaxAge }));
  appendSetCookie(res, serializeCookie(cookieNames.refresh, session.refreshToken,
    { httpOnly: true, secure, sameSite: 'Lax', path: refreshPath, maxAge: refreshMaxAge }));
  appendSetCookie(res, serializeCookie(cookieNames.csrf, csrfToken,
    { secure, sameSite: 'Lax', path: '/', maxAge: refreshMaxAge }));
  return csrfToken;
}

function clearSessionCookies(res, options = {}) {
  const env = options.env || process.env;
  const secure = options.secure ?? isProduction(env);
  const cookieNames = getCookieNames(env);
  const hostPrefixed = cookieNames === HOST_COOKIE_NAMES;
  if (hostPrefixed && !secure) throw new TypeError('I cookie __Host- richiedono Secure');
  const refreshPath = hostPrefixed ? '/' : '/api/auth';
  const common = { secure, sameSite: 'Lax', expires: new Date(0), maxAge: 0 };
  appendSetCookie(res, serializeCookie(cookieNames.access, '', { ...common, httpOnly: true, path: '/' }));
  appendSetCookie(res, serializeCookie(cookieNames.refresh, '', { ...common, httpOnly: true, path: refreshPath }));
  appendSetCookie(res, serializeCookie(cookieNames.csrf, '', { ...common, path: '/' }));
}

function parseConfiguredOrigins(env) {
  let originStr = env.APP_ORIGIN;
  if (!originStr) {
    const vercelOrigins = [];
    if (env.VERCEL_PROJECT_PRODUCTION_URL) vercelOrigins.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
    if (env.VERCEL_BRANCH_URL) vercelOrigins.push(`https://${env.VERCEL_BRANCH_URL}`);
    if (env.VERCEL_URL) vercelOrigins.push(`https://${env.VERCEL_URL}`);
    if (vercelOrigins.length > 0) originStr = vercelOrigins.join(',');
  }

  if (!originStr) return [];
  const origins = [];
  for (const entry of originStr.split(',')) {
    const rawOrigin = entry.trim();
    try {
      const url = new URL(rawOrigin);
      if (!['http:', 'https:'].includes(url.protocol) || url.origin !== rawOrigin) throw new Error();
      origins.push(url.origin);
    } catch {
      throw new HttpSecurityError('SECURITY_CONFIGURATION_ERROR', 'Configurazione di sicurezza non valida', 500);
    }
  }
  return [...new Set(origins)];
}

function deriveDevelopmentOrigin(req) {
  const host = getHeader(req, 'host');
  if (!host || /[\r\n/\\]/.test(host)) return null;
  const forwardedProto = getHeader(req, 'x-forwarded-proto');
  const protocol = req?.socket?.encrypted || forwardedProto === 'https' ? 'https' : 'http';
  try { return new URL(`${protocol}://${host}`).origin; } catch { return null; }
}

function expectedOrigins(req, env = process.env) {
  const configured = parseConfiguredOrigins(env);
  if (configured.length > 0) return configured;
  if (isProduction(env)) {
    throw new HttpSecurityError('SECURITY_CONFIGURATION_ERROR', 'Origine applicativa non configurata', 500);
  }
  const localOrigin = deriveDevelopmentOrigin(req);
  return localOrigin ? [localOrigin] : [];
}

function assertSameOrigin(req, options = {}) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!options.force && SAFE_METHODS.has(method)) return true;
  const origin = getHeader(req, 'origin');
  if (!origin || origin === 'null') {
    throw new HttpSecurityError('ORIGIN_REQUIRED', 'Origine della richiesta mancante');
  }
  let normalizedOrigin;
  try { normalizedOrigin = new URL(origin).origin; } catch {
    throw new HttpSecurityError('ORIGIN_INVALID', 'Origine della richiesta non valida');
  }
  if (normalizedOrigin !== origin || !expectedOrigins(req, options.env || process.env).includes(origin)) {
    throw new HttpSecurityError('ORIGIN_NOT_ALLOWED', 'Origine della richiesta non consentita');
  }
  return true;
}

function safeTokenEquals(first, second) {
  if (typeof first !== 'string' || typeof second !== 'string' || !first || !second) return false;
  const firstBuffer = Buffer.from(first);
  const secondBuffer = Buffer.from(second);
  return firstBuffer.length === secondBuffer.length && crypto.timingSafeEqual(firstBuffer, secondBuffer);
}

function assertCsrf(req, options = {}) {
  const method = String(req?.method || 'GET').toUpperCase();
  if (!options.force && SAFE_METHODS.has(method)) return true;
  if (!options.skipOrigin) assertSameOrigin(req, options);
  const cookieToken = getRequestCookies(req)[getCookieNames(options.env || process.env).csrf];
  const headerToken = getHeader(req, 'x-csrf-token');
  if (!safeTokenEquals(cookieToken, headerToken)) {
    throw new HttpSecurityError('CSRF_INVALID', 'Token CSRF mancante o non valido');
  }
  return true;
}

function sendSecurityError(res, error) {
  if (!(error instanceof HttpSecurityError)) return false;
  res.status(error.statusCode).json({ code: error.code, message: error.message, fields: {} });
  return true;
}

function requireSameOrigin(req, res, options = {}) {
  try { assertSameOrigin(req, options); return true; } catch (error) {
    if (sendSecurityError(res, error)) return false;
    throw error;
  }
}

function requireCsrf(req, res, options = {}) {
  try { assertCsrf(req, options); return true; } catch (error) {
    if (sendSecurityError(res, error)) return false;
    throw error;
  }
}

function applySecurityHeaders(res, options = {}) {
  for (const [name, value] of Object.entries(BASE_SECURITY_HEADERS)) res.setHeader(name, value);
  if (options.hsts ?? isProduction(options.env || process.env)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function normalizeIp(candidate) {
  if (typeof candidate !== 'string') return null;
  let value = candidate.trim();
  if (!value) return null;
  if (value.startsWith('[')) {
    const closingBracket = value.indexOf(']');
    if (closingBracket > 0) value = value.slice(1, closingBracket);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(value)) {
    value = value.slice(0, value.lastIndexOf(':'));
  }
  if (value.startsWith('::ffff:') && net.isIP(value.slice(7)) === 4) value = value.slice(7);
  return net.isIP(value) ? value : null;
}

function firstValidForwardedIp(header) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(',')) {
    const ip = normalizeIp(part);
    if (ip) return ip;
  }
  return null;
}

function getTrustedClientIp(req, env = process.env) {
  if (env.VERCEL === '1') {
    const vercelIp = firstValidForwardedIp(getHeader(req, 'x-vercel-forwarded-for'));
    if (vercelIp) return vercelIp;
  }
  return normalizeIp(req?.socket?.remoteAddress) || normalizeIp(req?.connection?.remoteAddress) || 'unknown';
}

module.exports = {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  BASE_SECURITY_HEADERS,
  CONTENT_SECURITY_POLICY,
  COOKIE_NAMES,
  HOST_COOKIE_NAMES,
  HttpSecurityError,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  SAFE_METHODS,
  appendSetCookie,
  applySecurityHeaders,
  assertCsrf,
  assertSameOrigin,
  clearSessionCookies,
  createCsrfToken,
  expectedOrigins,
  getHeader,
  getCookieNames,
  getRequestCookies,
  getTrustedClientIp,
  isProduction,
  parseCookies,
  requireCsrf,
  requireSameOrigin,
  sendSecurityError,
  serializeCookie,
  setSessionCookies
};
