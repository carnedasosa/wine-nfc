import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';
let API, store, fetchMock;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
beforeEach(async () => {
  vi.resetModules();
  store = await import('../src/state.js');
  ({ API } = await import('../src/api.js'));
  store.setAuthenticatedUser({ id: 'A' });
  vi.stubGlobal('document', { cookie: 'vino_csrf=csrf-test' });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
});
describe('richieste e sessione', () => {
  it('vincola al proprietario corrente le richieste e segnala un cambio cookie', async () => {
    vi.stubGlobal('CustomEvent', class { constructor(type) { this.type = type; } });
    fetchMock.mockResolvedValue(json({ code: 'SESSION_CHANGED' }, 409));
    await expect(API.saveParticipation({ eventId: 'event' })).rejects.toMatchObject({ status: 409 });
    expect(fetchMock.mock.calls[0][1].headers.get('X-Vino-User')).toBe('A');
    expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });
  it('ignora un vecchio 401 senza scadere la nuova sessione', async () => {
    const pending = deferred(); fetchMock.mockReturnValueOnce(pending.promise);
    const request = API.getTastings('event-A');
    const rejected = expect(request).rejects.toMatchObject({ data: { code: 'SESSION_CHANGED' } });
    store.clearUserState(); store.setAuthenticatedUser({ id: 'B' });
    pending.resolve(json({}, 401));
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(window.dispatchEvent).not.toHaveBeenCalled();
  });
  it('attende il refresh in corso prima di cancellare i cookie con logout', async () => {
    const refresh = deferred();
    const calls = [];
    fetchMock.mockImplementation(path => {
      calls.push(path);
      if (path === '/api/auth/refresh') return refresh.promise;
      if (path === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(json({}, 401));
    });
    const request = API.getTastings('event-A');
    const rejected = expect(request).rejects.toMatchObject({ data: { code: 'SESSION_CHANGED' } });
    await vi.waitFor(() => expect(calls).toContain('/api/auth/refresh'));
    store.invalidateSessionOperations();
    const logout = API.logout();
    const duplicate = API.logout();
    expect(calls).not.toContain('/api/auth/logout');
    refresh.resolve(json({}));
    await Promise.all([logout, duplicate, rejected]);
    expect(calls.filter(path => path === '/api/auth/logout')).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });
  it('espone il replay senza cambiare gli altri dati del voto', async () => {
    const tasting = { id: 'vote', version: 2, acidita: 4, corpo: 3, persistenza: 2, emozione: 'Pace' };
    fetchMock.mockResolvedValue(json(tasting, 201, { 'Idempotency-Replayed': 'true' }));
    expect(await API.saveTasting({ idempotencyKey: 'key' })).toEqual({ ...tasting, replayed: true });
  });
  it('non interpreta una lettura malformata come passaporto vuoto', async () => {
    fetchMock.mockResolvedValue(json({ error: 'invalid' }));
    await expect(API.getTastings('event')).rejects.toMatchObject({ status: 502 });
  });
  it('non conferma un salvataggio con risposta priva dei valori e della versione', async () => {
    fetchMock.mockResolvedValue(json({ ok: true }));
    await expect(API.saveTasting({ idempotencyKey: 'key' })).rejects.toMatchObject({ status: 502 });
  });
});
