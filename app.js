// ═══════════════════════════════════════════════════
// APP.JS — entry point e registrazione eventi
// ═══════════════════════════════════════════════════

import {
  clearUserState,
  loadState,
  setAuthenticatedUser,
  setPendingVinoId,
  setViniDB,
  state,
  viniDB
} from './src/state.js';
import { flushOutbox } from './src/outbox.js';
import { API, ApiError } from './src/api.js';
import {
  cleanURL,
  getVinoFromURL,
  goBack as routeBack,
  setPreviousScreen,
  showScreen,
  showTab as routeTab
} from './src/router.js';
import { showToast } from './src/utils.js';
import {
  requestOtp,
  resetOnboarding,
  restartOtpFlow,
  verifyOtp
} from './src/ui/onboarding.js';
import { renderHome as renderHomeView } from './src/ui/home.js';
import {
  openWine as openWineView,
  requestContact,
  saveWine as saveWineView,
  selectEmo,
  simulateNfcTap as simulateNfcTapView,
  updateSlider
} from './src/ui/wine.js';
import { clearDnaCache, renderDNA, shareDNA } from './src/ui/dna.js';
import { clearLeaderboardCache, renderLeaderboard } from './src/ui/leaderboard.js';
import {
  closeSettings,
  logout,
  openSettings,
  saveSettings
} from './src/ui/settings.js';

let authTransitionInProgress = false;

function renderHome() {
  renderHomeView(openWine, () => showTab('dna'));
}

function openWine(vino) {
  cleanURL();
  setPreviousScreen('home');
  openWineView(vino);
}

function goBack() {
  routeBack(renderHome);
}

function showTab(tab) {
  routeTab(tab, { renderHome, renderDNA, renderLeaderboard });
}

function verifyOnboardingOtp() {
  return verifyOtp(openWine, renderHome);
}

function saveWine() {
  return saveWineView(renderHome);
}

function simulateNfcTap() {
  simulateNfcTapView(openWine);
}

function returnToOnboarding(message) {
  if (authTransitionInProgress) return;
  authTransitionInProgress = true;
  clearUserState();
  clearDnaCache();
  clearLeaderboardCache();
  closeSettings();
  resetOnboarding();
  showScreen('onboarding');
  if (message) showToast(message, 'error');
  queueMicrotask(() => {
    authTransitionInProgress = false;
  });
}

function bindStaticEvents() {
  document.getElementById('onboarding-request-btn').addEventListener('click', requestOtp);
  document.getElementById('onboarding-verify-btn').addEventListener('click', verifyOnboardingOtp);
  document.getElementById('onboarding-reset-btn').addEventListener('click', restartOtpFlow);
  document.getElementById('loading-retry-btn').addEventListener('click', () => {
    window.location.reload();
  });

  ['input-nome', 'input-email'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', event => {
      if (event.key === 'Enter') requestOtp();
    });
  });
  document.getElementById('input-otp').addEventListener('keydown', event => {
    if (event.key === 'Enter') verifyOnboardingOtp();
  });

  document.querySelectorAll('.js-open-settings').forEach(button => {
    button.addEventListener('click', openSettings);
  });
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.addEventListener('click', () => showTab(button.dataset.tab));
  });

  document.getElementById('simulate-nfc-btn').addEventListener('click', simulateNfcTap);
  document.getElementById('wine-back-btn').addEventListener('click', goBack);
  document.querySelectorAll('[data-rating]').forEach(slider => {
    slider.addEventListener('input', () => updateSlider(slider.dataset.rating, slider));
  });
  document.querySelectorAll('[data-emotion]').forEach(button => {
    button.addEventListener('click', () => selectEmo(button, button.dataset.emotion));
  });
  document.getElementById('request-contact-btn').addEventListener('click', requestContact);
  document.getElementById('save-wine-btn').addEventListener('click', saveWine);
  document.getElementById('share-dna-btn').addEventListener('click', shareDNA);

  document.getElementById('settings-overlay').addEventListener('click', closeSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
  document.getElementById('settings-logout-btn').addEventListener('click', logout);
  document.getElementById('settings-nome').addEventListener('keydown', event => {
    if (event.key === 'Enter') saveSettings();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeSettings();
  });
  window.addEventListener('vino:session-expired', () => {
    returnToOnboarding('Sessione scaduta. Accedi di nuovo.');
  });
  window.addEventListener('vino:logged-out', () => {
    clearDnaCache();
    resetOnboarding();
    showScreen('onboarding');
    showToast('Sessione chiusa.');
  });
  window.addEventListener('online', () => {
    flushOutbox();
  });
}

