import { afterEach, describe, expect, it, vi } from 'vitest';

const {
  AuthenticationError,
  authenticateRequest,
  withAuth
} = require('../lib/auth');
const { AuthProviderError } = require('../lib/supabase-auth');

const SUBJECT = '11111111-1111-4111-8111-111111111111';
const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Ada',
  email: 'ada@example.com'
};

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

function dependencies(overrides = {}) {
  return {
    getVerifiedIdentity: vi.fn().mockResolvedValue({ id: SUBJECT, email: USER.email }),
    findAccountBySubject: vi.fn().mockResolvedValue(USER),
    ...overrides
  };
}

describe('middleware auth M1', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('ignora completamente Authorization Bearer e rifiuta il JWT legacy', async () => {
    const deps = dependencies();
    const req = {
      method: 'GET',
      headers: { authorization: 'Bearer legacy-jwt' }
    };

    await expect(authenticateRequest(req, deps)).rejects.toBeInstanceOf(AuthenticationError);
    expect(deps.getVerifiedIdentity).not.toHaveBeenCalled();
  });

  it('deriva userId e authSubject soltanto dal cookie verificato e dal mapping provider', async () => {
    const deps = dependencies();
    const req = {
      method: 'GET',
      headers: { cookie: 'vino_access=verified-access' }
    };

    await expect(authenticateRequest(req, deps)).resolves.toEqual(USER);
    expect(deps.getVerifiedIdentity).toHaveBeenCalledWith('verified-access');
    expect(deps.findAccountBySubject).toHaveBeenCalledWith(SUBJECT);
    expect(req.userId).toBe(USER.id);
    expect(req.authSubject).toBe(SUBJECT);
  });

  it('nega un subject verificato che non è collegato a un profilo', async () => {
    const deps = dependencies({ findAccountBySubject: vi.fn().mockResolvedValue(null) });
    const req = { method: 'GET', headers: { cookie: 'vino_access=access' } };

    await expect(authenticateRequest(req, deps)).rejects.toMatchObject({
      code: 'ACCOUNT_NOT_LINKED',
      statusCode: 403
    });
  });

  it('applica Origin e double-submit CSRF prima di una write', async () => {
    vi.stubEnv('APP_ORIGIN', 'https://app.example.com');
    const handler = vi.fn().mockImplementation((req, res) => res.status(204).end());
    const protectedHandler = withAuth(handler, dependencies());

    const rejectedResponse = responseDouble();
    await protectedHandler({
      method: 'POST',
      headers: {
        origin: 'https://app.example.com',
        cookie: 'vino_access=access; vino_csrf=expected'
      }
    }, rejectedResponse);
    expect(rejectedResponse.statusCode).toBe(403);
    expect(rejectedResponse.payload.code).toBe('CSRF_INVALID');
    expect(handler).not.toHaveBeenCalled();

    const acceptedResponse = responseDouble();
    await protectedHandler({
      method: 'POST',
      headers: {
        origin: 'https://app.example.com',
        'x-csrf-token': 'expected',
        cookie: 'vino_access=access; vino_csrf=expected'
      }
    }, acceptedResponse);
    expect(acceptedResponse.statusCode).toBe(204);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('restituisce 503 per provider indisponibile e 401 per token rifiutato', async () => {
    const unavailable = withAuth(vi.fn(), dependencies({
      getVerifiedIdentity: vi.fn().mockRejectedValue(new AuthProviderError('down', {
        status: 503,
        code: 'AUTH_PROVIDER_UNAVAILABLE'
      }))
    }));
    const unavailableResponse = responseDouble();
    await unavailable({ method: 'GET', headers: { cookie: 'vino_access=x' } }, unavailableResponse);
    expect(unavailableResponse.statusCode).toBe(503);
    expect(unavailableResponse.payload.code).toBe('AUTH_PROVIDER_UNAVAILABLE');

    const rejected = withAuth(vi.fn(), dependencies({
      getVerifiedIdentity: vi.fn().mockRejectedValue(new AuthProviderError('invalid', {
        status: 401,
        code: 'INVALID_SESSION'
      }))
    }));
    const rejectedResponse = responseDouble();
    await rejected({ method: 'GET', headers: { cookie: 'vino_access=x' } }, rejectedResponse);
    expect(rejectedResponse.statusCode).toBe(401);
    expect(rejectedResponse.payload.code).toBe('INVALID_SESSION');
  });
});
