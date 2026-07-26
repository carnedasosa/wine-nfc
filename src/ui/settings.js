// ═══════════════════════════════════════════════════
// UI / SETTINGS — profilo e chiusura sessione
// ═══════════════════════════════════════════════════

import { clearUserState, setAuthenticatedUser, state } from '../state.js';
import { API } from '../api.js';
import { clearDnaCache, renderDNA } from './dna.js';
import { clearLeaderboardCache } from './leaderboard.js';
import { showToast } from '../utils.js';

export function openSettings() {
  if (!state.utente.id) {
    showToast('Completa il profilo prima di modificarlo', 'error');
    return;
  }

  const nameInput = document.getElementById('settings-nome');
  document.getElementById('settings-email').value = state.utente.email || '';
  nameInput.value = state.utente.nome || '';
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  nameInput.focus();
}

export function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

export async function saveSettings() {
  const nome = document.getElementById('settings-nome').value.trim();
  const button = document.getElementById('settings-save-btn');
  if (button.disabled) return;

  if (!nome || nome.length > 60) {
    showToast('Il nome deve contenere da 1 a 60 caratteri', 'error');
    return;
  }

  if (nome === state.utente.nome) {
    closeSettings();
    return;
  }

  if (!state.utente.id) {
    showToast('Sessione non valida. Accedi di nuovo.', 'error');
    return;
  }

  button.disabled = true;
  try {
    const result = await API.updateUser(state.utente.id, nome);
    const user = result?.user || result;
    setAuthenticatedUser(user);
    clearDnaCache();
    clearLeaderboardCache();
    if (document.getElementById('screen-dna')?.classList.contains('active')) {
      void renderDNA();
    }

    closeSettings();
    showToast('Profilo aggiornato ✓');
  } catch (error) {
    showToast(error.message || 'Errore di connessione. Riprova.', 'error');
  } finally {
    button.disabled = false;
  }
}

export async function logout() {
  const button = document.getElementById('settings-logout-btn');
  button.disabled = true;

  try {
    await API.logout();
    clearUserState();
    clearDnaCache();
    clearLeaderboardCache();
    closeSettings();
    window.dispatchEvent(new CustomEvent('vino:logged-out'));
  } catch (error) {
    console.error('Logout server-side non riuscito:', error);
    showToast('Impossibile chiudere la sessione. Riprova.', 'error');
  } finally {
    button.disabled = false;
  }
}
