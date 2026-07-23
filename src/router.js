// ═══════════════════════════════════════════════════
// ROUTER — navigazione e URL routing
// ═══════════════════════════════════════════════════

// Exported mutable variable: i moduli che importano questa
// ricevono sempre il valore corrente via getter.
export let previousScreen = 'home';

export function setPreviousScreen(id) {
  previousScreen = id;
}

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

/**
 * Torna alla schermata precedente e ri-renderizza la home se necessario.
 * La dipendenza da renderHome è iniettata per evitare import ciclici.
 * @param {() => void} renderHome
 */
export function goBack(renderHome) {
  showScreen(previousScreen);
  renderHome();
}

/**
 * Attiva un tab della bottom nav.
 * Le dipendenze renderHome/renderDNA sono iniettate.
 */
export function showTab(tab, { renderHome, renderDNA, renderLeaderboard }) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'passport') {
    document.querySelectorAll('.nav-tab')[0].classList.add('active');
    showScreen('home');
    renderHome();
  } else if (tab === 'dna') {
    document.querySelectorAll('.nav-tab')[1].classList.add('active');
    showScreen('dna');
    renderDNA();
  } else if (tab === 'leaderboard') {
    document.querySelectorAll('.nav-tab')[2].classList.add('active');
    showScreen('leaderboard');
    renderLeaderboard();
  }
}

export function getVinoFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('vino');
}

export function cleanURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete('vino');
  window.history.replaceState({}, document.title, url.toString());
}
