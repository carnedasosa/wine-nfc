import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';

vi.mock('../src/ui/dna.js', () => ({ clearDnaCache: vi.fn() }));
vi.mock('../src/ui/leaderboard.js', () => ({ clearLeaderboardCache: vi.fn() }));
vi.mock('../src/router.js', () => ({ showScreen: vi.fn() }));
vi.mock('../src/utils.js', () => ({ showToast: vi.fn(), safeHexColor: () => '#ffffff' }));

let wineUI, store, API, fields, showScreen;
const wine = { id: 'wine-A', nome: 'Rosso' };
const tasting = (version = 7) => ({ vino: wine, version, acidita: 5, corpo: 5, persistenza: 5, emozione: 'Pace' });
beforeEach(async () => {
  vi.resetModules();
  fields = new Map();
  const field = id => {
    if (!fields.has(id)) fields.set(id, {
      value: '3', disabled: false, hidden: false, textContent: '', min: '1', max: '5',
      style: { setProperty: vi.fn() }, setAttribute: vi.fn(),
      classList: { add: vi.fn(), remove: vi.fn(), toggle: vi.fn() }
    });
    return fields.get(id);
  };
  vi.stubGlobal('document', { getElementById: field, querySelector: () => field('save-wine-btn'), querySelectorAll: () => [] });
  vi.stubGlobal('navigator', { onLine: true });
  field('save-wine-btn');
  field('wine-retry-btn').hidden = true;
  store = await import('../src/state.js');
  ({ API } = await import('../src/api.js'));
  ({ showScreen } = await import('../src/router.js'));
  wineUI = await import('../src/ui/wine.js');
  store.setAuthenticatedUser({ id: 'user-A' });
  store.state.eventId = 'event-A';
  vi.spyOn(API, 'getTastings').mockResolvedValue([tasting()]);
  vi.spyOn(API, 'saveTasting').mockImplementation(async input => ({ ...input, version: input.baseVersion + 1, createdAt: new Date().toISOString() }));
});

describe('fotografia del voto mostrato', () => {
  it('carica il voto prima di abilitare il modulo e mostra i valori recuperati', async () => {
    const pending = deferred();
    API.getTastings.mockReturnValue(pending.promise);
    const opening = wineUI.openWine(wine);
    expect(fields.get('save-wine-btn').disabled).toBe(true);
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).not.toHaveBeenCalled();
    pending.resolve([tasting()]);
    await opening;
    expect(fields.get('slider-acidita').value).toBe('5');
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).toHaveBeenCalledWith(expect.objectContaining({ baseVersion: 7, acidita: 5 }));
  });

  it('un caricamento fallito non permette di inviare valori predefiniti', async () => {
    API.getTastings.mockRejectedValueOnce(new Error('offline'));
    await wineUI.openWine(wine);
    store.state.emozioneSelezionata = 'Pace';
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).not.toHaveBeenCalled();
    expect(fields.get('wine-retry-btn').hidden).toBe(false);
  });

  it('usa la versione mostrata anche se lo stato condiviso cambia in seguito', async () => {
    store.state.assaggi = [tasting()]; store.state.tastingsLoaded = true;
    await wineUI.openWine(wine);
    store.state.assaggi = [tasting(8)];
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).toHaveBeenCalledWith(expect.objectContaining({ baseVersion: 7 }));
  });

  it('dopo conflitto richiede una ricarica esplicita prima di un nuovo invio', async () => {
    store.state.assaggi = [tasting()]; store.state.tastingsLoaded = true;
    await wineUI.openWine(wine);
    API.saveTasting.mockRejectedValueOnce(Object.assign(new Error('Conflitto'), { status: 409 }));
    await wineUI.saveWine(vi.fn());
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).toHaveBeenCalledTimes(1);
    API.getTastings.mockResolvedValue([tasting(8)]);
    await wineUI.retryWineLoad();
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).toHaveBeenLastCalledWith(expect.objectContaining({ baseVersion: 8 }));
  });

  it('riusa la stessa chiave dopo esito incerto senza duplicare il doppio click', async () => {
    store.state.assaggi = [tasting()]; store.state.tastingsLoaded = true;
    await wineUI.openWine(wine);
    const pending = deferred();
    API.saveTasting.mockReturnValueOnce(pending.promise);
    const saving = wineUI.saveWine(vi.fn());
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting).toHaveBeenCalledTimes(1);
    pending.reject(new TypeError('Failed to fetch'));
    await saving;
    await wineUI.saveWine(vi.fn());
    expect(API.saveTasting.mock.calls[0][0].idempotencyKey).toBe(API.saveTasting.mock.calls[1][0].idempotencyKey);
  });

  it('non chiude una scheda nuova quando termina il vecchio salvataggio', async () => {
    store.state.assaggi = [tasting()]; store.state.tastingsLoaded = true;
    await wineUI.openWine(wine);
    const pending = deferred();
    API.saveTasting.mockReturnValueOnce(pending.promise);
    const saving = wineUI.saveWine(vi.fn());
    await wineUI.openWine({ id: 'wine-B', nome: 'Bianco' });
    showScreen.mockClear();
    pending.resolve({ ...tasting(), createdAt: new Date().toISOString(), version: 8 });
    await saving;
    expect(showScreen).not.toHaveBeenCalled();
    expect(store.state.vinoCorrente.id).toBe('wine-B');
  });

  it('ignora un caricamento precedente a logout e nuovo login dello stesso utente', async () => {
    const pending = deferred();
    API.getTastings.mockReturnValueOnce(pending.promise);
    const opening = wineUI.openWine(wine);
    store.clearUserState();
    store.setAuthenticatedUser({ id: 'user-A' });
    pending.resolve([tasting()]);
    await opening;
    expect(store.state.assaggi).toEqual([]);
    expect(store.state.tastingsLoaded).toBe(false);
  });
});
