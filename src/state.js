// ═══════════════════════════════════════════════════
// STATE — stato volatile; l'identità arriva dal server
// ═══════════════════════════════════════════════════

/**
 * @typedef {{id: string, nome?: string, cantina?: string, territorio?: string, annata?: string, vitigno?: string, desc?: string, colore?: string, emoji?: string}} Wine
 * @typedef {{id: string, nome: string, email: string}} User
 * @typedef {{vino: Wine, version: number, acidita: number, corpo: number, persistenza: number, emozione: string, timestamp: Date}} Tasting
 * @typedef {Readonly<{generation: number, userId: string, eventId: string}>} SessionContext
 * @typedef {{id: string, nome: string, inizio: string, fine: string, timezone: string}} Event
 */
/** @type {Wine[]} */
export let viniDB = [];

/** @type {{utente: User, assaggi: Tasting[], vinoCorrente: Wine | null, emozioneSelezionata: string | null, viniQueue: Wine[], eventId: string, event: Event | null, tastingsLoaded: boolean}} */
export const state = {
  utente: { id: '', nome: '', email: '' },
  assaggi: [],
  vinoCorrente: null,
  emozioneSelezionata: null,
  viniQueue: [],
  eventId: '',
  event: null,
  tastingsLoaded: false
};

/** @type {string | null} */
export let pendingVinoId = null;
let sessionGeneration = 0;
let loadGeneration = 0;

export function invalidateSessionOperations() {
  sessionGeneration += 1;
  loadGeneration += 1;
}

/** @returns {SessionContext} */
export function captureSession() {
  return Object.freeze({ generation: sessionGeneration, userId: state.utente.id, eventId: state.eventId });
}

/** @param {SessionContext} context */
export function isCurrentSession(context) {
  return context.generation === sessionGeneration
    && context.userId === state.utente.id && context.eventId === state.eventId;
}

/** @param {string} eventId */
export function setActiveEvent(eventId) {
  if (eventId === state.eventId) return;
  invalidateSessionOperations();
  state.eventId = eventId;
  state.assaggi = [];
  state.tastingsLoaded = false;
  state.vinoCorrente = null;
  state.emozioneSelezionata = null;
}

const LEGACY_STORAGE_KEYS = Object.freeze([
  'vinoPassportToken',
  'vinoPassportState'
]);

/** @param {Pick<Storage, 'removeItem'>} [storage] */
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

/** @param {string | null} id */
export function setPendingVinoId(id) {
  pendingVinoId = id;
}

/** @param {Wine[] | null} vini */
export function setViniDB(vini) {
  viniDB = Array.isArray(vini) ? vini : [];
  state.viniQueue = [...viniDB];
}

/** @param {Partial<User> | null} user */
export function setAuthenticatedUser(user) {
  if ((user?.id || '') !== state.utente.id) {
    invalidateSessionOperations();
    state.assaggi = [];
    state.tastingsLoaded = false;
    state.vinoCorrente = null;
    state.emozioneSelezionata = null;
  }
  state.utente = {
    id: user?.id || '',
    nome: user?.nome || '',
    email: user?.email || ''
  };
}

export function clearUserState() {
  invalidateSessionOperations();
  clearLegacyClientStorage();
  state.utente = { id: '', nome: '', email: '' };
  state.assaggi = [];
  state.tastingsLoaded = false;
  state.vinoCorrente = null;
  state.emozioneSelezionata = null;
  pendingVinoId = null;
}

/**
 * Sincronizza i dati solo dopo che /api/auth/session ha confermato l'identità.
 * Nessun dato in Web Storage viene usato come prova di autenticazione.
 * @param {(eventId: string) => Promise<Tasting[]>} fetchTastings
 * @returns {Promise<boolean>} True solo se il risultato è applicato al contesto corrente.
 */
export async function loadState(fetchTastings) {
  const context = captureSession();
  const generation = ++loadGeneration;
  const tastings = context.userId ? await fetchTastings(context.eventId) : [];
  if (!isCurrentSession(context) || generation !== loadGeneration) return false;
  state.assaggi = tastings;
  state.tastingsLoaded = Boolean(context.userId);
  return true;
}
