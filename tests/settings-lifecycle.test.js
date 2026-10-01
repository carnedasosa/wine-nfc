import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';

vi.mock('../src/ui/dna.js', () => ({ clearDnaCache: vi.fn(), renderDNA: vi.fn() }));
vi.mock('../src/ui/leaderboard.js', () => ({ clearLeaderboardCache: vi.fn() }));
vi.mock('../src/utils.js', () => ({ showToast: vi.fn() }));

let settings, store, API, fields, showToast;
const user = { id: 'user-A', nome: 'Ada', email: 'ada@example.test' };

beforeEach(async () => {
  vi.resetModules();
  fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, {
      value: '', checked: false, disabled: false, inert: false, focus: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), contains: () => false }
    });
    return fields.get(id);
  };
  vi.stubGlobal('document', { getElementById: field, querySelectorAll: () => [], activeElement: null });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  store = await import('../src/state.js');
  ({ API } = await import('../src/api.js'));
  ({ showToast } = await import('../src/utils.js'));
  settings = await import('../src/ui/settings.js');
  store.setAuthenticatedUser(user);
  store.state.eventId = 'event-A';
  vi.spyOn(API, 'getParticipation').mockResolvedValue({ nickname: 'Ada', consensoLeaderboard: true });
  vi.spyOn(API, 'saveParticipation').mockResolvedValue({});
  vi.spyOn(API, 'logout').mockResolvedValue(null);
  await settings.openSettings();
  field('settings-nome').value = 'Ada aggiornata';
});

describe('ciclo di vita delle impostazioni', () => {
  it('ignora la risposta profilo dopo logout e non invia la seconda scrittura', async () => {
    const pending = deferred();
    vi.spyOn(API, 'updateUser').mockReturnValue(pending.promise);
    const saving = settings.saveSettings();
    await settings.logout();
    pending.resolve({ user: { ...user, nome: 'Ada aggiornata' } });
    await saving;
    expect(store.state.utente.id).toBe('');
    expect(API.saveParticipation).not.toHaveBeenCalled();
  });

  it('una risposta del vecchio account non sostituisce il nuovo', async () => {
    const pending = deferred();
    vi.spyOn(API, 'updateUser').mockReturnValue(pending.promise);
    const saving = settings.saveSettings();
    store.clearUserState();
    store.setAuthenticatedUser({ id: 'user-B', nome: 'Bea' });
    pending.resolve({ user });
    await saving;
    expect(store.state.utente.id).toBe('user-B');
    expect(API.saveParticipation).not.toHaveBeenCalled();
  });

  it('acquisisce nickname e consenso prima della prima attesa', async () => {
    const pending = deferred();
    vi.spyOn(API, 'updateUser').mockReturnValue(pending.promise);
    fields.get('settings-nickname').value = 'Scelta iniziale';
    const saving = settings.saveSettings();
    fields.get('settings-nickname').value = 'Modifica successiva';
    fields.get('settings-leaderboard').checked = false;
    pending.resolve({ user: { ...user, nome: 'Ada aggiornata' } });
    await saving;
    expect(API.saveParticipation).toHaveBeenCalledWith({ eventId: 'event-A', nickname: 'Scelta iniziale', consensoLeaderboard: true });
  });

  it('segnala il salvataggio parziale e al retry non riscrive il nome', async () => {
    vi.spyOn(API, 'updateUser').mockResolvedValue({ user: { ...user, nome: 'Ada aggiornata' } });
    API.saveParticipation.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await settings.saveSettings();
    expect(store.state.utente.nome).toBe('Ada aggiornata');
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('Nome salvato'), 'error');
    await settings.saveSettings();
    expect(API.updateUser).toHaveBeenCalledTimes(1);
    expect(API.saveParticipation).toHaveBeenCalledTimes(2);
  });

  it('non riabilita il pulsante appartenente a una nuova apertura in caricamento', async () => {
    const update = deferred();
    const participation = deferred();
    vi.spyOn(API, 'updateUser').mockReturnValue(update.promise);
    const saving = settings.saveSettings();
    settings.closeSettings();
    API.getParticipation.mockReturnValueOnce(participation.promise);
    const reopening = settings.openSettings();
    update.resolve({ user });
    await saving;
    expect(fields.get('settings-save-btn').disabled).toBe(true);
    participation.resolve({ nickname: '', consensoLeaderboard: false });
    await reopening;
    expect(fields.get('settings-save-btn').disabled).toBe(false);
  });

  it('un doppio logout produce una sola richiesta', async () => {
    const pending = deferred();
    API.logout.mockReturnValue(pending.promise);
    const first = settings.logout();
    const second = settings.logout();
    expect(API.logout).toHaveBeenCalledTimes(1);
    pending.resolve(null);
    await Promise.all([first, second]);
  });
  it('il finally di un vecchio logout non riabilita il pulsante di un nuovo logout', async () => {
    const oldRequest = deferred(); const newRequest = deferred();
    API.logout.mockReturnValueOnce(oldRequest.promise).mockReturnValueOnce(newRequest.promise);
    const oldLogout = settings.logout();
    store.clearUserState(); store.setAuthenticatedUser({ id: 'user-B' }); await settings.openSettings();
    const newLogout = settings.logout();
    oldRequest.resolve(null); await oldLogout;
    expect(fields.get('settings-logout-btn').disabled).toBe(true);
    newRequest.resolve(null); await newLogout;
    expect(fields.get('settings-logout-btn').disabled).toBe(false);
  });
});