function routeInitialScreen() {
  const { vino: vinoId, eventId } = getVinoFromURL();
  
  if (eventId) {
    state.eventId = eventId;
  }

  if (!vinoId) {
    if (state.utente.id) {
      showScreen('home');
      renderHome();
    } else {
      showScreen('onboarding');
    }
    return;
  }

  const vino = viniDB.find(item => item.id === vinoId);
  if (!vino) {
    cleanURL();
    showToast('Vino non trovato.', 'error');
    routeInitialScreen();
    return;
  }

  if (state.utente.id) {
    openWine(vino);
  } else {
    setPendingVinoId(vinoId);
    showScreen('onboarding');
  }
}

/**
 * Estrae i parametri di sessione dal frammento URL (hash) emesso da Supabase
 * dopo un Magic Link (es: #access_token=...&refresh_token=...&type=signup).
 * Pulisce subito l'hash dall'URL per evitare che i token restino nella cronologia
 * del browser. Restituisce null se l'hash non contiene un token valido.
 */
function consumeMagicLinkHash() {
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return null;

  // Rimuovi subito l'hash dalla barra degli indirizzi (history API, senza reload).
  window.history.replaceState(null, '', window.location.pathname + window.location.search);

  try {
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

async function initApp() {
  bindStaticEvents();
  showScreen('loading');
  document.getElementById('loading-status').textContent = '';
  document.getElementById('loading-retry-btn').hidden = true;

  const { eventId } = getVinoFromURL();
  if (eventId) {
    state.eventId = eventId;
  }

  try {
    const wines = await API.getWines();
    setViniDB(wines);
  } catch (error) {
    console.error('Catalogo non disponibile:', error);
    showToast('Impossibile caricare il catalogo', 'error');
    showScreen('onboarding');
    return;
  }

  // Gestione Magic Link: se Supabase ha reindirizzato qui con i token nell'hash,
  // li scambiamo subito con una sessione sicura a cookie prima di qualsiasi altra cosa.
  const magicLinkTokens = consumeMagicLinkHash();
  if (magicLinkTokens) {
    try {
      const result = await API.exchangeTokens(
        magicLinkTokens.accessToken,
        magicLinkTokens.refreshToken
      );
      if (result?.user?.id) {
        setAuthenticatedUser(result.user);
        try {
          await loadState(API.getTastings);
        } catch (error) {
          console.error('Sincronizzazione assaggi non riuscita:', error);
          showToast('Accesso riuscito; gli assaggi saranno sincronizzati più tardi.', 'error');
        }
        routeInitialScreen();
        return;
      }
    } catch (error) {
      console.error('Scambio Magic Link non riuscito:', error);
      showToast(
        error instanceof ApiError && error.status < 500
          ? 'Il link di accesso non è più valido. Richiedi un nuovo codice.'
          : 'Accesso temporaneamente non disponibile. Riprova tra poco.',
        'error'
      );
      showScreen('onboarding');
      return;
    }
  }

  try {
    const session = await API.getSession();
    if (session?.user?.id) {
      setAuthenticatedUser(session.user);
      try {
        await loadState(API.getTastings);
      } catch (error) {
        console.error('Sincronizzazione assaggi non riuscita:', error);
        if (state.utente.id) showToast('Assaggi temporaneamente non disponibili', 'error');
      }
    }
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearUserState();
    } else {
      console.error('Verifica sessione non riuscita:', error);
      document.getElementById('loading-status').textContent =
        'Sessione temporaneamente non verificabile. I cookie non sono stati cancellati.';
      document.getElementById('loading-retry-btn').hidden = false;
      return;
    }
  }

  if (navigator.onLine) {
    flushOutbox();
  }

  routeInitialScreen();
}

initApp();

if ('serviceWorker' in navigator) {
  let serviceWorkerReloading = false;
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'FLUSH_OUTBOX') {
      import('./src/outbox.js').then(m => m.flushOutbox());
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (serviceWorkerReloading) return;
    serviceWorkerReloading = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(error => console.error('Errore Service Worker:', error));
  });
}
