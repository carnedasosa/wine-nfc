import { beforeEach, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';
let store;
beforeEach(async () => {
  vi.resetModules(); store = await import('../src/state.js');
  store.setAuthenticatedUser({ id: 'A', nome: 'Ada' }); store.setActiveEvent('event-A');
});
it('scarta una lettura della precedente sessione anche con lo stesso userId', async () => {
  const response = deferred();
  const loading = store.loadState(() => response.promise);
  store.clearUserState(); store.setAuthenticatedUser({ id: 'A' });
  response.resolve([{ version: 1 }]);
  expect(await loading).toBe(false);
  expect(store.state.assaggi).toEqual([]);
});
it('la lettura più recente prevale indipendentemente dall’ordine delle risposte', async () => {
  const old = deferred();
  const first = store.loadState(() => old.promise);
  await store.loadState(async () => [{ version: 2 }]);
  old.resolve([{ version: 1 }]);
  expect(await first).toBe(false);
  expect(store.state.assaggi).toEqual([{ version: 2 }]);
});
it('un aggiornamento del nome non invalida la sessione ma un cambio evento sì', () => {
  const context = store.captureSession();
  store.setAuthenticatedUser({ id: 'A', nome: 'Ada aggiornata' });
  expect(store.isCurrentSession(context)).toBe(true);
  store.setActiveEvent('event-B'); store.setActiveEvent('event-A');
  expect(store.isCurrentSession(context)).toBe(false);
});
