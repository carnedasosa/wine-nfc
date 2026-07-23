// ═══════════════════════════════════════════════════
// STATE — sorgente unica di verità
// ═══════════════════════════════════════════════════

export let viniDB = [];

export let state = {
  utente: { nome: '', email: '' },
  assaggi: [],
  vinoCorrente: null,
  emozioneSelezionata: null,
  viniQueue: []
};

export let pendingVinoId = null;

export function setPendingVinoId(id) {
  pendingVinoId = id;
}

export function setViniDB(vini) {
  viniDB = vini;
  state.viniQueue = [...vini];
}

// ═══════════════════════════════════════════════════
// TOKEN JWT
// ═══════════════════════════════════════════════════

const TOKEN_KEY = 'vinoPassportToken';

/**
 * Salva il JWT in localStorage.
 * @param {string} token
 */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/**
 * Recupera il JWT da localStorage.
 * @returns {string|null}
 */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/**
 * Cancella il JWT da localStorage (logout).
 */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Restituisce true se esiste un token salvato.
 * Non verifica la firma (operazione lato server).
 * @returns {boolean}
 */
export function isAuthenticated() {
  return !!getToken();
}

// ═══════════════════════════════════════════════════
// PERSISTENZA LOCALE
// ═══════════════════════════════════════════════════

export function saveState() {
  try {
    const dataToSave = {
      utente: state.utente,
      assaggi: state.assaggi
    };
    localStorage.setItem('vinoPassportState', JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Errore nel salvataggio in localStorage:', e);
  }
}

/**
 * Carica lo stato da localStorage. Se l'utente ha un id e un token valido,
 * delega il fetch degli assaggi alla funzione passata come parametro
 * (così state.js non dipende da api.js — Dependency Inversion).
 *
 * Il parametro fetchTastings non riceve più userId: il token JWT allegato
 * automaticamente dagli header in API.getTastings() identifica l'utente.
 *
 * @param {() => Promise<Array>} fetchTastings
 */
export async function loadState(fetchTastings) {
  try {
    const stored = localStorage.getItem('vinoPassportState');
    if (!stored) return;

    const parsed = JSON.parse(stored);
    if (parsed.utente) state.utente = parsed.utente;

    if (state.utente && state.utente.id && getToken()) {
      try {
        const tastings = await fetchTastings();
        state.assaggi = tastings;
        saveState();
      } catch (e) {
        console.error('Sync assaggi fallito, uso cache locale:', e);
        if (parsed.assaggi) {
          state.assaggi = parsed.assaggi.map(a => ({
            ...a,
            timestamp: new Date(a.timestamp)
          }));
        }
      }
    } else if (parsed.assaggi) {
      state.assaggi = parsed.assaggi.map(a => ({
        ...a,
        timestamp: new Date(a.timestamp)
      }));
    }
  } catch (e) {
    console.error('Errore nel caricamento dal localStorage:', e);
    localStorage.removeItem('vinoPassportState');
  }
}
