// ═══════════════════════════════════════════════════
// APP.JS — entry point e registrazione eventi
// ═══════════════════════════════════════════════════

import {
  clearUserState,
  captureSession,
  isCurrentSession,
  loadState,
  setAuthenticatedUser,
  setActiveEvent,
  setPendingVinoId,
  setViniDB,
  state,
  viniDB
} from './src/state.js';
import { API, ApiError } from './src/api.js';
import { startSessionSync } from './src/session-sync.js';
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
import { bindTutorialEvents, closeTutorial, openTutorial } from './src/ui/tutorial.js';
import {
  openWine as openWineView,
  retryWineLoad,
  saveWine as saveWineView,
  selectEmo,
  updateSlider
} from './src/ui/wine.js';
import { clearDnaCache, renderDNA, shareDNA } from './src/ui/dna.js';
import { bindStoryEvents } from './src/ui/story.js';
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

function returnToOnboarding(message) {
  if (authTransitionInProgress) return;
  authTransitionInProgress = true;
  closeTutorial({ restoreFocus: false });
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
  bindTutorialEvents();
  bindStoryEvents();
  document.getElementById('onboarding-request-btn').addEventListener('click', requestOtp);
  document.getElementById('onboarding-verify-btn').addEventListener('click', verifyOnboardingOtp);
  document.getElementById('onboarding-reset-btn').addEventListener('click', restartOtpFlow);


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

  document.getElementById('wine-back-btn').addEventListener('click', goBack);
  document.querySelectorAll('[data-rating]').forEach(slider => {
    slider.addEventListener('input', () => updateSlider(slider.dataset.rating, slider));
  });
  document.querySelectorAll('[data-emotion]').forEach(button => {
    button.addEventListener('click', () => selectEmo(button, button.dataset.emotion));
  });
  document.getElementById('save-wine-btn').addEventListener('click', saveWine);
  document.getElementById('wine-retry-btn').addEventListener('click', retryWineLoad);
  document.getElementById('share-dna-btn').addEventListener('click', shareDNA);

  document.getElementById('settings-overlay').addEventListener('click', closeSettings);
  document.getElementById('settings-close-btn').addEventListener('click', closeSettings);
  document.getElementById('settings-save-btn').addEventListener('click', saveSettings);
  document.getElementById('settings-logout-btn').addEventListener('click', logout);
  document.getElementById('settings-tutorial-btn').addEventListener('click', () => {
    closeSettings();
    openTutorial({ force: true });
  });
  document.getElementById('settings-nome').addEventListener('keydown', event => {
    if (event.key === 'Enter') saveSettings();
  });

  document.addEventListener('keydown', event => {
    if (document.getElementById('tutorial-dialog').open || document.getElementById('story-dialog').open) return;
    if (event.key === 'Escape') closeSettings();
    const panel = document.getElementById('settings-panel');
    if (event.key === 'Tab' && !panel.inert) {
      const focusable = [...panel.querySelectorAll('button:not(:disabled), input:not(:disabled), a[href]')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  window.addEventListener('vino:session-expired', () => {
    returnToOnboarding('Sessione scaduta. Accedi di nuovo.');
  });
  window.addEventListener('vino:logged-out', () => {
    closeTutorial({ restoreFocus: false });
    clearDnaCache();
    resetOnboarding();
    showScreen('onboarding');
    showToast('Sessione chiusa.');
  });
}

function routeInitialScreen() {
  const { vino: vinoId, eventId } = getVinoFromURL();
  
  if (eventId) {
    setActiveEvent(eventId);
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
  startSessionSync(() => returnToOnboarding('Sessione modificata in un’altra scheda. Ricarica per continuare.'));
  document.getElementById('loading-retry-btn').addEventListener('click', () => window.location.reload());
  showScreen('loading');
  document.getElementById('loading-status').textContent = '';

  const { eventId } = getVinoFromURL();
  if (eventId) {
    setActiveEvent(eventId);
  }

  const magicLinkTokens = consumeMagicLinkHash();
  const initialContext = captureSession();

  const winesPromise = API.getWines(state.eventId);
  let authPromise;

  if (magicLinkTokens) {
    authPromise = API.exchangeTokens(
      magicLinkTokens.accessToken,
      magicLinkTokens.refreshToken
    );
  } else {
    authPromise = API.getSession();
  }

  const [winesResult, authResult] = await Promise.allSettled([winesPromise, authPromise]);
  if (!isCurrentSession(initialContext)) return;

  if (winesResult.status === 'fulfilled') {
    const catalog = winesResult.value;
    setViniDB(catalog.wines);
    state.event = catalog.event;
    setActiveEvent(catalog.event.id);
    const url = new URL(window.location.href);
    url.searchParams.set('eventId', state.eventId);
    window.history.replaceState(null, '', url.pathname + url.search);
    document.querySelector('.fiera-name').textContent = 'Bari · ' + new Date(catalog.event.inizio).toLocaleDateString('it-IT', { timeZone: catalog.event.timezone, day: 'numeric', month: 'long', year: 'numeric' });
  } else {
    console.error('Catalogo non disponibile:', winesResult.reason);
    document.getElementById('loading-status').textContent = winesResult.reason?.message || 'Catalogo non disponibile';
    document.getElementById('loading-retry-btn').hidden = false;
    return;
  }

  if (magicLinkTokens) {
    if (authResult.status === 'fulfilled') {
      const result = authResult.value;
      if (result?.user?.id) {
        setAuthenticatedUser(result.user);
        const context = captureSession();
        try {
          await loadState(API.getTastings);
        } catch (error) {
          if (!isCurrentSession(context)) return;
          console.error('Sincronizzazione assaggi non riuscita:', error);
          showToast('Accesso riuscito; gli assaggi saranno sincronizzati più tardi.', 'error');
        }
        if (!isCurrentSession(context)) return;
        routeInitialScreen();
        openTutorial();
        return;
      }
    } else {
      const error = authResult.reason;
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
  } else {
    if (authResult.status === 'fulfilled') {
      const session = authResult.value;
      if (session?.user?.id) {
        setAuthenticatedUser(session.user);
        const context = captureSession();
        try {
          await loadState(API.getTastings);
        } catch (error) {
          if (!isCurrentSession(context)) return;
          console.error('Sincronizzazione assaggi non riuscita:', error);
          if (state.utente.id) showToast('Assaggi temporaneamente non disponibili', 'error');
        }
        if (!isCurrentSession(context)) return;
      }
    } else {
      const error = authResult.reason;
      if (error?.status === 401 || error?.status === 403) {
        clearUserState();
      } else {
        console.error('Verifica sessione non riuscita:', error);
        showToast('Il server non risponde. L\'app potrebbe non funzionare correttamente.', 'error');
        clearUserState();
      }
    }
  }

  routeInitialScreen();
  openTutorial();
}

initApp();

if ('serviceWorker' in navigator) {

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .catch(error => console.error('Errore Service Worker:', error));
  });
}
