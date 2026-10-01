// ═══════════════════════════════════════════════════
// UI / ONBOARDING — accesso email OTP verificato
// ═══════════════════════════════════════════════════

import {
  loadState,
  captureSession,
  isCurrentSession,
  pendingVinoId,
  setAuthenticatedUser,
  setPendingVinoId
} from '../state.js';
import { API } from '../api.js';
import { showScreen } from '../router.js';
import { showToast } from '../utils.js';
import { openTutorial } from './tutorial.js';

let requestedIdentity = null;
let flowGeneration = 0;

function getFields() {
  return {
    nome: document.getElementById('input-nome'),
    email: document.getElementById('input-email'),
    token: document.getElementById('input-otp'),
    otpGroup: document.getElementById('onboarding-otp-group'),
    hint: document.getElementById('onboarding-otp-hint'),
    requestButton: document.getElementById('onboarding-request-btn'),
    verifyButton: document.getElementById('onboarding-verify-btn'),
    resetButton: document.getElementById('onboarding-reset-btn')
  };
}

function validateIdentity(nome, email) {
  if (!nome || nome.length > 60) {
    return 'Il nome deve contenere da 1 a 60 caratteri';
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Inserisci un indirizzo email valido';
  }
  return '';
}

function setOtpStep(active) {
  const fields = getFields();
  fields.nome.readOnly = active;
  fields.email.readOnly = active;
  fields.otpGroup.hidden = !active;
  fields.requestButton.hidden = active;
  fields.verifyButton.hidden = !active;
  fields.resetButton.hidden = !active;

  if (active) fields.token.focus();
}

export function resetOnboarding() {
  flowGeneration += 1;
  requestedIdentity = null;
  const fields = getFields();
  fields.nome.value = '';
  fields.email.value = '';
  fields.token.value = '';
  fields.hint.textContent = '';
  fields.requestButton.disabled = false;
  fields.verifyButton.disabled = false;
  fields.requestButton.textContent = 'Invia il codice →';
  fields.verifyButton.textContent = 'Verifica e inizia →';
  setOtpStep(false);
}

export async function requestOtp() {
  const fields = getFields();
  if (fields.requestButton.disabled) return;
  const nome = fields.nome.value.trim();
  const email = fields.email.value.trim().toLowerCase();
  const validationError = validateIdentity(nome, email);

  if (validationError) {
    showToast(validationError, 'error');
    return;
  }

  const originalText = fields.requestButton.textContent;
  const generation = ++flowGeneration;
  const context = captureSession();
  const current = () => generation === flowGeneration && isCurrentSession(context);
  fields.requestButton.textContent = 'Invio in corso...';
  fields.requestButton.disabled = true;
  try {
    await API.requestOtp(email);
    if (!current()) return;
    requestedIdentity = { nome, email };
    fields.email.value = email;
    fields.hint.textContent = `Inserisci il codice ricevuto all'indirizzo ${email}.`;
    setOtpStep(true);
    showToast('Se l’indirizzo è valido, il codice è stato inviato.');
  } catch (error) {
    if (!current()) return;
    showToast(error.message || 'Invio del codice non riuscito. Riprova.', 'error');
  } finally {
    if (current()) {
      fields.requestButton.textContent = originalText;
      fields.requestButton.disabled = false;
    }
  }
}

export async function verifyOtp(openWine, renderHome) {
  const fields = getFields();
  if (fields.verifyButton.disabled) return;
  const token = fields.token.value.trim();

  if (!requestedIdentity) {
    showToast('Richiedi prima un nuovo codice', 'error');
    setOtpStep(false);
    return;
  }

  if (!/^\d{6,8}$/.test(token)) {
    showToast('Inserisci il codice numerico ricevuto via email', 'error');
    return;
  }

  const originalText = fields.verifyButton.textContent;
  const generation = flowGeneration;
  let context = captureSession();
  const current = () => generation === flowGeneration && isCurrentSession(context);
  fields.verifyButton.textContent = 'Verifica in corso...';
  fields.verifyButton.disabled = true;
  try {
    const result = await API.verifyOtp(
      requestedIdentity.nome,
      requestedIdentity.email,
      token
    );
    const user = result?.user;
    if (!current()) return;

    if (!user?.id) throw new Error('Sessione non inizializzata');

    setAuthenticatedUser(user);
    context = captureSession();
    try {
      await loadState(API.getTastings);
    } catch (error) {
      if (!current()) return;
      if (error.status === 401) throw error;
      console.error('Sincronizzazione assaggi non riuscita:', error);
      showToast('Accesso riuscito; gli assaggi saranno sincronizzati più tardi.', 'error');
    }

    if (!current()) return;

    requestedIdentity = null;
    fields.token.value = '';

    if (pendingVinoId) {
      const { viniDB } = await import('../state.js');
      if (!current()) return;
      const vino = viniDB.find(item => item.id === pendingVinoId);
      setPendingVinoId(null);
      if (vino) {
        openWine(vino);
        openTutorial();
        return;
      }
    }

    showScreen('home');
    renderHome();
    openTutorial();
  } catch (error) {
    if (!current()) return;
    fields.token.select();
    showToast(error.message || 'Codice non valido o scaduto', 'error');
  } finally {
    if (current()) {
      fields.verifyButton.textContent = originalText;
      fields.verifyButton.disabled = false;
    }
  }
}

export function restartOtpFlow() {
  // Non abbandonare uno scambio in corso che può emettere cookie di sessione.
  if (getFields().verifyButton.disabled) return;
  flowGeneration += 1;
  requestedIdentity = null;
  const fields = getFields();
  fields.token.value = '';
  fields.hint.textContent = '';
  setOtpStep(false);
  fields.email.focus();
}
