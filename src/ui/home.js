// ═══════════════════════════════════════════════════
// UI / HOME — render del passaporto senza sink HTML
// ═══════════════════════════════════════════════════

import { state, viniDB } from '../state.js';
import {
  appendElement,
  calculateAverage,
  clearElement,
  renderEmptyState,
  safeHexColor
} from '../utils.js';

function makeKeyboardClickable(element, callback) {
  element.tabIndex = 0;
  element.setAttribute('role', 'button');
  element.addEventListener('click', callback);
  element.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  });
}

function renderStats(container, assaggi) {
  const row = appendElement(container, 'div', 'stats-row');
  const stats = [
    [assaggi.length, 'Assaggi'],
    [assaggi.length ? calculateAverage(assaggi, 'acidita') : '—', 'Acidità media'],
    [assaggi.length ? calculateAverage(assaggi, 'corpo') : '—', 'Corpo medio']
  ];

  stats.forEach(([value, label]) => {
    const card = appendElement(row, 'div', 'stat-card');
    appendElement(card, 'div', 'stat-number', value);
    appendElement(card, 'div', 'stat-label', label);
  });
}

function renderDnaTeaser(container, openDna) {
  const teaser = appendElement(container, 'div', 'dna-teaser');
  makeKeyboardClickable(teaser, openDna);
  appendElement(teaser, 'div', 'dna-teaser-label', 'Wine DNA · Aggiornato ora');
  appendElement(teaser, 'div', 'dna-teaser-text', 'Scopri il tuo profilo sensoriale completo');
  const action = appendElement(teaser, 'div', 'dna-teaser-action', 'Vedi analisi completa ');
  appendElement(action, 'span', 'dna-teaser-arrow', '→');
}

function renderSectionHeader(container, assaggiCount) {
  const header = appendElement(container, 'div', 'section-header');
  appendElement(header, 'span', 'section-title', 'I tuoi assaggi');
  appendElement(header, 'span', 'section-count', `${assaggiCount} / ${viniDB.length}`);
}

function renderWineCard(container, tasting, openWine) {
  const vino = tasting.vino || {};
  const card = appendElement(container, 'div', 'wine-card');
  makeKeyboardClickable(card, () => openWine(vino));
  card.setAttribute('aria-label', `Apri ${String(vino.nome || 'vino')}`);

  const color = safeHexColor(vino.colore);
  const colorBadge = appendElement(card, 'div', 'wine-card-color', vino.emoji || '🍷');
  colorBadge.style.backgroundColor = `${color}22`;
  colorBadge.style.border = `1px solid ${color}44`;

  const info = appendElement(card, 'div', 'wine-card-info');
  appendElement(info, 'div', 'wine-card-name', vino.nome || 'Vino');
  appendElement(info, 'div', 'wine-card-cantina', `${vino.cantina || 'Cantina'} · ${vino.annata || '—'}`);

  const ratings = appendElement(info, 'div', 'wine-card-ratings');
  appendElement(ratings, 'span', 'rating-pill', `Ac. ${tasting.acidita}/5`);
  appendElement(ratings, 'span', 'rating-pill', `Corpo ${tasting.corpo}/5`);
  appendElement(ratings, 'span', 'rating-pill', tasting.emozione || '—');

  const score = Number(tasting.acidita) + Number(tasting.corpo) + Number(tasting.persistenza);
  appendElement(card, 'div', 'wine-card-score', Number.isFinite(score) ? score : '—');
}

/**
 * @param {(vino: object) => void} openWine
 * @param {() => void} openDna
 */
export function renderHome(openWine, openDna) {
  const container = document.getElementById('home-content');
  const assaggi = Array.isArray(state.assaggi) ? state.assaggi : [];
  clearElement(container);

  renderStats(container, assaggi);
  if (assaggi.length > 0) renderDnaTeaser(container, openDna);
  renderSectionHeader(container, assaggi.length);

  if (assaggi.length === 0) {
    renderEmptyState(
      container,
      '🍾',
      'Nessun assaggio ancora',
      'Avvicina il telefono a una bottiglia per iniziare. Usa il pulsante in basso per simulare il tap NFC.',
      '',
      false
    );
    return;
  }

  assaggi.slice().reverse().forEach(tasting => {
    renderWineCard(container, tasting, openWine);
  });
}
