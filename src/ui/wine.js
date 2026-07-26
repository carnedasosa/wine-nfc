// ═══════════════════════════════════════════════════
// UI / WINE — scheda vino, slider, emozioni, salvataggio
// ═══════════════════════════════════════════════════

import { state, viniDB } from '../state.js';
import { API } from '../api.js';
import { showScreen } from '../router.js';
import { safeHexColor, showToast } from '../utils.js';
import { saveTastingToOutbox, registerSync } from '../outbox.js';

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
  state.emozioneSelezionata = null;


  // Reset sliders
  ['acidita', 'corpo', 'persistenza'].forEach(s => {
    const slider = document.getElementById('slider-' + s);
    slider.value = 3;
    slider.style.setProperty('--val', '50%');
    document.getElementById(s + '-val').textContent = '3';
  });

  // Reset emozioni
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));

  // Colore hero
  const color = safeHexColor(vino.colore);
  document.getElementById('wine-hero').style.background =
    `linear-gradient(180deg, ${color}55 0%, var(--bg) 100%)`;

  document.getElementById('wine-emoji').textContent = vino.emoji;
  document.getElementById('wine-cantina-label').textContent = vino.cantina;
  document.getElementById('wine-name').textContent = vino.nome;
  document.getElementById('wine-meta').textContent = `${vino.annata} · ${vino.vitigno} · ${vino.territorio}`;
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
  el.classList.add('selected');
  state.emozioneSelezionata = emo;
}

/**
 * Salva l'assaggio corrente sul backend e aggiorna stato locale.
 * @param {() => void} renderHome
 */
export async function saveWine(renderHome) {
  if (!state.utente || !state.utente.id) {
    return showToast('Sessione non valida, utente mancante', 'error');
  }

  const vino = state.vinoCorrente;
  if (!vino?.id) return showToast('Seleziona un vino valido', 'error');
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

  const idempotencyKey = (typeof crypto !== 'undefined' && crypto.randomUUID) 
    ? crypto.randomUUID() 
    : 'mock-uuid-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);

  try {
    const payload = {
      eventId: state.eventId,
      wineId: vino.id,
      acidita,
      corpo,
      persistenza,
      emozione,
      idempotencyKey
    };

    if (!navigator.onLine) {
      await saveTastingToOutbox(payload);
      registerSync(); // try registering sync if possible
      showToast(`${vino.nome} salvato offline. Verrà sincronizzato appena possibile.`, 'success');
    } else {
      await API.saveTasting(payload);
      showToast(`${vino.nome} salvato nel passaporto ✓`);
    }

    const assaggio = { vino, acidita, corpo, persistenza, emozione, timestamp: new Date() };
    const existing = state.assaggi.findIndex(a => a.vino.id === vino.id);
    if (existing >= 0) {
      state.assaggi[existing] = assaggio;
    } else {
      state.assaggi.push(assaggio);
    }
    
    setTimeout(() => {
      showScreen('home');
      renderHome();
    }, 800);
  } catch (e) {
    console.error('[saveWine] error:', e);
    showToast(e.message || 'Errore nel salvataggio. Riprova.', 'error');
  } finally {
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
  showToast('Richiesta inviata alla cantina 📬');
}
