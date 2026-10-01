import { beforeEach, expect, it, vi } from 'vitest';
let sync, events, documentEvents, storage, channel;
beforeEach(async () => {
  vi.resetModules(); events = {}; documentEvents = {}; storage = new Map();
  vi.stubGlobal('window', { addEventListener: (name, fn) => { events[name] = fn; }, removeEventListener: vi.fn() });
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: (name, fn) => { documentEvents[name] = fn; }, removeEventListener: vi.fn() });
  vi.stubGlobal('localStorage', { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) });
  vi.stubGlobal('BroadcastChannel', class { constructor() { channel = this; } postMessage = vi.fn(); close = vi.fn(); });
  sync = await import('../src/session-sync.js');
});

it('notifica una sola volta per marker ricevuto su storage e canale', () => {
  const changed = vi.fn(); const stop = sync.startSessionSync(changed);
  events.storage({ key: 'vino-session-change', newValue: 'new-session' });
  channel.onmessage({ data: 'new-session' });
  expect(changed).toHaveBeenCalledOnce();
  stop(); expect(channel.close).toHaveBeenCalledOnce();
});

it('recupera un cambio perso quando la scheda torna visibile', () => {
  const changed = vi.fn(); sync.startSessionSync(changed);
  storage.set('vino-session-change', 'another-session');
  documentEvents.visibilitychange();
  expect(changed).toHaveBeenCalledOnce();
});

it('pubblica solo un identificatore opaco senza invalidare la propria UI', () => {
  const changed = vi.fn(); sync.startSessionSync(changed); sync.notifySessionChanged();
  expect(channel.postMessage).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9-]{36}$/));
  documentEvents.visibilitychange();
  expect(changed).not.toHaveBeenCalled();
});

it('rifiuta un’operazione cookie accodata prima del cambio di sessione', async () => {
  let acquire;
  vi.stubGlobal('navigator', { locks: { request: (_name, callback) => { acquire = callback; return Promise.resolve(); } } });
  const operation = vi.fn(); await sync.withSessionLock(operation);
  storage.set('vino-session-change', 'session-B');
  expect(() => acquire()).toThrow('Sessione modificata');
  expect(operation).not.toHaveBeenCalled();
});

it('rimane utilizzabile se i canali e Web Storage sono bloccati', () => {
  vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('denied'); } });
  vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
  expect(() => { sync.startSessionSync(vi.fn()); sync.notifySessionChanged(); }).not.toThrow();
});
