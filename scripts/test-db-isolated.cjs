// Test PostgreSQL locale dedicato. Non caricare mai .env o usare DATABASE_URL come fallback.
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) throw new Error('Eseguire solo dal laboratorio locale');
if (!process.env.TEST_DATABASE_URL) throw new Error('Impostare TEST_DATABASE_URL su un database locale dedicato che termini con _test');
let url;
try { url = new URL(process.env.TEST_DATABASE_URL); }
catch { throw new Error('TEST_DATABASE_URL non valida'); }
if (!['postgres:', 'postgresql:'].includes(url.protocol)
  || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  || !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname)) {
  throw new Error('TEST_DATABASE_URL deve usare PostgreSQL loopback e un database con suffisso _test');
}
Object.assign(process.env, {
  DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), NODE_ENV: 'test',
  SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '', SUPABASE_ANON_KEY: '', SUPABASE_SECRET_KEY: '',
  UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', RATE_LIMIT_KEY_SECRET: '',
  GEMINI_API_KEY: '', AI_ENABLED: 'false', MAINTENANCE_MODE: 'false',
  ACTIVE_EVENT_ID: '', APP_ORIGIN: 'http://127.0.0.1:3101'
});
// I provider sono simulati esplicitamente; qualunque richiesta reale è un errore.
let unexpectedHttp = 0;
global.fetch = async () => { unexpectedHttp++; throw new Error('HTTP esterno vietato nel collaudo database'); };
const { PrismaClient } = require('../generated/prisma');
const { saveTasting } = require('../lib/tasting-store');
const { generateDna } = require('../lib/dna-generation');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const namespace = 'wine_check_' + crypto.randomBytes(8).toString('hex');
if (!/^wine_check_[a-f0-9]{16}$/.test(namespace)) throw new Error('Schema non valido');
url.searchParams.set('schema', namespace);
url.searchParams.set('connection_limit', '8');
url.searchParams.set('pool_timeout', '20');
const connection = url.toString();
const admin = new PrismaClient({ datasources: { db: { url: connection } } });
let created = false;
let cleaned = false;
const checks = [];
let applicationDb;
async function main() {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${namespace}"`);
  created = true;
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: connection, DIRECT_URL: connection }, stdio: 'pipe', timeout: 90000
  });
  checks.push('Tutte le migrazioni applicate in schema isolato');
  const event = await admin.event.create({ data: { nome: 'Collaudo isolato', slug: namespace, inizio: new Date(Date.now()-3600000), fine: new Date(Date.now()+3600000), timezone: 'Europe/Rome', stato: 'active' } });
  const wine = await admin.wine.create({ data: { nome: 'Vino test', cantina: 'Test' } });
  const user = await admin.user.create({ data: { nome: 'Test' } });
  await admin.eventWine.create({ data: { eventId: event.id, wineId: wine.id } });
  const original = { eventId: event.id, wineId: wine.id, acidita: 3, corpo: 4, persistenza: 2, emozione: 'Pace', baseVersion: 0, idempotencyKey: crypto.randomUUID() };
  const replies = await Promise.all([saveTasting(admin,user.id,original),saveTasting(admin,user.id,original)]);
  assert.equal(await admin.tasting.count(),1);
  assert.equal(await admin.tastingRequest.count(),1);
  assert.equal(replies[0].tasting.id,replies[1].tasting.id);
  checks.push('Due invii simultanei della stessa richiesta producono un solo assaggio');
  const newer = { ...original, acidita: 5, baseVersion: 1, idempotencyKey: crypto.randomUUID() };
  await saveTasting(admin,user.id,newer);
  const replay = await saveTasting(admin,user.id,original);
  assert.equal(replay.replayed,true);
  assert.equal(replay.tasting.version,1);
  assert.equal((await admin.tasting.findFirst()).acidita,5);
  checks.push('Retry precedente non sovrascrive la modifica successiva');
  await assert.rejects(saveTasting(admin,user.id,{ ...original, idempotencyKey: crypto.randomUUID() }), { code: 'TASTING_VERSION_CONFLICT' });
  await assert.rejects(saveTasting(admin,'other-user',original), { code: 'IDEMPOTENCY_CONFLICT' });
  await admin.eventWine.update({ where: { eventId_wineId: { eventId: event.id, wineId: wine.id } }, data: { attivo: false } });
  await assert.rejects(saveTasting(admin,user.id,{ ...newer, baseVersion: 2, idempotencyKey: crypto.randomUUID() }), { code: 'WINE_NOT_AVAILABLE' });
  await admin.event.update({ where: { id: event.id }, data: { stato: 'closed' } });
  await assert.rejects(saveTasting(admin,user.id,{ ...newer, baseVersion: 2, idempotencyKey: crypto.randomUUID() }), { code: 'EVENT_CLOSED' });
  checks.push('Versioni obsolete, altro proprietario, vino escluso ed evento chiuso vengono rifiutati');
  let calls = 0;
  const dependencies = { env: { AI_ENABLED: 'true', GEMINI_MODEL: 'test-model', GEMINI_API_KEY: 'test-key' }, budget: async () => ({ allowed: true }), fetchImpl: async () => {
    calls++; await new Promise(resolve => setTimeout(resolve,100));
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Testo AI di collaudo' }] } }] }), { status: 200 });
  } };
  const input = { eventId: event.id, userId: user.id, versionHash: 'v1', fallbackText: 'Descrizione', stats: { assaggiCount: 1, averages: { acidita: 5, corpo: 4, persistenza: 2 }, topEmo: ['Pace'] } };
  await Promise.all([generateDna(admin,input,dependencies),generateDna(admin,input,dependencies)]);
  assert.equal(calls,1);
  assert.equal((await generateDna(admin,input,dependencies)).fallback,false);
  checks.push('Due generazioni simultanee richiedono una sola chiamata AI; cache persistente verificata');
  const fallback = await generateDna(admin,{ ...input, versionHash: 'v2' },{ ...dependencies, budget: async () => ({ allowed: false }) });
  assert.equal(fallback.fallback,true); assert.equal(calls,1);
  checks.push('Budget AI esaurito: riepilogo descrittivo senza chiamare il modello');
  process.env.DATABASE_URL = connection;
  process.env.ACTIVE_EVENT_ID = event.id;
  process.env.APP_ORIGIN = 'http://127.0.0.1:3101';
  process.env.AI_ENABLED = 'false';
  process.env.NODE_ENV = 'development';
  await admin.event.update({ where: { id: event.id }, data: { nome: 'Sovranaturale — collaudo', stato: 'active' } });
  await admin.eventWine.update({ where: { eventId_wineId: { eventId: event.id, wineId: wine.id } }, data: { attivo: true } });
  const subject = crypto.randomUUID();
  await admin.user.update({ where: { id: user.id }, data: { authSubject: subject, nome: 'Ada collaudo', email: 'ada@example.test' } });
  applicationDb = require('../lib/prisma');
  const { setSessionCookies } = require('../lib/http-security');
  const routes = { '/api/wines': require('../api/wines'), '/api/tastings': require('../api/tastings'), '/api/participation': require('../api/participation'), '/api/leaderboard': require('../api/leaderboard'), '/api/dna': require('../api/dna'), '/api/health': require('../api/health'), '/api/auth/session': require('../api/auth/session'), '/api/auth/logout': require('../api/auth/logout') };
  const response = () => ({ statusCode: 200, headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(data) { this.data=data; return this; } });
  const request = (method, body) => ({ method, body, query: { eventId: event.id }, headers: { host: '127.0.0.1:3101', origin: process.env.APP_ORIGIN, cookie: 'vino_access=mock_' + subject + '; vino_csrf=test', 'x-csrf-token': 'test' } });
  let res = response();
  await routes['/api/leaderboard'](request('GET'),res);
  assert.equal(res.statusCode,200); assert.deepEqual(res.data,[]);
  res = response();
  await routes['/api/participation'](request('PUT',{ eventId: event.id, nickname: 'Esploratore', consensoLeaderboard: true }),res);
  assert.equal(res.statusCode,200);
  res = response();
  await routes['/api/leaderboard'](request('GET'),res);
  assert.equal(res.statusCode,200); assert.equal(res.data[0].nome,'Esploratore'); assert.equal(res.data[0].tastingsCount,1);
  assert.equal(JSON.stringify(res.data).includes('Ada collaudo'),false);
  assert.match(res.headers['Cache-Control'],/no-store/);
  res = response();
  await routes['/api/participation'](request('PUT',{ eventId: event.id, nickname: '', consensoLeaderboard: false }),res);
  assert.equal(res.statusCode,200);
  res = response(); await routes['/api/leaderboard'](request('GET'),res); assert.deepEqual(res.data,[]);
  checks.push('API reali: classifica vuota senza consenso, nickname dopo opt-in, ritiro immediato e no-store');
  // Il collegamento Magic Link deve preservare un nome già scelto anche nel DB reale.
  const { linkVerifiedIdentity } = require('../lib/user-account');
  const identity = { id: subject, email: 'ada@example.test' };
  const linked = await linkVerifiedIdentity(identity, 'ada', admin, { preserveExistingName: true });
  assert.equal(linked.nome, 'Ada collaudo');
  const exchange = require('../api/auth/exchange');
  res = response();
  await exchange(request('POST', { accessToken: 'mock_' + subject, refreshToken: 'fixture-refresh' }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.user.nome, 'Ada collaudo');
  assert.ok(res.headers['Set-Cookie']);
  checks.push('Magic Link: nome preservato dal servizio e dalla route reale con cookie');

  res = response(); await routes['/api/dna'](request('POST', { eventId: event.id }), res);
  assert.equal(res.statusCode, 200); assert.equal(res.data.fallback, true);
  assert.equal(res.data.stats.averages.acidita, 5);
  assert.ok(res.data.stats.tags.includes('Vini tesi'));
  checks.push('DNA: import ESM da CommonJS, statistiche condivise e cache PostgreSQL');

  const strangers = Array.from({ length: 101 }, () => ({ id: crypto.randomUUID(), nome: 'Privato' }));
  await admin.user.createMany({ data: strangers });
  await admin.eventParticipant.createMany({ data: strangers.map(person => ({ eventId: event.id, userId: person.id, nickname: 'Stesso nickname', consensoLeaderboard: true })) });
  await admin.tasting.createMany({ data: strangers.map(person => ({ eventId: event.id, wineId: wine.id, userId: person.id, acidita: 3, corpo: 3, persistenza: 3, emozione: 'Pace' })) });
  const ranks = [];
  for (let page = 1; page <= 3; page++) {
    const req = request('GET'); req.query = { eventId: event.id, page: String(page), limit: '50' };
    res = response(); await routes['/api/leaderboard'](req, res);
    assert.equal(res.statusCode, 200);
    ranks.push(...res.data.map(row => row.rank));
    assert.equal(JSON.stringify(res.data).includes('Privato'), false);
  }
  assert.deepEqual(ranks, Array.from({ length: 101 }, (_, i) => i + 1));
  checks.push('Classifica reale: 101 partecipanti omonimi, tre pagine e rank continui');
  if (process.argv.includes('--browser')) {
    const express = require('express');
    const app = express(); app.use(express.json());
    for (const [route, handler] of Object.entries(routes)) app.all(route,handler);
    app.put('/api/users/:id',require('../api/users/[id]'));
    app.get('/__fixture/login',(req,res) => {
      setSessionCookies(res,{ accessToken: 'mock_' + subject, refreshToken: 'mock-refresh', expiresIn: 3600 });
      res.redirect('/?eventId=' + event.id);
    });
    app.use(express.static(path.resolve('dist')));
    await new Promise(resolve => {
      const server = app.listen(3101,'127.0.0.1',() => console.log('Fixture browser: http://127.0.0.1:3101/__fixture/login'));
      app.post('/__fixture/stop',(req,res) => { res.json({ stopped: true }); server.close(resolve); });
    });
  }
}
main().then(() => {
  assert.equal(unexpectedHttp, 0, 'Nessuna richiesta HTTP reale consentita');
  console.log(checks.join('\n'));
}).catch(error => {
  // Non riversare stderr del client o credenziali di connessione nei log.
  console.error('Test database fallito:', error.code || error.name);
  if (error.stderr) console.error(String(error.stderr).replace(/postgres(?:ql)?:\/\/\S+/gi, '[URL omesso]'));
  process.exitCode = 1;
}).finally(async () => {
  if (created) {
    if (applicationDb) await applicationDb.$disconnect();
    await admin.$disconnect();
    const cleanup = new PrismaClient({ datasources: { db: { url: connection } }, errorFormat: 'minimal' });
    try {
      await cleanup.$executeRawUnsafe(`DROP SCHEMA "${namespace}" CASCADE`);
      cleaned = true;
      console.log('Schema temporaneo rimosso; schema applicativo invariato.');
    } catch (error) { console.error('Pulizia da completare:', namespace, error.code); process.exitCode = 1; }
    finally { await cleanup.$disconnect(); }
  }
  await admin.$disconnect();
  fs.mkdirSync('output/quality', { recursive: true });
  fs.writeFileSync('output/quality/db-tests.json', JSON.stringify({ executedAt: new Date().toISOString(), passed: !process.exitCode, checks, cleanup: { created, cleaned } }, null, 2));
});
