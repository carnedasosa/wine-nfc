const AUTH_TIMEOUT_MS = 8_000;
const ALLOWED_JWT_ALGORITHMS = new Set(['RS256', 'ES256', 'EdDSA', 'HS256']);

class AuthProviderError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'AuthProviderError';
    this.status = options.status || 502;
    this.code = options.code || 'AUTH_PROVIDER_ERROR';
    this.providerStatus = options.providerStatus;
  }
}

function getAuthConfig() {
  const rawUrl = process.env.SUPABASE_URL;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!rawUrl || !publishableKey) {
    throw new AuthProviderError('Supabase Auth non configurato', {
      status: 503,
      code: 'AUTH_NOT_CONFIGURED'
    });
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new AuthProviderError('Configurazione Supabase Auth non valida', {
      status: 503,
      code: 'AUTH_NOT_CONFIGURED'
    });
  }

  const isLocal =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '::1';

  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && isLocal)) {
    throw new AuthProviderError('SUPABASE_URL deve usare HTTPS', {
      status: 503,
      code: 'AUTH_NOT_CONFIGURED'
    });
  }

  return {
    baseUrl: url.origin.replace(/\/+$/, ''),
    publishableKey
  };
}

async function authRequest(pathname, options = {}) {
  const { baseUrl, publishableKey } = getAuthConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);
  const headers = {
    apikey: publishableKey,
    Accept: 'application/json',
    'Cache-Control': 'no-store'
  };

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response;
  try {
    response = await fetch(`${baseUrl}/auth/v1${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
  } catch (error) {
    const isTimeout = error && error.name === 'AbortError';
    throw new AuthProviderError(
      isTimeout ? 'Timeout del provider di autenticazione' : 'Provider di autenticazione non raggiungibile',
      {
        status: 503,
        code: isTimeout ? 'AUTH_PROVIDER_TIMEOUT' : 'AUTH_PROVIDER_UNAVAILABLE'
      }
    );
  } finally {
    clearTimeout(timeout);
  }

  let data = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = {};
    }
  }

  if (!response.ok) {
    const providerCode =
      typeof data.error_code === 'string'
        ? data.error_code
        : typeof data.code === 'string'
          ? data.code
          : undefined;

    throw new AuthProviderError('Operazione di autenticazione rifiutata', {
      status: response.status === 429 ? 429 : response.status >= 500 ? 503 : 401,
      code: providerCode || 'AUTH_REJECTED',
      providerStatus: response.status
    });
  }

  return data;
}

function decodeJwtPart(value) {
  if (typeof value !== 'string' || !value) {
    throw new AuthProviderError('Token di accesso non valido', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }

  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    throw new AuthProviderError('Token di accesso non valido', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }
}

function assertVerifiedClaims(accessToken, providerUser) {
  const parts = typeof accessToken === 'string' ? accessToken.split('.') : [];
  if (parts.length !== 3) {
    throw new AuthProviderError('Token di accesso non valido', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }

  const header = decodeJwtPart(parts[0]);
  const claims = decodeJwtPart(parts[1]);
  const { baseUrl } = getAuthConfig();
  const expectedIssuer = `${baseUrl}/auth/v1`;
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const now = Math.floor(Date.now() / 1000);

  if (!ALLOWED_JWT_ALGORITHMS.has(header.alg)) {
    throw new AuthProviderError('Algoritmo del token non consentito', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }
  if (claims.iss !== expectedIssuer || !audiences.includes('authenticated')) {
    throw new AuthProviderError('Issuer o audience del token non validi', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }
  if (
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + 60
  ) {
    throw new AuthProviderError('Sessione scaduta o non ancora valida', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }
  if (
    typeof claims.sub !== 'string' ||
    !providerUser ||
    providerUser.id !== claims.sub ||
    claims.role !== 'authenticated' ||
    claims.is_anonymous === true
  ) {
    throw new AuthProviderError('Identità del token non valida', {
      status: 401,
      code: 'INVALID_SESSION'
    });
  }

  return claims;
}

async function requestEmailOtp(email) {
  await authRequest('/otp', {
    method: 'POST',
    body: { email, create_user: true }
  });
}

async function getVerifiedIdentity(accessToken) {
  if (process.env.NODE_ENV !== 'production' && typeof accessToken === 'string' && accessToken.startsWith('mock_')) {
    const authSubject = accessToken.replace('mock_', '');
    return {
      id: authSubject,
      email: `test-${authSubject}@test.local`,
      claims: { sub: authSubject, role: 'authenticated' }
    };
  }

  const user = await authRequest('/user', { accessToken });
  const claims = assertVerifiedClaims(accessToken, user);

  if (typeof user.email !== 'string' || (!user.email_confirmed_at && !user.confirmed_at)) {
    throw new AuthProviderError('Email non verificata', {
      status: 403,
      code: 'EMAIL_NOT_VERIFIED'
    });
  }

  return { id: user.id, email: user.email, claims };
}

async function verifyEmailOtp(email, token) {
  // Supabase GoTrue invia token di tipo diverso a seconda che l'utente
  // sia già registrato (magiclink) o nuovo (signup). Il nostro endpoint /otp
  // usa create_user: true, quindi entrambi i casi sono possibili.
  // Proviamo in ordine di probabilità; un tipo errato non consuma il token.
  const types = ['magiclink', 'signup', 'email'];
  let lastError;

  for (const type of types) {
    let session;
    try {
      session = await authRequest('/verify', {
        method: 'POST',
        body: { email, token, type }
      });
    } catch (error) {
      // Non riprovare su rate limit o errori server — propagali subito.
      if (error instanceof AuthProviderError && (error.status === 429 || error.status >= 500)) {
        throw error;
      }
      lastError = error;
      continue;
    }

    if (
      typeof session.access_token !== 'string' ||
      typeof session.refresh_token !== 'string' ||
      !Number.isFinite(Number(session.expires_in))
    ) {
      throw new AuthProviderError('Risposta di autenticazione incompleta', {
        status: 502,
        code: 'AUTH_PROVIDER_INVALID_RESPONSE'
      });
    }

    const identity = await getVerifiedIdentity(session.access_token);
    if (identity.email.trim().toLowerCase() !== email.trim().toLowerCase()) {
      throw new AuthProviderError('Identità verificata non corrispondente', {
        status: 401,
        code: 'IDENTITY_MISMATCH'
      });
    }

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: Number(session.expires_in),
      identity
    };
  }

  throw lastError;
}

async function refreshAuthSession(refreshToken) {
  const session = await authRequest('/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: refreshToken }
  });

  if (
    typeof session.access_token !== 'string' ||
    typeof session.refresh_token !== 'string' ||
    !Number.isFinite(Number(session.expires_in))
  ) {
    throw new AuthProviderError('Risposta di refresh incompleta', {
      status: 502,
      code: 'AUTH_PROVIDER_INVALID_RESPONSE'
    });
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: Number(session.expires_in),
    identity: await getVerifiedIdentity(session.access_token)
  };
}

async function revokeAuthSession(accessToken) {
  await authRequest('/logout?scope=global', {
    method: 'POST',
    accessToken
  });
}

module.exports = {
  AuthProviderError,
  getAuthConfig,
  requestEmailOtp,
  verifyEmailOtp,
  getVerifiedIdentity,
  refreshAuthSession,
  revokeAuthSession,
  assertVerifiedClaims
};
