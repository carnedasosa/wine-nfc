// ═══════════════════════════════════════════════════
// UI / WINE — scheda vino, slider, emozioni, salvataggio
// ═══════════════════════════════════════════════════

import { state, loadState, captureSession, isCurrentSession } from '../state.js';
import { API } from '../api.js';
import { showScreen } from '../router.js';
import { safeHexColor, showToast } from '../utils.js';
import { clearDnaCache } from './dna.js';
import { clearLeaderboardCache } from './leaderboard.js';

let draft = null;

function currentDraft(candidate) {
  return draft === candidate && isCurrentSession(candidate.context)
    && state.vinoCorrente?.id === candidate.vino.id;
}

function setDraftStatus(candidate, status, message = '') {
  candidate.status = status;
  if (!currentDraft(candidate)) return;
  const editable = status === 'ready';
  document.getElementById('save-wine-btn').disabled = !editable;
  document.querySelectorAll('[data-rating], [data-emotion]').forEach(control => { control.disabled = !editable; });
  document.getElementById('wine-status').textContent = message;
  const retry = document.getElementById('wine-retry-btn');
  retry.hidden = !['error', 'conflict'].includes(status);
  retry.textContent = status === 'conflict' ? 'Carica il voto aggiornato' : 'Riprova il caricamento';
}

export async function retryWineLoad() {
  if (!draft || !currentDraft(draft) || !['error', 'conflict'].includes(draft.status)) return;
  return openWine(draft.vino, { reload: true });
}

const EMOTIONS = new Set(['Sorpresa', 'Nostalgia', 'Energia', 'Pace', 'Complessità', 'Radici']);

/**
 * Apre la scheda dettaglio di un vino.
 * @param {object} vino
 */
export async function openWine(vino, { reload = false } = {}) {
  if (!vino || !vino.id) {
    showToast('Vino non valido', 'error');
    return;
  }
  state.vinoCorrente = vino;
  const candidate = { vino, context: captureSession(), status: 'loading', baseVersion: null, pendingRequest: null };
  draft = candidate;
  state.emozioneSelezionata = null;
  setDraftStatus(candidate, 'loading', 'Caricamento del tuo voto…');

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
  try {
    if (reload || !state.tastingsLoaded) {
      const applied = await loadState(API.getTastings);
      if (!currentDraft(candidate)) return;
      if (!applied || !state.tastingsLoaded) throw new Error('Riprova a caricare gli assaggi.');
    }
    if (!currentDraft(candidate)) return;
    const previous = state.assaggi.find(item => item.vino.id === vino.id);
    candidate.baseVersion = previous?.version || 0;
    state.emozioneSelezionata = previous?.emozione || null;
    ['acidita', 'corpo', 'persistenza'].forEach(s => {
      const slider = document.getElementById('slider-' + s);
      slider.value = String(previous?.[s] || 3);
      updateSlider(s, slider);
    });
    document.querySelectorAll('[data-emotion]').forEach(control => {
      const selected = control.dataset.emotion === state.emozioneSelezionata;
      control.classList.toggle('selected', selected);
      control.setAttribute('aria-pressed', String(selected));
    });
    setDraftStatus(candidate, 'ready');
  } catch {
    if (currentDraft(candidate)) setDraftStatus(candidate, 'error', 'Impossibile caricare il tuo voto. Riprova prima di modificarlo.');
  }
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
  if (!EMOTIONS.has(emo) || !draft || !currentDraft(draft) || draft.status !== 'ready') return;
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
  const candidate = draft;
  if (!candidate || !currentDraft(candidate) || candidate.status !== 'ready') return;
  if (!state.utente || !state.utente.id) {
    return showToast('Sessione non valida, utente mancante', 'error');
  }

  const vino = candidate.vino;
  if (!vino?.id) return showToast('Seleziona un vino valido', 'error');
  if (!navigator.onLine) return showToast('Connessione assente: resta su questa scheda e riprova quando torna la rete.', 'error');

  const acidita = parseInt(document.getElementById('slider-acidita').value);
  const corpo = parseInt(document.getElementById('slider-corpo').value);
  const persistenza = parseInt(document.getElementById('slider-persistenza').value);
  const emozione = state.emozioneSelezionata;

  if (!emozione) {
    showToast('Seleziona un’emozione prima di salvare', 'error');
    return;
  }

  setDraftStatus(candidate, 'saving', 'Salvataggio in corso…');
  const eventId = candidate.context.eventId;
  try {
    const payload = {
      eventId,
      wineId: vino.id,
      acidita,
      corpo,
      persistenza,
      emozione,
      baseVersion: candidate.baseVersion
    };
    const signature = JSON.stringify(payload);
    if (candidate.pendingRequest?.signature !== signature) {
      candidate.pendingRequest = { signature, payload: { ...payload, idempotencyKey: crypto.randomUUID() } };
    }
    const saved = await API.saveTasting(candidate.pendingRequest.payload);
    if (!isCurrentSession(candidate.context)) return;
    candidate.pendingRequest = null;
    const assaggio = { vino, acidita: saved.acidita, corpo: saved.corpo, persistenza: saved.persistenza, emozione: saved.emozione, version: saved.version, timestamp: new Date(saved.createdAt) };
    const existing = state.assaggi.findIndex(a => a.vino.id === vino.id);
    if (existing >= 0) {
      if (state.assaggi[existing].version <= assaggio.version) state.assaggi[existing] = assaggio;
    } else {
      state.assaggi.push(assaggio);
    }
    
    clearDnaCache();
    clearLeaderboardCache();
    // Un replay restituisce la risposta storica della richiesta, non il voto più recente.
    if (saved.replayed) {
      try { await loadState(API.getTastings); }
      catch { if (isCurrentSession(candidate.context)) state.tastingsLoaded = false; }
    }
    if (!currentDraft(candidate)) return;
    setDraftStatus(candidate, 'saved', 'Voto salvato.');
    showToast(`${vino.nome} salvato nel passaporto ✓`);
    showScreen('home');
    renderHome();
  } catch (e) {
    if (!currentDraft(candidate)) return;
    if (e.status === 409) {
      candidate.pendingRequest = null;
      state.tastingsLoaded = false;
      setDraftStatus(candidate, 'conflict', 'Il voto o la disponibilità dell’evento sono cambiati. Carica il voto aggiornato prima di modificarlo: i valori qui inseriti saranno sostituiti.');
      return;
    }
    showToast(e.message || 'Errore nel salvataggio. Riprova.', 'error');
  } finally {
    if (currentDraft(candidate) && candidate.status === 'saving') setDraftStatus(candidate, 'ready', 'Salvataggio non confermato. Puoi riprovare.');
  }
}
