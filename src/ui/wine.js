// ═══════════════════════════════════════════════════
// UI / WINE — scheda vino, slider, emozioni, salvataggio
// ═══════════════════════════════════════════════════

import { state, viniDB, loadState } from '../state.js';
import { API } from '../api.js';
import { showScreen } from '../router.js';
import { safeHexColor, showToast } from '../utils.js';
import { clearDnaCache } from './dna.js';
import { clearLeaderboardCache } from './leaderboard.js';

let saving = false;
let pendingRequest = null;

const EMOTIONS = new Set(['Sorpresa', 'Nostalgia', 'Energia', 'Pace', 'Complessità', 'Radici']);

/**
 * Apre la scheda dettaglio di un vino.
 * @param {object} vino
 */
export function openWine(vino) {
  if (!vino || !vino.id) {
    showToast('Vino non valido', 'error');
    return;
  }
  state.vinoCorrente = vino;
  const previous = state.assaggi.find(item => item.vino.id === vino.id);
  state.emozioneSelezionata = previous?.emozione || null;


  // Reset sliders
  ['acidita', 'corpo', 'persistenza'].forEach(s => {
    const slider = document.getElementById('slider-' + s);
    slider.value = previous?.[s] || 3;
    updateSlider(s, slider);
  });

  // Reset emozioni
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('[data-emotion]').forEach(c => {
    const selected = c.dataset.emotion === state.emozioneSelezionata;
    c.classList.toggle('selected', selected);
    c.setAttribute('aria-pressed', String(selected));
  });

  // Colore hero
  const color = safeHexColor(vino.colore);
  document.getElementById('wine-hero').style.background =
    `linear-gradient(180deg, ${color}55 0%, var(--bg) 100%)`;

  document.getElementById('wine-emoji').textContent = vino.emoji;
  document.getElementById('wine-cantina-label').textContent = vino.cantina;
  document.getElementById('wine-name').textContent = vino.nome;
  document.getElementById('wine-meta').textContent = [vino.annata, vino.vitigno, vino.territorio].filter(Boolean).join(' · ');
  document.getElementById('wine-desc').textContent = vino.desc;

  showScreen('wine');
}

export function updateSlider(tipo, el) {
  if (!['acidita', 'corpo', 'persistenza'].includes(tipo)) return;
  const val = el.value;
  document.getElementById(tipo + '-val').textContent = val;

  const min = el.min || 1;
  const max = el.max || 5;
  const percentage = ((val - min) / (max - min)) * 100;
  el.style.setProperty('--val', `${percentage}%`);

  if (navigator.vibrate) navigator.vibrate(10);
}

export function selectEmo(el, emo) {
  if (!EMOTIONS.has(emo)) return;
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('[data-emotion]').forEach(c => c.setAttribute('aria-pressed', String(c === el)));
  el.classList.add('selected');
  state.emozioneSelezionata = emo;
}

/**
 * Salva l'assaggio corrente sul backend e aggiorna stato locale.
 * @param {() => void} renderHome
 */
export async function saveWine(renderHome) {
  if (saving) return;
  if (!state.utente || !state.utente.id) {
    return showToast('Sessione non valida, utente mancante', 'error');
  }

  const vino = state.vinoCorrente;
  if (!vino?.id) return showToast('Seleziona un vino valido', 'error');
  if (!navigator.onLine) return showToast('Connessione assente: resta su questa scheda e riprova quando torna la rete.', 'error');
  const btn = document.querySelector('.wine-cta .btn-save');
  if (btn) btn.disabled = true;

  const acidita = parseInt(document.getElementById('slider-acidita').value);
  const corpo = parseInt(document.getElementById('slider-corpo').value);
  const persistenza = parseInt(document.getElementById('slider-persistenza').value);
  const emozione = state.emozioneSelezionata;

  if (!emozione) {
    if (btn) btn.disabled = false;
    showToast('Seleziona un’emozione prima di salvare', 'error');
    return;
  }

  saving = true;
  const owner = state.utente.id;
  const eventId = state.eventId;
  try {
    if (!state.tastingsLoaded) await loadState(API.getTastings);
    if (owner !== state.utente.id || eventId !== state.eventId) return;
    const payload = {
      eventId,
      wineId: vino.id,
      acidita,
      corpo,
      persistenza,
      emozione,
      baseVersion: state.assaggi.find(a => a.vino.id === vino.id)?.version || 0
    };
    const signature = JSON.stringify({ owner, ...payload });
    if (pendingRequest?.signature !== signature) {
      pendingRequest = { signature, payload: { ...payload, idempotencyKey: crypto.randomUUID() } };
    }
    const saved = await API.saveTasting(pendingRequest.payload);
    pendingRequest = null;
    if (owner !== state.utente.id || eventId !== state.eventId) return;
    showToast(`${vino.nome} salvato nel passaporto ✓`);
    const assaggio = { vino, acidita: saved.acidita, corpo: saved.corpo, persistenza: saved.persistenza, emozione: saved.emozione, version: saved.version, timestamp: new Date(saved.createdAt) };
    const existing = state.assaggi.findIndex(a => a.vino.id === vino.id);
    if (existing >= 0) {
      state.assaggi[existing] = assaggio;
    } else {
      state.assaggi.push(assaggio);
    }
    
    clearDnaCache();
    clearLeaderboardCache();
    showScreen('home');
    renderHome();
  } catch (e) {
    if (e.status === 409) {
      pendingRequest = null;
      await loadState(API.getTastings).catch(() => { state.tastingsLoaded = false; });
    }
    console.error('[saveWine] error:', e);
    showToast(e.message || 'Errore nel salvataggio. Riprova.', 'error');
  } finally {
    saving = false;
    if (btn) btn.disabled = false;
  }
}

/**
 * Simula un tap NFC aprendo un vino non ancora assaggiato.
 */
export function simulateNfcTap(openWineFn) {
  const ripple = document.getElementById('nfc-ripple');
  ripple.classList.remove('animate');
  void ripple.offsetWidth;
  ripple.classList.add('animate');

  const assaggiatiIds = state.assaggi.map(a => a.vino.id);
  const nonAssaggiati = viniDB.filter(v => !assaggiatiIds.includes(v.id));

  if (nonAssaggiati.length === 0) {
    showToast('Hai assaggiato tutti i vini della fiera! 🎉');
    return;
  }

  const vino = nonAssaggiati[Math.floor(Math.random() * nonAssaggiati.length)];
  openWineFn(vino);
}

export function requestContact() {
  showToast('I contatti delle cantine non sono ancora disponibili.');
}
