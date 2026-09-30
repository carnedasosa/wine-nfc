import { state } from '../state.js';
import { downloadBlob, showToast } from '../utils.js';
import { STORY_THEMES, normalizeStoryPreferences, readStoryPreferences, resolveStoryTheme, storyPreferenceKey, writeStoryPreferences } from '../story-model.js';
import { loadStoryResources, renderStoryCanvas, storyCanvasBlob } from '../story-renderer.js';

let model = null;
let preferences = null;
let revision = 0;
let readyFile = null;
let lastFocus = null;
let sharing = false;
let swipeStart = null;
const memoryPreferences = new Map();
const element = id => document.getElementById(id);
const dialog = () => element('story-dialog');

function storage() { try { return localStorage; } catch { return undefined; } }
function isCurrent(snapshot) { return model === snapshot && state.utente.id === snapshot.userId && state.eventId === snapshot.eventId; }
function setBusy(busy) {
  element('story-preview-wrap').setAttribute('aria-busy', String(busy));
  element('story-share-btn').disabled = busy || sharing || !readyFile;
  element('story-save-btn').disabled = busy || sharing || !readyFile;
  document.querySelectorAll('[data-story-theme], #story-prev-btn, #story-next-btn, #story-show-details').forEach(control => { control.disabled = sharing; });
  element('story-show-name').disabled = sharing || !model?.name;
}

export function configureStory(nextModel) {
  clearStory();
  if (!nextModel.userId || !nextModel.count) return;
  model = nextModel;
  const remembered = memoryPreferences.get(storyPreferenceKey(model));
  preferences = remembered ? normalizeStoryPreferences(remembered, model.seed) : readStoryPreferences(model, storage());
  // Cache public assets while the analysis is running. Failures are retried on opening.
  void loadStoryResources().catch(() => {});
}

export function clearStory() {
  revision++;
  model = null; preferences = null; readyFile = null; sharing = false;
  if (!dialog()) return;
  closeStory({ restoreFocus: false });
  const canvas = element('story-preview');
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  canvas.hidden = true;
  canvas.removeAttribute('aria-label');
  element('story-status').textContent = '';
  element('story-summary').textContent = '';
  setBusy(false);
}

function syncControls() {
  const theme = resolveStoryTheme(model, preferences);
  element('story-variant-label').textContent = `Composizione ${preferences.variant + 1} di 3`;
  element('story-theme-label').textContent = preferences.theme === 'auto' ? `${theme.label} · dai tuoi assaggi` : theme.label;
  element('story-show-name').checked = preferences.showName;
  element('story-show-name').disabled = !model.name;
  element('story-show-details').checked = preferences.showDetails;
  document.querySelectorAll('[data-story-theme]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.storyTheme === preferences.theme));
  });
  element('story-summary').textContent = `${model.count === 1 ? 'Il tuo primo assaggio' : `${model.count} assaggi`}${model.emotions.length ? ` · ${model.emotions.join(' e ')}` : ''}`;
}

function remember() {
  const key = storyPreferenceKey(model);
  memoryPreferences.set(key, { ...preferences });
  if (memoryPreferences.size > 30) memoryPreferences.delete(memoryPreferences.keys().next().value);
  writeStoryPreferences(model, preferences, storage());
}

async function updatePreview() {
  if (!model || !isCurrent(model) || !dialog().open) return;
  const snapshot = model;
  const currentRevision = ++revision;
  readyFile = null;
  syncControls(); setBusy(true);
  element('story-status').textContent = 'Prepariamo la tua storia…';
  element('story-retry-btn').hidden = true;
  try {
    const rendered = await renderStoryCanvas(snapshot, { ...preferences });
    const blob = await storyCanvasBlob(rendered);
    if (currentRevision !== revision || !isCurrent(snapshot) || !dialog().open) return;
    const preview = element('story-preview');
    preview.width = rendered.width; preview.height = rendered.height;
    preview.getContext('2d').drawImage(rendered, 0, 0);
    preview.hidden = false;
    preview.setAttribute('aria-label', `Storia Sovranaturale. ${preferences.showName ? snapshot.name + '. ' : ''}${snapshot.caption} Palette ${resolveStoryTheme(snapshot, preferences).label}.`);
    readyFile = new File([blob], 'sovranaturale-wine-dna.png', { type: 'image/png' });
    element('story-status').textContent = 'La tua storia è pronta.';
    setBusy(false);
  } catch (error) {
    if (currentRevision !== revision || !isCurrent(snapshot) || !dialog().open) return;
    element('story-preview').hidden = true;
    element('story-status').textContent = 'Non siamo riusciti a preparare l’immagine. Controlla la connessione e riprova.';
    element('story-retry-btn').hidden = false;
    setBusy(false);
    console.warn('Storia Wine DNA:', error.message);
  }
}

