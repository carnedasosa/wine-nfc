import { describe, expect, it } from 'vitest';

const {
  CONTENT_SECURITY_POLICY,
  COOKIE_NAMES,
  HOST_COOKIE_NAMES,
  HttpSecurityError,
  applySecurityHeaders,
  assertCsrf,
  assertSameOrigin,
  clearSessionCookies,
  getRequestCookies,
  getTrustedClientIp,
  parseCookies,
  serializeCookie,
  setSessionCookies
} = require('../lib/http-security');
const vercelConfig = require('../vercel.json');

function responseDouble() {
  const headers = new Map();
  return {
    headers,
    setHeader(name, value) { headers.set(name, value); },
    getHeader(name) { return headers.get(name); }
  };
}

describe('sicurezza HTTP M1', () => {
  it('analizza cookie codificati senza permettere shadowing nello stesso header', () => {
    const parsed = parseCookies('vino_csrf=primo%20token; vino_access=abc; vino_csrf=secondo');
    expect(parsed.vino_csrf).toBe('primo token');
    expect(parsed.vino_access).toBe('abc');
    expect(getRequestCookies({ headers: { cookie: 'a=1' } }).a).toBe('1');
  });

  it('serializza cookie con attributi sicuri e rifiuta CRLF', () => {
    expect(serializeCookie('session', 'a b', {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/'
    })).toBe('session=a%20b; Path=/; HttpOnly; Secure; SameSite=Lax');
    expect(() => serializeCookie('session', 'bad\r\nHeader: x')).toThrow(TypeError);
  });

  it('imposta access, refresh e double-submit CSRF senza esporre i token HTTP-only', () => {
    const res = responseDouble();
    const csrf = setSessionCookies(res, {
      accessToken: 'access.token',
      refreshToken: 'refresh.token',
      expiresIn: 900,
      csrfToken: 'csrf-test'
    }, { env: { NODE_ENV: 'production' } });
    const cookies = res.headers.get('Set-Cookie');
    expect(csrf).toBe('csrf-test');
    expect(cookies).toHaveLength(3);
    expect(cookies[0]).toContain(`${HOST_COOKIE_NAMES.access}=access.token`);
    expect(cookies[0]).toContain('HttpOnly; Secure; SameSite=Lax');
    expect(cookies[1]).toContain(`${HOST_COOKIE_NAMES.refresh}=refresh.token`);
    expect(cookies[1]).toContain('Path=/; HttpOnly; Secure');
    expect(cookies[2]).toContain(`${HOST_COOKIE_NAMES.csrf}=csrf-test`);
    expect(cookies[2]).not.toContain('HttpOnly');
  });

  it('ruota il token CSRF a ogni nuova sessione per impedire session fixation', () => {
    const firstResponse = responseDouble();
    const secondResponse = responseDouble();
    const session = {
      accessToken: 'access.token',
      refreshToken: 'refresh.token',
      expiresIn: 900
    };

    const first = setSessionCookies(firstResponse, session, { secure: true });
    const second = setSessionCookies(secondResponse, session, { secure: true });

    expect(first).not.toBe(second);
    expect(firstResponse.headers.get('Set-Cookie')[2]).toContain(`${COOKIE_NAMES.csrf}=${first}`);
    expect(secondResponse.headers.get('Set-Cookie')[2]).toContain(`${COOKIE_NAMES.csrf}=${second}`);
  });

  it('cancella tutti i cookie usando gli stessi path', () => {
    const res = responseDouble();
    clearSessionCookies(res, { secure: true });
    const cookies = res.headers.get('Set-Cookie');
    expect(cookies).toHaveLength(3);
    expect(cookies.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
    expect(cookies[1]).toContain('Path=/api/auth');
  });

  it('accetta solo Origin esplicitamente configurati in produzione', () => {
    const env = { NODE_ENV: 'production', APP_ORIGIN: 'https://vino.example' };
    expect(assertSameOrigin({ method: 'POST', headers: { origin: 'https://vino.example' } }, { env }))
      .toBe(true);
    expect(() => assertSameOrigin({
      method: 'POST',
      headers: { origin: 'https://evil.example' }
    }, { env })).toThrow(HttpSecurityError);
    expect(() => assertSameOrigin({ method: 'POST', headers: {} }, {
      env: { NODE_ENV: 'production' }
    })).toThrow(HttpSecurityError);
  });

  it('richiede corrispondenza costante tra cookie e header CSRF', () => {
    const base = {
      method: 'POST',
      headers: {
        origin: 'https://vino.example',
        cookie: `${HOST_COOKIE_NAMES.csrf}=same-token`,
        'x-csrf-token': 'same-token'
      }
    };
    expect(assertCsrf(base, {
      env: { NODE_ENV: 'production', APP_ORIGIN: 'https://vino.example' }
    })).toBe(true);
    expect(() => assertCsrf({
      ...base,
      headers: { ...base.headers, 'x-csrf-token': 'different' }
    }, { env: { APP_ORIGIN: 'https://vino.example' } })).toThrow(HttpSecurityError);
  });

  it('considera trusted gli header IP soltanto dentro Vercel', () => {
    const req = {
      headers: { 'x-vercel-forwarded-for': '203.0.113.4, 10.0.0.1' },
      socket: { remoteAddress: '127.0.0.1' }
    };
    expect(getTrustedClientIp(req, {})).toBe('127.0.0.1');
    expect(getTrustedClientIp(req, { VERCEL: '1' })).toBe('203.0.113.4');
  });

  it('applica CSP enforcing e header senza CORS permissivo', () => {
    const res = responseDouble();
    applySecurityHeaders(res, { env: { NODE_ENV: 'production' } });
    expect(res.headers.get('Content-Security-Policy')).toBe(CONTENT_SECURITY_POLICY);
    expect(CONTENT_SECURITY_POLICY).toContain(`object-src 'none'`);
    expect(CONTENT_SECURITY_POLICY).toContain(`connect-src 'self'`);
    expect(CONTENT_SECURITY_POLICY).not.toContain('supabase.co');
    expect(CONTENT_SECURITY_POLICY).not.toContain(`'unsafe-eval'`);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');
    expect(res.headers.has('Access-Control-Allow-Origin')).toBe(false);
  });

  it('mantiene gli header Vercel allineati agli helper runtime', () => {
    const headers = Object.fromEntries(
      vercelConfig.headers[0].headers.map(({ key, value }) => [key, value])
    );
    expect(headers['Content-Security-Policy']).toBe(CONTENT_SECURITY_POLICY);
    expect(headers['Strict-Transport-Security']).toContain('includeSubDomains');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
  });
});
