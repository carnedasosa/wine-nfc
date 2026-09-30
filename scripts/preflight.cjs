require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const { resolveEventId } = require('../lib/event');
const { resolveRateLimit } = require('../lib/rate-limit');
const env = process.env;
const missing = [];
for (const name of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'APP_ORIGIN', 'ACTIVE_EVENT_ID', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'GEMINI_API_KEY', 'GEMINI_MODEL']) {
  if (!env[name]) missing.push(name);
}
for (const name of ['APP_ORIGIN', 'SUPABASE_URL', 'UPSTASH_REDIS_REST_URL']) {
  try { if (new URL(env[name]).protocol !== 'https:') missing.push(name + ': HTTPS richiesto'); }
  catch { if (env[name]) missing.push(name + ': URL non valido'); }
}
try { resolveEventId(undefined, { ...env, NODE_ENV: 'production' }); }
catch { missing.push('ACTIVE_EVENT_ID: evento di produzione valido richiesto'); }
if (env.AI_ENABLED !== 'true') missing.push('AI_ENABLED=true: AI richiesta nella prima release');
if (env.MAINTENANCE_MODE === 'true') missing.push('MAINTENANCE_MODE ancora attiva');
if (env.SUPABASE_SECRET_KEY && !env.SUPABASE_SECRET_KEY.startsWith('sb_secret_')) missing.push('SUPABASE_SECRET_KEY: serve la nuova chiave secret per IP forwarding');
if (/bozza di collaudo/i.test(fs.readFileSync('privacy.html', 'utf8'))) missing.push('Informativa privacy ancora in bozza');
for (const profile of ['OTP_IP', 'OTP_EMAIL', 'OTP_VERIFY_IP', 'OTP_VERIFY_EMAIL', 'TASTING_USER', 'DNA_USER', 'DNA_EVENT']) {
  try { resolveRateLimit(profile); } catch { missing.push('Rate limit non valido: ' + profile); }
}
console.log('Controllo locale della configurazione; non certifica SMTP, DNS, backup o capacità reale.');
if (missing.length) { console.log(missing.map(item => '- Manca/da completare: ' + item).join('\n')); process.exitCode = 1; }
else console.log('Configurazione locale completa. Restano obbligatori i collaudi del runbook.');
