// ═══════════════════════════════════════════════════
// UI / SETTINGS — pannello profilo utente
// ═══════════════════════════════════════════════════

import { state, saveState } from '../state.js';
import { API } from '../api.js';
import { showToast } from '../utils.js';

export function openSettings() {
  if (!state.utente.id) {
    showToast('Completa il profilo prima di modificarlo', 'error');
    return;
  }
  document.getElementById('settings-nome').value = state.utente.nome || '';
  document.getElementById('settings-email').value = state.utente.email || '';
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
}

export function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

export async function saveSettings() {
  const nome = document.getElementById('settings-nome').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  const btn = document.getElementById('settings-save-btn');

  if (!nome) {
    showToast('Il nome non può essere vuoto', 'error');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast('Inserisci un indirizzo email valido', 'error');
    return;
  }

  // Nessuna modifica — chiudi senza fetch
  if (nome === state.utente.nome && email === state.utente.email) {
    closeSettings();
    return;
  }

  if (!state.utente.id) {
    showToast('Sessione non valida. Ricarica la pagina.', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const data = await API.updateUser(state.utente.id, nome, email);

    state.utente.nome = data.nome;
    state.utente.email = data.email;
    saveState();

    // Aggiorna live il subtitle del DNA se visibile
    const dnaSub = document.getElementById('dna-subtitle');
    if (dnaSub && dnaSub.textContent.includes('assaggi di')) {
      dnaSub.textContent = `Basato su ${state.assaggi.length} assaggi di ${data.nome}`;
    }

    closeSettings();
    showToast('Profilo aggiornato ✓');
  } catch (e) {
    showToast(e.data?.error || 'Errore di connessione. Riprova.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
