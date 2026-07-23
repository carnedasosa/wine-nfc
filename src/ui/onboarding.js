// ═══════════════════════════════════════════════════
// UI / ONBOARDING
// ═══════════════════════════════════════════════════

import { state, pendingVinoId, setPendingVinoId, saveState, setToken } from '../state.js';
import { API } from '../api.js';
import { showScreen } from '../router.js';
import { showToast } from '../utils.js';

/**
 * Gestisce il submit del form di onboarding.
 * @param {(vino: object) => void} openWine - callback per aprire un vino (evita import circolare)
 * @param {() => void} renderHome
 */
export async function startPassport(openWine, renderHome) {
  const nome = document.getElementById('input-nome').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const btn = document.querySelector('.onboarding-inner .btn-primary');

  if (!nome || !email) {
    showToast('Inserisci nome ed email per continuare', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const { token, user } = await API.login(nome, email);
    setToken(token);
    state.utente = { id: user.id, nome: user.nome, email: user.email };

    // Sync assaggi se utente già esistente
    try {
      const tastings = await API.getTastings();
      state.assaggi = tastings;
    } catch (e) {
      console.error('Errore sync assaggi in onboarding:', e);
    }

    saveState();

    if (pendingVinoId) {
      const { viniDB } = await import('../state.js');
      const vino = viniDB.find(v => v.id === pendingVinoId);
      setPendingVinoId(null);
      if (vino) {
        openWine(vino);
        if (btn) btn.disabled = false;
        return;
      }
    }

    showScreen('home');
    renderHome();
  } catch (e) {
    showToast('Errore di connessione. Riprova.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
