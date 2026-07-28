// ═══════════════════════════════════════════════════
// UI / DNA — profilo sensoriale e condivisione sicura
// ═══════════════════════════════════════════════════

import { state } from '../state.js';
import { API } from '../api.js';
import {
  appendElement,
  calculateAverage,
  clearElement,
  downloadBlob,
  getTopEmotions,
  renderEmptyState,
  showToast
} from '../utils.js';

let instaStoryBlob = null;
let dnaGeneration = 0;
let storyTimerId = null;

function clearStoryLayout() {
  const userName = document.getElementById('insta-user-name');
  const dnaText = document.getElementById('insta-dna-text');
  const bars = document.getElementById('insta-radar-bars');
  const tags = document.getElementById('insta-tags-container');

  if (userName) userName.textContent = '';
  if (dnaText) dnaText.textContent = '';
  if (bars) clearElement(bars);
  if (tags) clearElement(tags);
}

function discardPendingStory() {
  if (storyTimerId !== null) {
    clearTimeout(storyTimerId);
    storyTimerId = null;
  }
  instaStoryBlob = null;
}

export function clearDnaCache() {
  dnaGeneration += 1;
  discardPendingStory();
  clearStoryLayout();

  const content = document.getElementById('dna-content');
  const subtitle = document.getElementById('dna-subtitle');
  if (content) clearElement(content);
  if (subtitle) subtitle.textContent = 'Basato sui tuoi assaggi di oggi';
  setShareButtonLoading(true, 'Genera il tuo Wine DNA');
}

function generaDNAFallback(acidita, corpo) {
  const profili = [
    'Un palato che non cerca conforto — cerca verità. I vini scelti oggi parlano di territorio con accento duro, senza mediazioni. C’è una preferenza per l’acidità viva, per quella tensione che tiene sveglio.',
    'Un degustatore del confine, attratto da vini che non si lasciano catalogare facilmente. La struttura non spaventa, anzi invita — come un racconto che richiede attenzione prima di rivelare il finale.',
    'Il profilo di chi lascia spazio al vino di parlare. Preferenza per leggerezza e precisione, come un fotografo che sceglie la luce giusta invece di riempire il frame.'
  ];
  const index = Math.floor((acidita + corpo) / 4);
  return profili[Math.min(index, profili.length - 1)];
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
  discardPendingStory();
  clearStoryLayout();
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
    `Basato su ${assaggi.length} assaggi di ${state.utente.nome || 'Degustatore'}`;

  renderLoading(container);

  let result;
  try {
    result = await API.getDNA(state.eventId);
    if (!result || !result.dnaText) throw new Error('Risposta DNA vuota');
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
      dnaText: generaDNAFallback(averages.acidita, averages.corpo),
      stats: { averages, topEmo: topEmotions, cantine, tags, assaggiCount: assaggi.length }
    };
  }

  if (generation !== dnaGeneration || state.utente.id !== userId) return;

  renderResult(container, String(result.dnaText), result.stats.tags, result.stats.cantine, result.stats.averages);
  scheduleStoryImage(generation, userId, result.stats.averages);
}

function setShareButtonLoading(loading, text) {
  const button = document.getElementById('share-dna-btn');
  if (!button) return;
  button.textContent = text;
  button.style.opacity = loading ? '0.7' : '1';
  button.disabled = loading;
}

function scheduleStoryImage(generation, userId, averages) {
  setShareButtonLoading(true, 'Preparazione immagine...');

  storyTimerId = setTimeout(async () => {
    storyTimerId = null;
    if (generation !== dnaGeneration || state.utente.id !== userId) return;
    if (!prepareInstaLayout(averages)) return;

    const layout = document.getElementById('insta-story-layout');
    const originalScroll = window.scrollY;
    try {
      const canvas = await window.html2canvas(layout, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        width: 1080,
        height: 1920,
        windowWidth: 1080,
        windowHeight: 1920
      });
      window.scrollTo(0, originalScroll);
      if (generation !== dnaGeneration || state.utente.id !== userId) return;
      canvas.toBlob(blob => {
        if (generation !== dnaGeneration || state.utente.id !== userId) return;
        instaStoryBlob = blob;
        setShareButtonLoading(false, '↗ Condividi il tuo Wine DNA');
      }, 'image/png');
    } catch (error) {
      if (generation !== dnaGeneration || state.utente.id !== userId) return;
      console.error('Errore pre-generazione:', error);
      setShareButtonLoading(false, 'Immagine non disponibile');
    }
  }, 500);
}

function createInstaStat(container, label, value) {
  const row = appendElement(container, 'div', 'insta-radar-row');
  appendElement(row, 'span', 'insta-radar-label', label);
  const track = appendElement(row, 'div', 'insta-radar-track');
  const fill = appendElement(track, 'div', 'insta-radar-fill');
  fill.style.width = `${rating(value) / 5 * 100}%`;
}

function prepareInstaLayout(averages) {
  const assaggi = Array.isArray(state.assaggi) ? state.assaggi : [];
  if (!assaggi.length) return false;

  document.getElementById('insta-user-name').textContent = state.utente.nome || 'Esploratore';
  const generatedText = document.querySelector('.dna-generated-text')?.textContent;
  document.getElementById('insta-dna-text').textContent = generatedText || generaDNAFallback(
    rating(averages?.acidita || 3),
    rating(averages?.corpo || 3)
  );

  const bars = document.getElementById('insta-radar-bars');
  clearElement(bars);
  createInstaStat(bars, 'Acidità', averages?.acidita || 0);
  createInstaStat(bars, 'Corpo', averages?.corpo || 0);
  createInstaStat(bars, 'Persistenza', averages?.persistenza || 0);

  const tagsContainer = document.getElementById('insta-tags-container');
  clearElement(tagsContainer);
  document.querySelectorAll('.dna-tag').forEach(sourceTag => {
    appendElement(tagsContainer, 'span', 'insta-tag', sourceTag.textContent);
  });

  return true;
}

export async function shareDNA() {
  if (!instaStoryBlob) {
    showToast('Immagine non ancora pronta. Attendi qualche secondo...', 'error');
    return;
  }

  const file = new File([instaStoryBlob], 'wine-dna.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Wine DNA',
        text: 'Il mio profilo sensoriale su Vino Passport'
      });
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Condivisione fallita:', error);
    }
    return;
  }

  downloadBlob(instaStoryBlob, 'wine-dna.png');
  showToast('Immagine scaricata! Aggiungila alle tue Storie.');
}
