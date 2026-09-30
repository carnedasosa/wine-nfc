// Riproduzioni isolate: nessun accesso al DB, invio email o chiamata di rete.
// Eseguire dalla root: node --experimental-vm-modules docs/audit-2026-09-29/reproduce.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const results = {};

async function main() {
  const location = { href: 'https://audit.example/?eventId=11111111-1111-4111-8111-111111111111&vino=v1' };
  Object.defineProperty(location, 'search', { get: () => new URL(location.href).search });
  const routerContext = vm.createContext({ URL, URLSearchParams, document: { title: 'Audit' }, window: {
    location, history: { replaceState(_state, _title, url) { location.href = url; } }
  } });
  const router = new vm.SourceTextModule(read('src/router.js'), { context: routerContext });
  await router.link(() => { throw new Error('Unexpected import'); });
  await router.evaluate();
  const before = router.namespace.getVinoFromURL();
  router.namespace.cleanURL();
  const after = router.namespace.getVinoFromURL();
  assert.equal(after.eventId, 'legacy-event-id');
  results.eventRouting = { before, urlAfterOpeningWine: location.href, parametersOnReload: after };

  // IndexedDB double: riproduce soltanto le operazioni asincrone usate dall'outbox.
  const rows = new Map();
  const sent = [];
  let currentUser = 'utente-A';
  const db = { transaction() {
    const tx = { objectStore() { return {
      put(row) { rows.set(row.idempotencyKey, row); queueMicrotask(() => tx.oncomplete?.()); },
      delete(key) { rows.delete(key); queueMicrotask(() => tx.oncomplete?.()); },
      getAll() { const request = {}; queueMicrotask(() => { request.result = [...rows.values()]; request.onsuccess?.(); }); return request; }
    }; } }; return tx;
  } };
  const context = vm.createContext({ navigator: { onLine: true }, console, indexedDB: { open() {
    const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess?.(); }); return request;
  } } });
  const apiModule = new vm.SyntheticModule(['API'], function () {
    this.setExport('API', { saveTasting: async payload => sent.push({ sessionUser: currentUser, payload }) });
  }, { context });
  await apiModule.link(() => {}); await apiModule.evaluate();
  const outbox = new vm.SourceTextModule(read('src/outbox.js'), {
    context, importModuleDynamically: async () => apiModule
  });
  await outbox.link(() => {}); await outbox.evaluate();
  const payload = { eventId: 'legacy-event-id', wineId: 'v1', acidita: 3, corpo: 3, persistenza: 3,
    emozione: 'Pace', idempotencyKey: '22222222-2222-4222-8222-222222222222' };
  await outbox.namespace.saveTastingToOutbox(payload);
  currentUser = 'utente-B';
  await outbox.namespace.flushOutbox();
  assert.equal(sent[0].sessionUser, 'utente-B');
  results.outboxOwnership = { enqueuedBy: 'utente-A', sent, pendingAfterSync: rows.size };

  // Esegue il vero handler, sostituendo auth, limiter e database con double in memoria.
  let record;
  const upserts = [];
  const prismaDouble = { tasting: { upsert: async args => {
    upserts.push(args);
    record = record ? { ...record, ...args.update, version: record.version + args.update.version.increment }
      : { id: 'audit-tasting', version: 1, ...args.create };
    return { ...record };
  } } };
  const handlerModule = { exports: {} };
  const fakeRequire = name => {
    if (name === '../lib/prisma') return prismaDouble;
    if (name === '../lib/auth') return { withAuth: handler => handler };
    if (name === '../lib/rate-limit') return { enforceRateLimit: async () => true };
    if (name === '../lib/logger') return { getRequestId: () => 'audit', logInfo() {}, logError() {} };
    return require(path.resolve(root, 'api', name));
  };
  vm.runInThisContext('(function(require,module,exports){' + read('api/tastings.js') + '\n})')(
    fakeRequire, handlerModule, handlerModule.exports);
  async function save(body) {
    const res = { statusCode: 200, setHeader() {}, status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; } };
    await handlerModule.exports({ method: 'POST', headers: {}, body, userId: 'audit-user', authSubject: 'audit-subject' }, res);
    assert.equal(res.statusCode, 201); return { version: res.data.version, acidita: res.data.acidita };
  }
  const first = await save(payload);
  const duplicate = await save(payload);
  const newer = await save({ ...payload, acidita: 5, idempotencyKey: '33333333-3333-4333-8333-333333333333' });
  const staleRetry = await save(payload);
  assert.equal(duplicate.version, 2);
  assert.equal(staleRetry.acidita, 3);
  results.idempotency = { first, duplicate, newer, staleRetry, upsertCalls: upserts.length,
    note: 'Nessuna query a Event, EventWine o EventParticipant richiesta dal vero handler.' };
  fs.writeFileSync(path.join(__dirname, 'reproductions.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
