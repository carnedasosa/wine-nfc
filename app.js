// ═══════════════════════════════════════════════════
// APP.JS — Entry point. Solo orchestrazione.
// Nessuna logica di business qui.
// ═══════════════════════════════════════════════════

import { state, viniDB, pendingVinoId, setPendingVinoId, setViniDB, loadState, setToken } from './src/state.js';
import { API } from './src/api.js';
import { showScreen, showTab as _showTab, goBack as _goBack, getVinoFromURL, cleanURL, setPreviousScreen } from './src/router.js';
import { showToast } from './src/utils.js';

import { startPassport as _startPassport } from './src/ui/onboarding.js';
import { renderHome as _renderHome } from './src/ui/home.js';
import { openWine as _openWine, updateSlider, selectEmo, saveWine as _saveWine, simulateNfcTap as _simulateNfcTap, requestContact } from './src/ui/wine.js';
import { renderDNA, shareDNA } from './src/ui/dna.js';
import { renderLeaderboard } from './src/ui/leaderboard.js';
import { openSettings, closeSettings, saveSettings } from './src/ui/settings.js';

// ─── Wrappers senza argomenti (compatibilità onclick="..." nell'HTML) ──────────

function renderHome() {
  _renderHome(openWine);
}

function openWine(vino) {
  setPreviousScreen('home');
  _openWine(vino);
}

function goBack() {
  _goBack(renderHome);
}

function showTab(tab) {
  _showTab(tab, { renderHome, renderDNA, renderLeaderboard });
}

function startPassport() {
  _startPassport(openWine, renderHome);
}

function saveWine() {
  _saveWine(renderHome);
}

function simulateNfcTap() {
  _simulateNfcTap(openWine);
}

// ─── Espone le funzioni sull'oggetto window ──────────────────────────────────
// I moduli ES non sono globali. Le funzioni richiamate via onclick="..."
// nell'HTML devono essere esplicitamente registrate su window.

Object.assign(window, {
  startPassport,
  openWine,
  goBack,
  showTab,
  simulateNfcTap,
  updateSlider,
  selectEmo,
  saveWine,
  requestContact,
  shareDNA,
  openSettings,
  closeSettings,
  saveSettings
});

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initApp() {
  showScreen('loading');
  try {
    const vini = await API.getWines();
    setViniDB(vini);

    await loadState(API.getTastings);

    const vinoId = getVinoFromURL();

    if (vinoId) {
      const vino = viniDB.find(v => v.id === vinoId);
      if (!vino) {
        showToast('Vino non trovato.', 'error');
        cleanURL();
        if (state.utente.nome) {
          showScreen('home');
          renderHome();
        } else {
          showScreen('onboarding');
        }
        return;
      }
      cleanURL();
      if (state.utente.nome) {
        openWine(vino);
      } else {
        setPendingVinoId(vinoId);
        showScreen('onboarding');
      }
    } else {
      if (state.utente.nome) {
        showScreen('home');
        renderHome();
      } else {
        showScreen('onboarding');
      }
    }
  } catch (e) {
    console.error(e);
    showToast('Impossibile caricare il catalogo', 'error');
  }
}

initApp();

// ─── Service Worker ───────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registrato', reg.scope))
      .catch(err => console.error('Errore Service Worker', err));
  });
}
