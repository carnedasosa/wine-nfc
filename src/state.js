// ═══════════════════════════════════════════════════
// STATE — stato volatile; l'identità arriva dal server
// ═══════════════════════════════════════════════════

export let viniDB = [];

export const state = {
  utente: { id: '', nome: '', email: '' },
  assaggi: [],
  vinoCorrente: null,
  emozioneSelezionata: null,
  viniQueue: [],
  eventId: 'legacy-event-id'
};

export let pendingVinoId = null;

const LEGACY_STORAGE_KEYS = Object.freeze([
  'vinoPassportToken',
  'vinoPassportState'
]);

export function clearLegacyClientStorage(storage) {
  if (storage === undefined) {
    try { storage = globalThis.localStorage; } catch { return; }
  }
  if (!storage || typeof storage.removeItem !== 'function') return;
  for (const key of LEGACY_STORAGE_KEYS) {
    try { storage.removeItem(key); } catch { /* Storage può essere disabilitato. */ }
  }
}

// Bonifica one-shot dei JWT e dei dati personali lasciati dalle versioni pre-M1.
try { clearLegacyClientStorage(); } catch { /* Nessun Web Storage disponibile. */ }

export function setPendingVinoId(id) {
  pendingVinoId = id;
}

export function setViniDB(vini) {
  viniDB = Array.isArray(vini) ? vini : [];
  state.viniQueue = [...viniDB];
}

export function setAuthenticatedUser(user) {
  state.utente = {
    id: user?.id || '',
    nome: user?.nome || '',
    email: user?.email || ''
  };
}

export function clearUserState() {
  clearLegacyClientStorage();
  state.utente = { id: '', nome: '', email: '' };
  state.assaggi = [];
  state.vinoCorrente = null;
  state.emozioneSelezionata = null;
  pendingVinoId = null;
}

/**
 * Sincronizza i dati solo dopo che /api/auth/session ha confermato l'identità.
 * Nessun dato in Web Storage viene usato come prova di autenticazione.
 */
export async function loadState(fetchTastings) {
  state.assaggi = state.utente.id ? await fetchTastings(state.eventId) : [];
}
