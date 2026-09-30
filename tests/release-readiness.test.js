import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import { API } from '../src/api.js';
import { getVinoFromURL, cleanURL } from '../src/router.js';
import { flushOutbox, saveTastingToOutbox } from '../src/outbox.js';
const { assertEventOpen, resolveEventId } = require('../lib/event');
const { validateTastingPayload } = require('../utils/validation');
const { requestEmailOtp } = require('../lib/supabase-auth');

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('regressioni della release fiera', () => {
  it('conserva eventId quando si consuma il deep link NFC', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', { location: { href: 'https://example.com/?eventId=evento&vino=rosso', search: '?eventId=evento&vino=rosso' }, history: { replaceState } });
    vi.stubGlobal('document', { title: 'Vino' });
    expect(getVinoFromURL()).toEqual({ vino: 'rosso', eventId: 'evento' });
    cleanURL();
    expect(replaceState.mock.calls[0][2]).toBe('https://example.com/?eventId=evento');
  });

  it('in produzione rifiuta evento legacy, mancante o differente da quello configurato', () => {
    expect(() => resolveEventId(null, { NODE_ENV: 'production' })).toThrow();
    expect(() => resolveEventId('legacy-event-id', { NODE_ENV: 'production' })).toThrow();
    expect(() => resolveEventId('11111111-1111-4111-8111-111111111111', { ACTIVE_EVENT_ID: '22222222-2222-4222-8222-222222222222' })).toThrow();
  });

  it('apre alla data iniziale e chiude esattamente a quella finale', () => {
    const event = { stato: 'active', inizio: new Date('2026-10-25T10:00:00+01:00'), fine: new Date('2026-10-25T20:00:00+01:00') };
    expect(() => assertEventOpen(event, event.inizio)).not.toThrow();
    expect(() => assertEventOpen(event, new Date('2026-10-25T08:59:59Z'))).toThrow();
    expect(() => assertEventOpen(event, event.fine)).toThrow();
    expect(() => assertEventOpen({ ...event, stato: 'draft' }, event.inizio)).toThrow();
  });

  it('non invia vecchie code offline con il cookie di un altro utente', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    expect(await flushOutbox()).toBe(0);
    await expect(saveTastingToOutbox({})).rejects.toThrow('Connessione assente');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('un Retry-After lungo interrompe i tentativi automatici e informa l’utente', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'Attendi' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '60' } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(API.getWines('evento')).rejects.toThrow('60 secondi');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un voto deve dichiarare la versione letta e una chiave UUID reale', () => {
    const input = { eventId: '11111111-1111-4111-8111-111111111111', wineId: 'rosso', acidita: 3, corpo: 3, persistenza: 3, emozione: 'Pace', idempotencyKey: '22222222-2222-4222-8222-222222222222', baseVersion: 0 };
    expect(validateTastingPayload(input).baseVersion).toBe(0);
    expect(() => validateTastingPayload({ ...input, baseVersion: undefined })).toThrow();
    expect(() => validateTastingPayload({ ...input, idempotencyKey: 'mock-uuid-123' })).toThrow();
  });

  it('il service worker non intercetta catalogo, sessione o assaggi', () => {
    const handlers = {};
    vm.runInNewContext(fs.readFileSync('service-worker.js', 'utf8'), { URL, self: { location: { origin: 'https://example.com' }, addEventListener: (name, handler) => { handlers[name] = handler; } } });
    for (const route of ['wines', 'auth/session', 'tastings']) {
      const respondWith = vi.fn();
      handlers.fetch({ request: { url: 'https://example.com/api/' + route, method: 'GET' }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it('inoltra IP solo con la secret key server e indirizzo valido', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb_secret_test');
    const fetchMock = vi.fn().mockImplementation(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await requestEmailOtp('test@example.com', '203.0.113.4');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ apikey: 'sb_secret_test', 'Sb-Forwarded-For': '203.0.113.4' });
    await requestEmailOtp('test@example.com', 'spoofed, 1.2.3.4');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Sb-Forwarded-For');
  });
});
