// ═══════════════════════════════════════════════════
// UI / SETTINGS — profilo e chiusura sessione
// ═══════════════════════════════════════════════════

import { captureSession, isCurrentSession, invalidateSessionOperations, clearUserState, setAuthenticatedUser, state } from '../state.js';
import { API } from '../api.js';
import { clearDnaCache, renderDNA } from './dna.js';
import { clearLeaderboardCache } from './leaderboard.js';
import { showToast } from '../utils.js';

let lastFocus = null;
let settingsGeneration = 0;
let logoutOperation = 0;
let logoutContext = null;

export async function openSettings() {
  if (!state.utente.id) {
    showToast('Completa il profilo prima di modificarlo', 'error');
    return;
  }

  const generation = ++settingsGeneration;
  const context = captureSession();
  if (logoutContext && !isCurrentSession(logoutContext)) {
    logoutOperation += 1;
    logoutContext = null;
    document.getElementById('settings-logout-btn').disabled = false;
  }
  lastFocus = document.activeElement;
  const saveButton = document.getElementById('settings-save-btn');
  saveButton.disabled = true;
  document.getElementById('settings-nickname').value = '';
  document.getElementById('settings-leaderboard').checked = false;
  document.getElementById('settings-panel').inert = false;
  document.querySelectorAll('.screen').forEach(screen => { screen.inert = true; });
  const nameInput = document.getElementById('settings-nome');
  document.getElementById('settings-email').value = state.utente.email || '';
  nameInput.value = state.utente.nome || '';
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
  nameInput.focus();
  try {
    const participation = await API.getParticipation(state.eventId);
    if (generation !== settingsGeneration || !isCurrentSession(context)) return;
    document.getElementById('settings-nickname').value = participation.nickname || '';
    document.getElementById('settings-leaderboard').checked = participation.consensoLeaderboard;
    saveButton.disabled = false;
  } catch (error) { if (generation === settingsGeneration && isCurrentSession(context)) showToast(error.message, 'error'); }
}

export function closeSettings() {
  settingsGeneration++;
  document.getElementById('settings-panel').inert = true;
  document.querySelectorAll('.screen').forEach(screen => { screen.inert = false; });
  if (lastFocus?.isConnected) lastFocus.focus();
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



  if (!state.utente.id) {
    showToast('Sessione non valida. Accedi di nuovo.', 'error');
    return;
  }

  const context = captureSession();
  const generation = settingsGeneration;
  const current = () => generation === settingsGeneration && isCurrentSession(context);
  const participation = { eventId: context.eventId,
    nickname: document.getElementById('settings-nickname').value.trim(),
    consensoLeaderboard: document.getElementById('settings-leaderboard').checked };
  let nameSaved = false;
  button.disabled = true;
  try {
    if (nome !== state.utente.nome) {
      const result = await API.updateUser(context.userId, nome);
      if (!current()) return;
      const updated = result?.user || result;
      if (updated?.id !== context.userId) throw new Error('Risposta del profilo non valida');
      setAuthenticatedUser(result?.user || result);
      nameSaved = true;
      clearDnaCache();
    }
    if (!current()) return;
    await API.saveParticipation(participation);
    if (!current()) return;
    clearDnaCache();
    clearLeaderboardCache();
    if (document.getElementById('screen-dna')?.classList.contains('active')) {
      void renderDNA();
    }

    closeSettings();
    showToast('Profilo aggiornato ✓');
  } catch (error) {
    if (!current()) return;
    showToast(nameSaved
      ? 'Nome salvato. Partecipazione non confermata: riprova per completare il salvataggio.'
      : error.message || 'Errore di connessione. Riprova.', 'error');
  } finally {
    if (current()) button.disabled = false;
  }
}

export async function logout() {
  const button = document.getElementById('settings-logout-btn');
  if (button.disabled) return;
  invalidateSessionOperations();
  settingsGeneration += 1;
  const context = captureSession();
  const operation = ++logoutOperation;
  logoutContext = context;
  button.disabled = true;

  try {
    await API.logout();
    if (!isCurrentSession(context)) return;
    clearUserState();
    clearDnaCache();
    clearLeaderboardCache();
    closeSettings();
    window.dispatchEvent(new CustomEvent('vino:logged-out'));
  } catch (error) {
    if (!isCurrentSession(context)) return;
    console.error('Logout server-side non riuscito:', error);
    await openSettings();
    if (!isCurrentSession(context)) return;
    showToast('Impossibile chiudere la sessione. Riprova.', 'error');
  } finally {
    if (operation === logoutOperation) {
      logoutContext = null;
      button.disabled = false;
    }
  }
}