export function openStory() {
  if (!model || !isCurrent(model)) { showToast('Registra un assaggio per creare la tua storia.'); return; }
  if (dialog().open) return;
  lastFocus = document.activeElement;
  element('story-preview').hidden = true;
  document.body.classList.add('story-open');
  dialog().showModal();
  dialog().scrollTop = 0;
  dialog().querySelector('.story-workspace').scrollTop = 0;
  void updatePreview();
}

export function closeStory({ restoreFocus = true } = {}) {
  revision++;
  readyFile = null;
  if (dialog()?.open) dialog().close();
  document.body.classList.remove('story-open');
  if (restoreFocus && lastFocus?.isConnected && lastFocus.getClientRects().length) lastFocus.focus({ preventScroll: true });
  lastFocus = null;
}

function changePreferences(patch) {
  if (!model || !isCurrent(model) || sharing) return;
  preferences = normalizeStoryPreferences({ ...preferences, ...patch }, model.seed);
  remember();
  void updatePreview();
}

function moveVariant(direction) {
  if (preferences) changePreferences({ variant: (preferences.variant + direction + 3) % 3 });
}

async function shareStory() {
  if (!readyFile || !model || !isCurrent(model) || sharing) return;
  const file = readyFile;
  const snapshot = model;
  const shareRevision = revision;
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      sharing = true; setBusy(false);
      // File already prepared: native sharing starts directly within the user's tap.
      await navigator.share({ files: [file], title: 'Il mio Wine DNA · Sovranaturale' });
    } else {
      downloadBlob(file, file.name);
      showToast('Immagine salvata. Aggiungila alla tua storia Instagram.');
    }
  } catch (error) {
    if (error.name !== 'AbortError' && isCurrent(snapshot)) {
      element('story-status').textContent = 'Condivisione non riuscita. Puoi usare “Salva immagine”.';
    }
  } finally {
    if (shareRevision === revision && isCurrent(snapshot)) { sharing = false; setBusy(false); }
  }
}

export function bindStoryEvents() {
  const palettes = element('story-palettes');
  STORY_THEMES.forEach(theme => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'story-swatch';
    button.dataset.storyTheme = theme.id; button.setAttribute('aria-label', `Palette ${theme.label}`);
    button.setAttribute('title', theme.label); button.setAttribute('aria-pressed', 'false');
    button.style.setProperty('--swatch-a', theme.colors[0]);
    button.style.setProperty('--swatch-b', theme.colors[1]);
    palettes.appendChild(button);
  });
  document.querySelectorAll('[data-story-theme]').forEach(button => button.addEventListener('click', () => changePreferences({ theme: button.dataset.storyTheme })));
  element('story-close-btn').addEventListener('click', () => closeStory());
  dialog().addEventListener('cancel', event => { event.preventDefault(); closeStory(); });
  dialog().addEventListener('close', () => {
    if (!dialog().open) { sharing = false; document.body.classList.remove('story-open'); }
  });
  element('story-prev-btn').addEventListener('click', () => moveVariant(-1));
  element('story-next-btn').addEventListener('click', () => moveVariant(1));
  element('story-show-name').addEventListener('change', event => changePreferences({ showName: event.target.checked }));
  element('story-show-details').addEventListener('change', event => changePreferences({ showDetails: event.target.checked }));
  element('story-retry-btn').addEventListener('click', () => void updatePreview());
  element('story-share-btn').addEventListener('click', shareStory);
  element('story-save-btn').addEventListener('click', () => {
    if (readyFile && model && isCurrent(model)) {
      downloadBlob(readyFile, readyFile.name);
      showToast('Immagine salvata. Pronta per la tua storia.');
    }
  });
  const preview = element('story-preview-wrap');
  preview.addEventListener('pointerdown', event => { swipeStart = { x: event.clientX, y: event.clientY }; });
  preview.addEventListener('pointercancel', () => { swipeStart = null; });
  preview.addEventListener('pointerup', event => {
    if (!swipeStart) return;
    const dx = event.clientX - swipeStart.x; const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) moveVariant(dx < 0 ? 1 : -1);
  });
}
