const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
if (process.env.VERCEL_ENV === 'production') {
  require('node:child_process').execFileSync(process.execPath, [path.join(__dirname, 'preflight.cjs')], { cwd: root, stdio: 'inherit' });
}
const output = path.join(root, 'dist');
// Directory fissa sotto il progetto: la build può sostituire soltanto il suo output.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Output non valido');
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'style.css', 'app.js', 'manifest.json', 'service-worker.js', 'privacy.html', 'src', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(output, name), { recursive: true });
}
const hash = require('node:crypto').createHash('sha256');
function hashDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) hashDirectory(target);
    else if (entry.name !== 'service-worker.js') hash.update(path.relative(output, target).replaceAll('\\', '/')).update(fs.readFileSync(target));
  }
}
hashDirectory(output);
const worker = path.join(output, 'service-worker.js');
fs.writeFileSync(worker, fs.readFileSync(worker, 'utf8').replace('vino-passport-static-v7-fiera', 'vino-passport-static-v7-fiera-' + hash.digest('hex').slice(0, 12)));
console.log('Build statica in dist: solo file pubblici.');
