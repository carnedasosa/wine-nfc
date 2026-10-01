// Solo un segnale opaco: nessun token, profilo o assaggio in Web Storage.
const KEY = 'vino-session-change';
let channel;
let lastMarker;

function readMarker() {
  try { return globalThis.localStorage?.getItem(KEY); } catch { return null; }
}

export function startSessionSync(onChange) {
  lastMarker = readMarker();
  const receive = marker => {
    if (typeof marker !== 'string' || marker === lastMarker) return;
    lastMarker = marker;
    onChange();
  };
  const storage = event => { if (event.key === KEY) receive(event.newValue); };
  const visible = () => { if (document.visibilityState === 'visible') receive(readMarker()); };
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(KEY);
      channel.onmessage = event => receive(event.data);
    } catch { /* Contesti con storage isolato: resta il vincolo server d'identità. */ }
  }
  window.addEventListener('storage', storage);
  document.addEventListener('visibilitychange', visible);
  return () => {
    channel?.close(); channel = undefined;
    window.removeEventListener('storage', storage);
    document.removeEventListener('visibilitychange', visible);
  };
}

export function notifySessionChanged() {
  lastMarker = crypto.randomUUID();
  try { globalThis.localStorage?.setItem(KEY, lastMarker); } catch { /* Browser privato: resta il canale. */ }
  channel?.postMessage(lastMarker);
}

// Cookie condivisi fra tab: serializzare le risposte che li sostituiscono.
// I browser senza Web Locks mantengono le guardie locali e il vincolo server d'identità.
export function withSessionLock(operation) {
  const marker = readMarker();
  const guarded = () => {
    if (readMarker() !== marker) throw new Error('Sessione modificata in un’altra scheda. Ricarica per continuare.');
    return operation();
  };
  return globalThis.navigator?.locks?.request
    ? navigator.locks.request('vino-session-cookie', guarded)
    : guarded();
}
