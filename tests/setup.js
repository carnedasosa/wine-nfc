import { afterEach, beforeEach, expect, vi } from 'vitest';

// Prima degli import applicativi: Prisma può caricare .env durante l'import.
// Valori vuoti espliciti impediscono a dotenv di ereditare credenziali locali.
const environment = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/vino_unit_test',
  DIRECT_URL: 'postgresql://test:test@127.0.0.1:1/vino_unit_test',
  SUPABASE_URL: 'https://auth.example.test',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: '',
  SUPABASE_ANON_KEY: '',
  APP_ORIGIN: 'https://app.example.test',
  ACTIVE_EVENT_ID: '',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  RATE_LIMIT_KEY_SECRET: '',
  AI_ENABLED: 'false',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'test-model',
  MAINTENANCE_MODE: 'false',
  VERCEL: '',
  VERCEL_ENV: '',
  VERCEL_URL: '',
  VERCEL_BRANCH_URL: '',
  VERCEL_PROJECT_PRODUCTION_URL: ''
};
for (const profile of ['OTP_IP', 'OTP_EMAIL', 'OTP_VERIFY_IP', 'OTP_VERIFY_EMAIL', 'TASTING_USER', 'DNA_USER', 'DNA_EVENT', 'LEADERBOARD_IP']) {
  environment[`RATE_LIMIT_${profile}`] = '';
  environment[`RATE_LIMIT_${profile}_WINDOW_SECONDS`] = '';
}
Object.assign(process.env, environment);

let unexpectedRequests;
beforeEach(() => {
  Object.assign(process.env, environment);
  unexpectedRequests = [];
  vi.stubGlobal('fetch', vi.fn(async input => {
    // Non includere query, header o body nella diagnostica.
    const url = new URL(typeof input === 'string' ? input : input.url, environment.APP_ORIGIN);
    const destination = `${url.origin}${url.pathname}`;
    unexpectedRequests.push(destination);
    throw new Error(`Richiesta HTTP non simulata: ${destination}`);
  }));
});

afterEach(() => {
  vi.useRealTimers();
  // Anche se il codice applicativo cattura l'errore, il test deve fallire.
  expect(unexpectedRequests, 'Tutte le richieste HTTP dei test unitari devono essere simulate').toEqual([]);
});
