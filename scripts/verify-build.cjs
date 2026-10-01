// Verifica l'artifact che sarà servito, senza inizializzare app, DB o provider.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const allowed = new Set(['index.html', 'style.css', 'app.js', 'manifest.json', 'service-worker.js', 'privacy.html', 'src', 'assets']);
for (const entry of fs.readdirSync(dist)) assert.ok(allowed.has(entry), `File pubblico inatteso: ${entry}`);
const listeners = {};
let installed;
const worker = fs.readFileSync(path.join(dist, 'service-worker.js'), 'utf8');
vm.runInNewContext(worker, {
  URL,
  self: { addEventListener: (event, fn) => { listeners[event] = fn; } },
  caches: { open: async name => {
    assert.match(name, /^vino-passport-static-v7-fiera-[a-f0-9]{12}$/);
    return { addAll: async assets => { installed = [...assets]; } };
  } }
});
let installation;
listeners.install({ waitUntil: promise => { installation = promise; } });
installation.then(() => {
  const cached = new Set(installed.map(asset => new URL(asset, 'https://fixture.test').pathname));
  for (const asset of cached) {
    assert.ok(!asset.startsWith('/api/'), 'API nel precache');
    const target = path.join(dist, asset === '/' ? 'index.html' : asset);
    assert.ok(fs.statSync(target).isFile(), `Asset mancante: ${asset}`);
  }
  const visited = new Set();
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    assert.ok(file.startsWith(dist + path.sep), 'Import fuori dall’artifact');
    assert.ok(cached.has('/' + path.relative(dist, file).replaceAll('\\', '/')), `Modulo fuori dal precache: ${file}`);
    const source = fs.readFileSync(file, 'utf8');
    // Il progetto usa import relativi letterali, inclusi gli import dinamici.
    const imports = source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.[^'"]+)['"]/g);
    for (const match of imports) visit(path.resolve(path.dirname(file), match[1]));
  }
  visit(path.join(dist, 'app.js'));
  for (const doc of ['README.md', 'docs/PIANO_QUALITA_SOFTWARE.md', 'docs/RUNBOOK_RELEASE_FIERA.md']) {
    for (const [, href] of fs.readFileSync(path.join(root, doc), 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
      if (/^(?:https?:|#)/.test(href)) continue;
      const destination = href.split('#')[0];
      assert.ok(fs.existsSync(path.resolve(root, path.dirname(doc), destination)), `Link locale interrotto in ${doc}: ${href}`);
    }
  }
  console.log(`Artifact verificato: ${visited.size} moduli nel precache, asset disponibili e link documentali validi.`);
}).catch(error => { console.error(error.message); process.exitCode = 1; });
