// ═══════════════════════════════════════════════════
// UI / DNA — profilo sensoriale e condivisione sicura
// ═══════════════════════════════════════════════════

import { state } from '../state.js';
import { API } from '../api.js';
import {
  appendElement,
  calculateAverage,
  clearElement,
  getTopEmotions,
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

function generaDNAFallback(acidita, corpo) {
  return 'Nei tuoi assaggi l’acidità media è ' + acidita + '/5 e il corpo medio è ' + corpo + '/5. È un riepilogo delle intensità registrate, non una misura delle tue preferenze.';
}

function rating(value) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.min(5, Math.max(1, numeric)) : 1;
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
  fill.style.width = `${rating(value) / 5 * 100}%`;
  appendElement(row, 'span', 'radar-bar-value', `${rating(value)}/5`);
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

function buildTags(assaggi, avgAcidita, avgCorpo, topEmotions) {
  const tags = [];
  if (avgAcidita >= 4) tags.push('Vini tesi');
  else if (avgAcidita <= 2) tags.push('Vini morbidi');
  if (avgCorpo >= 4) tags.push('Struttura densa');
  else if (avgCorpo <= 2) tags.push('Leggerezza');
  topEmotions.forEach(emotion => tags.push(emotion));

  assaggi.forEach(tasting => {
    const territory = typeof tasting.vino?.territorio === 'string'
      ? tasting.vino.territorio.split(',')[1]?.trim()
      : '';
    if (territory && !tags.includes(territory)) tags.push(territory);
  });
  return tags;
}

export async function renderDNA() {
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
  } catch (error) {
    console.error('Errore backend DNA:', error);
    
    // Fallback in case the server fails entirely
    const averages = {
      acidita: rating(calculateAverage(assaggi, 'acidita')),
      corpo: rating(calculateAverage(assaggi, 'corpo')),
      persistenza: rating(calculateAverage(assaggi, 'persistenza'))
    };
    const topEmotions = getTopEmotions(assaggi, 3);
    const cantine = [...new Set(
      assaggi
        .map(tasting => tasting.vino?.cantina)
        .filter(cantina => typeof cantina === 'string' && cantina)
    )];
    const tags = buildTags(assaggi, averages.acidita, averages.corpo, topEmotions);
    
    result = {
      fallback: true,
      dnaText: generaDNAFallback(averages.acidita, averages.corpo),
      stats: { averages, topEmo: topEmotions, cantine, tags, assaggiCount: assaggi.length }
    };
  }

  if (generation !== dnaGeneration || state.utente.id !== userId || state.eventId !== eventId) return;

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
