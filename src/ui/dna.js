// ═══════════════════════════════════════════════════
// UI / DNA — profilo sensoriale e condivisione sicura
// ═══════════════════════════════════════════════════

import { state, captureSession, isCurrentSession } from '../state.js';
import { API } from '../api.js';
import { buildSensoryStats, describeSensoryStats } from '../domain/sensory.mjs';
import {
  appendElement,
  clearElement,
  renderEmptyState
} from '../utils.js';

import { createStoryModel } from '../story-model.js';
import { clearStory, configureStory, openStory } from './story.js';
let dnaGeneration = 0;
export function clearDnaCache() {
  dnaGeneration += 1;
  clearStory();

  const content = document.getElementById('dna-content');
  const subtitle = document.getElementById('dna-subtitle');
  if (content) clearElement(content);
  if (subtitle) subtitle.textContent = 'Basato sui tuoi assaggi di oggi';
  setShareButtonLoading(true, 'Genera il tuo Wine DNA');
}

function renderLoading(container) {
  clearElement(container);
  const card = appendElement(container, 'div', 'dna-profile-card');
  const loading = appendElement(card, 'div', 'dna-loading');
  appendElement(loading, 'div', 'dna-spinner');
  appendElement(loading, 'span', '', 'L’AI sta analizzando i tuoi assaggi...');
}

function renderRadarRow(container, label, value) {
  const row = appendElement(container, 'div', 'radar-bar-row');
  appendElement(row, 'span', 'radar-bar-name', label);
  const track = appendElement(row, 'div', 'radar-bar-track');
  const fill = appendElement(track, 'div', 'radar-bar-fill');
  const valid = Number.isFinite(value) && value >= 1 && value <= 5;
  fill.style.width = `${valid ? value / 5 * 100 : 0}%`;
  appendElement(row, 'span', 'radar-bar-value', valid ? `${value}/5` : '—');
}

function renderResult(container, dnaText, tags, cantine, averages) {
  clearElement(container);

  const profile = appendElement(container, 'div', 'dna-profile-card');
  appendElement(profile, 'div', 'dna-generated-text', dnaText);
  const tagsContainer = appendElement(profile, 'div', 'dna-tags');
  tags.slice(0, 6).forEach(tag => appendElement(tagsContainer, 'span', 'dna-tag', tag));

  const radar = appendElement(container, 'div', 'radar-section');
  appendElement(radar, 'div', 'radar-label', 'Profilo sensoriale');
  const bars = appendElement(radar, 'div', 'radar-bars');
  renderRadarRow(bars, 'Acidità', averages.acidita);
  renderRadarRow(bars, 'Corpo', averages.corpo);
  renderRadarRow(bars, 'Persistenza', averages.persistenza);

  const cantineSection = appendElement(container, 'div', 'cantine-section');
  appendElement(cantineSection, 'div', 'radar-label', 'Cantine visitate');
  const chips = appendElement(cantineSection, 'div', 'cantina-chips');
  cantine.forEach(cantina => appendElement(chips, 'span', 'cantina-chip', cantina));
}

export async function renderDNA() {
  const context = captureSession();
  const generation = ++dnaGeneration;
  const userId = state.utente.id;
  const eventId = state.eventId;
  clearStory();
  const subtitle = document.getElementById('dna-subtitle');
  if (subtitle) subtitle.textContent = 'Basato sui tuoi assaggi di oggi';
  setShareButtonLoading(true, 'Genera il tuo Wine DNA');

  const container = document.getElementById('dna-content');
  const assaggi = Array.isArray(state.assaggi) ? state.assaggi : [];

  if (!assaggi.length) {
    renderEmptyState(
      container,
      '🧬',
      'Nessun dato ancora',
      'Assaggia almeno un vino per generare il tuo Wine DNA.',
      '32px 24px'
    );
    return;
  }

  document.getElementById('dna-subtitle').textContent =
    `Basato su ${assaggi.length} ${assaggi.length === 1 ? 'assaggio' : 'assaggi'} di ${state.utente.nome || 'Degustatore'}`;

  configureStory(createStoryModel({ userId, eventId, name: state.utente.nome, tastings: assaggi }));
  setShareButtonLoading(false, 'Crea la tua storia ↗');
  renderLoading(container);

  let result;
  try {
    result = await API.getDNA(eventId);
    if (!result || !result.dnaText || !result.stats) throw new Error('Risposta DNA vuota');
    const { tags, cantine, averages } = result.stats;
    if (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string')
      || !Array.isArray(cantine) || !cantine.every(name => typeof name === 'string')
      || !averages || !['acidita', 'corpo', 'persistenza'].every(field => averages[field] === null
        || (Number.isFinite(averages[field]) && averages[field] >= 1 && averages[field] <= 5))) {
      throw new Error('Statistiche DNA non valide');
    }
  } catch (error) {
    console.error('Errore backend DNA:', error);
    
    const stats = buildSensoryStats(assaggi);
    result = { fallback: true, dnaText: describeSensoryStats(stats), stats };
  }

  if (generation !== dnaGeneration || state.utente.id !== userId || state.eventId !== eventId || !isCurrentSession(context)) return;

  renderResult(container, String(result.dnaText), result.stats.tags, result.stats.cantine, result.stats.averages);
  const label = appendElement(container, 'p', 'empty-state-text', result.fallback
    ? (result.pending ? 'AI in elaborazione. Questo è un riepilogo descrittivo; riapri Wine DNA tra poco.' : 'Riepilogo descrittivo. L’analisi AI non è disponibile in questo momento.')
    : 'Testo generato con AI a partire dalle intensità e dalle emozioni registrate.');
  label.setAttribute('role', 'status');

}

function setShareButtonLoading(loading, text) {
  const button = document.getElementById('share-dna-btn');
  if (!button) return;
  button.textContent = text;
  button.style.opacity = loading ? '0.7' : '1';
  button.disabled = loading;
}

export function shareDNA() {
  openStory();
}
