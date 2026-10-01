// Solo staging: sessioni ottenute con accesso reale e conservate in un file locale non versionato.
const fs = require('node:fs');
const crypto = require('node:crypto');
const target = new URL(process.env.LOAD_TEST_URL || 'http://127.0.0.1:3101');
if (process.env.LOAD_TEST_ENVIRONMENT !== 'staging') throw new Error('Impostare LOAD_TEST_ENVIRONMENT=staging soltanto per un ambiente di collaudo');
const eventId = process.env.LOAD_TEST_EVENT_ID;
if (!eventId) throw new Error('Evento di collaudo richiesto');
const sessions = JSON.parse(fs.readFileSync(process.env.LOAD_TEST_SESSIONS_FILE, 'utf8'));
const arrivals = Number(process.env.LOAD_TEST_ARRIVALS || 100);
const intervalMs = Number(process.env.LOAD_TEST_INTERVAL_MS || 6000); // 600 nuovi utenti/ora
if (!Number.isSafeInteger(arrivals) || arrivals < 1 || arrivals > 2000 || !Number.isSafeInteger(intervalMs) || intervalMs < 500) throw new Error('Profilo carico non valido');
if (!Array.isArray(sessions) || sessions.length < arrivals || new Set(sessions.map(s=>s.cookie)).size !== sessions.length) throw new Error('Servono sessioni distinte per tutti gli arrivi');
const metrics = [];
async function call(route, session, body) {
  const started = performance.now();
  let status = 0;
  try {
    const cookie = session.cookie;
    const csrf = cookie.split(';').map(s=>s.trim()).find(s=>/^(?:__Host-vino-csrf|vino_csrf)=/.test(s))?.split('=').slice(1).join('=');
    const response = await fetch(new URL(route,target), { method: body ? 'POST' : 'GET',
      headers: { Cookie: cookie, Origin: target.origin, 'Content-Type': 'application/json', 'X-CSRF-Token': decodeURIComponent(csrf || '') },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), redirect: 'error' });
    status = response.status;
    if (!response.ok) throw new Error('HTTP_' + status);
    return await response.json();
  } finally { metrics.push({ route: route.split('?')[0], status, ms: Math.round(performance.now()-started) }); }
}
async function visitor(session) {
  const catalog = await call('/api/wines?eventId='+encodeURIComponent(eventId),session);
  if (catalog.event?.id !== eventId || !catalog.event.open || !catalog.wines?.length) throw new Error('Catalogo evento non utilizzabile');
  const tastings = await call('/api/tastings?eventId='+encodeURIComponent(eventId),session);
  const wineId = catalog.wines[0].id;
  const baseVersion = tastings.find(t=>t.wineId===wineId)?.version || 0;
  const body = { eventId, wineId, baseVersion, idempotencyKey: crypto.randomUUID(), acidita: 3, corpo: 3, persistenza: 3, emozione: 'Pace' };
  const saved = await call('/api/tastings',session,body);
  if (saved.wineId !== wineId || saved.eventId !== eventId || saved.version !== baseVersion+1) throw new Error('Salvataggio incoerente');
  const replay = await call('/api/tastings',session,body);
  if (replay.id !== saved.id || replay.version !== saved.version) throw new Error('Duplicazione assaggio');
  await call('/api/leaderboard?eventId='+encodeURIComponent(eventId),session);
  // DNA può consumare budget reale: abilitarlo esplicitamente nel collaudo del provider.
  if (process.env.LOAD_TEST_AI === 'true') await call('/api/dna',session,{ eventId });
}
async function main() {
  const runs = [];
  for (let index=0; index<arrivals; index++) {
    runs.push(visitor(sessions[index]).then(()=>true,()=>false));
    if (index<arrivals-1) await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
  const results = await Promise.all(runs);
  const routes = {};
  for (const route of new Set(metrics.map(m=>m.route))) {
    const rows = metrics.filter(m=>m.route===route), times=rows.map(m=>m.ms).sort((a,b)=>a-b);
    routes[route] = { requests: rows.length, errors: rows.filter(m=>m.status<200||m.status>=300).length, p95Ms: times[Math.ceil(times.length*.95)-1] };
  }
  const failed = results.filter(r=>!r).length;
  const report = { executedAt: new Date().toISOString(), arrivals, intervalMs, flowsFailed: failed, routes, excludes: ['Invio e ricezione OTP', 'Latenza e rendering su telefoni reali'] };
  console.log(JSON.stringify(report,null,2));
  fs.mkdirSync('output/quality', { recursive: true });
  fs.writeFileSync('output/quality/staging-load-result.json',JSON.stringify(report,null,2));
  if (failed || Object.values(routes).some(r=>r.p95Ms>3000||r.errors)) process.exitCode=1;
}
main().catch(error=>{ console.error(error.name); process.exitCode=1; });
