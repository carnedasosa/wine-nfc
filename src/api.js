// ═══════════════════════════════════════════════════
// API — client HTTP same-origin con sessione a cookie
// ═══════════════════════════════════════════════════

const CSRF_COOKIE_NAMES = Object.freeze(['__Host-vino-csrf', 'vino_csrf']);
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let refreshInFlight = null;

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

function mapTasting(tasting) {
  return {
    vino: tasting.wine,
    acidita: tasting.acidita,
    corpo: tasting.corpo,
    persistenza: tasting.persistenza,
    emozione: tasting.emozione,
    timestamp: new Date(tasting.createdAt)
  };
}

function getCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(prefix));

  if (!cookie) return '';

  try {
    return decodeURIComponent(cookie.slice(prefix.length));
  } catch {
    return '';
  }
}

async function readResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  return response.json().catch(() => null);
}

function buildHeaders(method, body, suppliedHeaders = {}) {
  const headers = new Headers(suppliedHeaders);
  headers.set('Accept', 'application/json');

  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (UNSAFE_METHODS.has(method)) {
    const csrfToken = CSRF_COOKIE_NAMES.map(getCookie).find(Boolean);
    if (csrfToken) headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return headers;
}

async function rawFetch(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body;
  const requestBody = body !== undefined
    && body !== null
    && !(body instanceof FormData)
    && typeof body !== 'string'
    ? JSON.stringify(body)
    : body;

  const timeoutMs = options.timeoutMs || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(path, {
      ...options,
      method,
      body: requestBody,
      credentials: 'include',
      headers: buildHeaders(method, body, options.headers),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function refreshSession() {
  if (!CSRF_COOKIE_NAMES.some(name => getCookie(name))) return false;
  if (!refreshInFlight) {
    refreshInFlight = rawFetch('/api/auth/refresh', { method: 'POST' })
      .then(async response => {
        if (response.ok) return true;
        const data = await readResponse(response);
        if (response.status === 401 || response.status === 403) return false;
        throw new ApiError(
          data?.message || 'Rinnovo della sessione non disponibile',
          response.status,
          data || {}
        );
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

function announceExpiredSession() {
  window.dispatchEvent(new CustomEvent('vino:session-expired'));
}

const MAX_RETRIES = 3;
function isIdempotent(method, body) {
  return method === 'GET' || (method === 'POST' && body && body.idempotencyKey);
}

async function request(path, options = {}, config = {}) {
  const {
    retryAuth = true,
    announceAuthFailure = true
  } = config;

  const method = (options.method || 'GET').toUpperCase();
  const idempotent = isIdempotent(method, options.body);
  
  let retries = idempotent ? MAX_RETRIES : 0;
  let delay = 1000;
  let response;
  let lastError;

  while (true) {
    try {
      response = await rawFetch(path, options);

      if (response.status === 401 && retryAuth) {
        const refreshed = await refreshSession();
        if (refreshed) response = await rawFetch(path, options);
      }
      
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429)) {
        break; 
      }
      lastError = new Error(`HTTP Error ${response.status}`);
    } catch (err) {
      lastError = err;
      if (retries === 0 || (err.name !== 'AbortError' && !err.message.includes('network') && !err.message.includes('fetch'))) {
        throw err;
      }
    }

    if (retries > 0) {
      retries--;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    } else {
      if (!response) throw lastError || new Error('Request failed');
      break;
    }
  }

  const data = await readResponse(response);

  if (!response.ok) {
    if (response.status === 401 && announceAuthFailure) {
      announceExpiredSession();
    }

    const message = data?.message || data?.error || 'Richiesta non riuscita';
    throw new ApiError(message, response.status, data || {});
  }

  return data;
}

export const API = {
  async getWines() {
    return request('/api/wines', {}, {
      retryAuth: false,
      announceAuthFailure: false
    });
  },

  async requestOtp(email) {
    return request('/api/auth/request-otp', {
      method: 'POST',
      body: { email }
    }, {
      retryAuth: false,
      announceAuthFailure: false
    });
  },

  async exchangeTokens(accessToken, refreshToken) {
    return request('/api/auth/exchange', {
      method: 'POST',
      body: { accessToken, refreshToken }
    }, {
      retryAuth: false,
      announceAuthFailure: false
    });
  },

  async verifyOtp(nome, email, token) {
    return request('/api/auth/verify-otp', {
      method: 'POST',
      body: { nome, email, token }
    }, {
      retryAuth: false,
      announceAuthFailure: false
    });
  },

  async getSession() {
    return request('/api/auth/session', {}, {
      retryAuth: true,
      announceAuthFailure: false
    });
  },

  async logout() {
    return request('/api/auth/logout', { method: 'POST' }, {
      retryAuth: false,
      announceAuthFailure: false
    });
  },

  async updateUser(id, nome) {
    return request(`/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: { nome }
    });
  },

  async getTastings(eventId) {
    const url = eventId ? `/api/tastings?eventId=${encodeURIComponent(eventId)}` : '/api/tastings';
    const tastings = await request(url);
    return Array.isArray(tastings) ? tastings.map(mapTasting) : [];
  },

  async saveTasting(payload) {
    return request('/api/tastings', {
      method: 'POST',
      body: payload
    });
  },

  async getDNA(eventId) {
    return request('/api/dna', {
      method: 'POST',
      body: { eventId }
    });
  },

  async getLeaderboard() {
    return request('/api/leaderboard');
  }
};
