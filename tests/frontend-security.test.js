import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(target) : [target];
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('regressioni statiche M1', () => {
  it('non contiene handler inline o script inline', () => {
    const html = read('index.html');
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/i);
  });

  it('non espone dati dinamici a innerHTML o funzioni globali', () => {
    const files = [path.join(root, 'app.js'), ...sourceFiles(path.join(root, 'src'))];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/\.innerHTML\b/);
      expect(source, file).not.toMatch(/Object\.assign\s*\(\s*window/);
    }
  });

  it('non conserva né invia più JWT applicativi dal browser', () => {
    const source = [read('app.js'), ...sourceFiles(path.join(root, 'src')).map(file =>
      fs.readFileSync(file, 'utf8')
    )].join('\n');
    expect(source).not.toMatch(/Authorization\s*[:=].*Bearer/i);
    expect(source).not.toMatch(/localStorage.*token|token.*localStorage/i);
    expect(source).not.toMatch(/(?:localStorage|storage)\.(?:setItem|getItem)\s*\(\s*['\x22`]vinoPassport/i);
    expect(read('src/state.js')).toMatch(/removeItem\(key\)/);
    expect(read('src/state.js')).toContain('vinoPassportToken');
    expect(read('src/state.js')).toContain('vinoPassportState');
  });

  it('applica SRI alla sola dipendenza JavaScript CDN', () => {
    const html = read('index.html');
    expect(html).toContain('html2canvas/1.4.1/html2canvas.min.js');
    expect(html).toMatch(/integrity=\x22sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H\x22/);
    expect(html).toMatch(/crossorigin=\x22anonymous\x22/);
  });

  it('rende la email verificata non modificabile dal profilo', () => {
    const html = read('index.html');
    expect(html).toMatch(/id=\x22settings-email\x22[^>]*\breadonly\b/);
  });

  it('rimuove endpoint e dipendenza JWT legacy', () => {
    expect(fs.existsSync(path.join(root, 'api', 'auth.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'api', 'auth', 'login.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'api', 'middleware', 'auth.js'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'api', 'users.js'))).toBe(false);
    expect(read('package.json')).not.toMatch(/jsonwebtoken/);
  });

  it('invalida la cache che poteva contenere il login legacy', () => {
    const worker = read('service-worker.js');
    expect(worker).toContain('vino-passport-static-v6-m2');
    expect(worker).toContain('/src/ui/onboarding.js');
    expect(worker).toContain('self.skipWaiting()');
    expect(worker).toContain('self.clients.claim()');
    expect(worker).toContain('client.navigate(client.url)');
  });

  it('cancella gli artefatti Wine DNA e invalida le generazioni pendenti al cambio sessione', () => {
    const dna = read('src/ui/dna.js');
    const app = read('app.js');
    const settings = read('src/ui/settings.js');

    expect(dna).toMatch(/export function clearDnaCache\(\)/);
    expect(dna).toMatch(/generation !== dnaGeneration \|\| state\.utente\.id !== userId/g);
    expect(app).toMatch(/clearUserState\(\);\s*clearDnaCache\(\);/);
    expect(settings).toMatch(/clearUserState\(\);\s*clearDnaCache\(\);/);
  });
});
