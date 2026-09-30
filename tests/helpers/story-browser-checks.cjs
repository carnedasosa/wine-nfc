// Run with a locally available Playwright module (NODE_PATH) and the fixture server on :4173.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
  const output = path.resolve('output/story-verification');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.STORY_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', acceptDownloads: true });
  const page = await context.newPage();
  const failures = []; const checks = []; const timings = [];
  page.on('pageerror', error => failures.push(error.message));
  const ready = () => page.waitForFunction(() => !document.getElementById('story-share-btn').disabled && document.getElementById('story-status').textContent === 'La tua storia è pronta.');
  const canvas = () => page.locator('#story-preview').evaluate(c => c.toDataURL());
  async function check(name, run) { await run(); checks.push(name); console.log('PASS ' + name); }
  async function openDna() {
    await page.getByRole('button', { name: 'Wine DNA', exact: true }).click();
    await page.getByRole('button', { name: 'Crea la tua storia ↗', exact: true }).click();
    await ready();
  }
  try {
    await page.goto('http://127.0.0.1:4173');
    await page.getByRole('button', { name: 'Salta tutorial' }).click();
    await page.route('**/api/dna', async route => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ dnaText: 'Analisi dimostrativa', stats: { tags: ['Energia'], cantine: [], averages: { acidita: 3, corpo: 3, persistenza: 4 } } }) });
    }, { times: 1 });
    await openDna();
    await check('Storia pronta mentre il testo AI è ancora in elaborazione', async () => {
      assert((await page.locator('#dna-content').textContent()).includes('analizzando'));
    });
    await check('Anteprima 1080 × 1920 e azioni visibili su mobile', async () => {
      assert.deepEqual(await page.locator('#story-preview').evaluate(c => [c.width, c.height]), [1080, 1920]);
      const rect = await page.locator('#story-share-btn').boundingBox();
      assert(rect.y >= 0 && rect.y + rect.height <= 844);
      await page.screenshot({ path: path.join(output, 'mobile.png') });
    });
    await check('Download reale del PNG', async () => {
      const downloading = page.waitForEvent('download', { timeout: 8000 });
      await page.locator('#story-save-btn').click();
      const download = await downloading;
      assert.equal(download.suggestedFilename(), 'sovranaturale-wine-dna.png');
      const filePath = path.join(output, 'story-alex.png'); await download.saveAs(filePath);
      const png = await fs.readFile(filePath);
      assert.equal(png.subarray(1, 4).toString(), 'PNG');
      assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1920);
    });
    await check('Tre composizioni distinte e cambi senza richieste API', async () => {
      let apiCalls = 0;
      const onRequest = request => { if (request.url().includes('/api/')) apiCalls++; };
      page.on('request', onRequest);
      const variants = new Set();
      for (let i = 0; i < 3; i++) {
        variants.add(await canvas());
        const start = Date.now(); await page.locator('#story-next-btn').click(); await ready(); timings.push(Date.now() - start);
      }
      assert.equal(variants.size, 3); assert.equal(apiCalls, 0); page.off('request', onRequest);
    });
    await check('Sei palette e ultime scelte rispettate durante cambi rapidi', async () => {
      const hashes = new Set();
      for (const id of ['energia', 'sorpresa', 'pace', 'radici', 'nostalgia', 'complessita']) {
        await page.locator(`[data-story-theme="${id}"]`).click(); await ready(); hashes.add(await canvas());
      }
      assert.equal(hashes.size, 6);
      await page.evaluate(() => {
        document.querySelector('[data-story-theme="energia"]').click();
        document.querySelector('[data-story-theme="pace"]').click();
        document.querySelector('[data-story-theme="radici"]').click();
      });
      await ready(); assert.equal(await page.locator('#story-theme-label').textContent(), 'Radici');
    });
    await check('Nome nascosto, dettagli e preferenze persistenti', async () => {
      await page.locator('#story-show-name').uncheck(); await ready();
      assert(!(await page.locator('#story-preview').getAttribute('aria-label')).includes('Alex'));
      await page.locator('#story-show-details').check(); await ready();
      const before = await canvas();
      await page.locator('#story-close-btn').click();
      await page.locator('#share-dna-btn').click(); await ready(); assert.equal(await canvas(), before);
      await page.reload(); await openDna();
      assert.equal(await page.locator('#story-show-name').isChecked(), false);
      assert.equal(await page.locator('#story-show-details').isChecked(), true);
      assert.equal(await page.locator('#story-theme-label').textContent(), 'Radici');
      assert.equal(await canvas(), before);
    });
    await check('Condivisione nativa con PNG pronto e annullamento senza errore', async () => {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
          window.__sharedStory = { title: data.title, size: data.files[0].size, type: data.files[0].type, name: data.files[0].name, active: navigator.userActivation.isActive };
          throw new DOMException('Canceled', 'AbortError');
        } });
      });
      await page.locator('#story-share-btn').click();
      const shared = await page.evaluate(() => window.__sharedStory);
      assert(shared.active); assert(shared.size > 1000); assert.equal(shared.type, 'image/png');
      assert(shared.title.includes('Sovranaturale')); assert(!shared.title.includes('Passport'));
      await ready();
    });
    await check('Errore di condivisione recuperabile con salvataggio', async () => {
      await page.evaluate(() => Object.defineProperty(navigator, 'share', { configurable: true, value: async () => { throw new Error('Unavailable'); } }));
      await page.locator('#story-share-btn').click();
      await page.waitForFunction(() => document.getElementById('story-status').textContent.includes('Salva immagine'));
      assert.equal(await page.locator('#story-save-btn').isDisabled(), false);
    });
    await check('Fallback di condivisione salva il PNG quando Web Share non è disponibile', async () => {
      await page.evaluate(() => Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }));
      const downloading = page.waitForEvent('download');
      await page.locator('#story-share-btn').click();
      assert.equal((await downloading).suggestedFilename(), 'sovranaturale-wine-dna.png');
    });
    await check('Esportazione fallita non lascia condividere il PNG precedente e può essere ritentata', async () => {
      await page.evaluate(() => {
        window.__nativeStoryToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function(callback) { callback(null); };
      });
      await page.locator('#story-next-btn').click();
      await page.locator('#story-retry-btn').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#story-share-btn').isDisabled(), true);
      assert.equal(await page.locator('#story-save-btn').isDisabled(), true);
      await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.__nativeStoryToBlob; });
      await page.locator('#story-retry-btn').click(); await ready();
    });
    await check('Profili differenti, singolo assaggio e nomi lunghi', async () => {
      for (const [name, emotions, file] of [
        ['Giulia', ['Pace', 'Radici'], 'story-giulia.png'],
        ['Marco', ['Nostalgia', 'Complessità'], 'story-marco.png'],
        ['Alessandra Maria Francesca Della Valle '.repeat(2), ['Sorpresa'], 'story-long-name.png']
      ]) {
        await page.evaluate(async ({ name, emotions }) => {
          const { state } = await import('/src/state.js');
          const { createStoryModel } = await import('/src/story-model.js');
          const { configureStory, openStory } = await import('/src/ui/story.js');
          state.utente = { id: name, nome: name };
          state.assaggi = emotions.map(emozione => ({ emozione, acidita: 3, corpo: 4, persistenza: 2 }));
          configureStory(createStoryModel({ userId: name, eventId: state.eventId, name, tastings: state.assaggi })); openStory();
        }, { name, emotions });
        await ready();
        const encoded = (await canvas()).split(',')[1]; await fs.writeFile(path.join(output, file), Buffer.from(encoded, 'base64'));
        assert.equal(await page.locator('#story-show-name').isChecked(), true);
        assert.equal(await page.locator('#story-show-details').isChecked(), false);
      }
      assert((await page.locator('#story-summary').textContent()).includes('primo assaggio'));
    });
    await check('Layout stretto e desktop senza overflow, pulsanti sempre raggiungibili', async () => {
      for (const viewport of [{ width: 320, height: 568 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(viewport);
        await page.locator('.story-workspace').evaluate(e => { e.scrollTop = 0; });
        const rect = await page.locator('#story-share-btn').boundingBox();
        assert(rect.y >= 0 && rect.y + rect.height <= viewport.height);
        assert(await page.locator('#story-dialog').evaluate(d => d.scrollWidth <= d.clientWidth));
        await page.screenshot({ path: path.join(output, viewport.width === 320 ? 'mobile-small.png' : 'desktop.png') });
      }
    });
    await check('Nessun dato personale o PNG dopo logout durante un rendering', async () => {
      await page.evaluate(async () => {
        const nativeBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = function(callback, ...rest) { nativeBlob.call(this, blob => setTimeout(() => callback(blob), 150), ...rest); };
        document.getElementById('story-next-btn').click();
        const { clearUserState } = await import('/src/state.js'); const { clearDnaCache } = await import('/src/ui/dna.js');
        clearUserState(); clearDnaCache();
      });
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#story-dialog').evaluate(d => d.open), false);
      assert.equal(await page.locator('#story-preview').getAttribute('aria-label'), null);
      assert.equal(await page.locator('#story-save-btn').isDisabled(), true);
    });
    await check('Nessun assaggio: creazione disabilitata', async () => {
      await page.evaluate(async () => { const { state } = await import('/src/state.js'); state.utente = { id: 'empty', nome: 'Empty' }; state.assaggi = []; const { renderDNA } = await import('/src/ui/dna.js'); await renderDNA(); });
      assert.equal(await page.locator('#share-dna-btn').isDisabled(), true);
    });
    await check('Storage bloccato e illustrazione non disponibile: errore recuperabile', async () => {
      const isolated = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      const recovery = await isolated.newPage();
      await recovery.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } }));
      await recovery.route('**/assets/story/bottle.png', route => route.abort());
      await recovery.goto('http://127.0.0.1:4173');
      await recovery.getByRole('button', { name: 'Salta tutorial' }).click();
      await recovery.getByRole('button', { name: 'Wine DNA', exact: true }).click();
      await recovery.locator('#share-dna-btn').click();
      await recovery.locator('#story-retry-btn').waitFor({ state: 'visible' });
      assert.equal(await recovery.locator('#story-save-btn').isDisabled(), true);
      await recovery.unroute('**/assets/story/bottle.png');
      await recovery.locator('#story-retry-btn').click();
      await recovery.waitForFunction(() => !document.getElementById('story-share-btn').disabled);
      await recovery.locator('[data-story-theme="pace"]').click();
      await recovery.waitForFunction(() => !document.getElementById('story-share-btn').disabled);
      await recovery.locator('#story-close-btn').click(); await recovery.locator('#share-dna-btn').click();
      await recovery.waitForFunction(() => !document.getElementById('story-share-btn').disabled);
      assert.equal(await recovery.locator('#story-theme-label').textContent(), 'Pace');
      await isolated.close();
    });
    assert.deepEqual(failures, []);
    await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify({ checks, warmPreviewMs: timings, pageErrors: failures }, null, 2));
    console.log(JSON.stringify({ checks: checks.length, warmPreviewMs: timings, pageErrors: failures }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
