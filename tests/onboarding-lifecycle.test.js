import { beforeEach, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';
vi.mock('../src/router.js', () => ({ showScreen: vi.fn() }));
vi.mock('../src/utils.js', () => ({ showToast: vi.fn() }));
vi.mock('../src/ui/tutorial.js', () => ({ openTutorial: vi.fn() }));
let ui, API, store, fields, showScreen;
beforeEach(async () => {
  vi.resetModules(); fields = new Map();
  vi.stubGlobal('document', { getElementById: id => {
    if (!fields.has(id)) fields.set(id, { value: '', disabled: false, hidden: false, focus: vi.fn(), select: vi.fn(), textContent: 'Button' });
    return fields.get(id);
  } });
  store = await import('../src/state.js');
  ({ API } = await import('../src/api.js'));
  ({ showScreen } = await import('../src/router.js'));
  ui = await import('../src/ui/onboarding.js');
  ui.resetOnboarding();
  fields.get('input-nome').value = 'Ada'; fields.get('input-email').value = 'ada@example.test';
  vi.spyOn(API, 'requestOtp').mockResolvedValue({});
  vi.spyOn(API, 'verifyOtp').mockResolvedValue({ user: { id: 'A', nome: 'Ada' } });
  vi.spyOn(API, 'getTastings').mockResolvedValue([]);
});

it('una vecchia richiesta OTP non riapre il modulo dopo reset', async () => {
  const pending = deferred(); API.requestOtp.mockReturnValue(pending.promise);
  const request = ui.requestOtp(); ui.resetOnboarding(); pending.resolve({}); await request;
  expect(fields.get('onboarding-otp-group').hidden).toBe(true);
  expect(fields.get('input-email').value).toBe('');
});

it('una verifica tardiva non ripristina l’utente dopo invalidazione', async () => {
  await ui.requestOtp(); fields.get('input-otp').value = '123456';
  const pending = deferred(); API.verifyOtp.mockReturnValue(pending.promise);
  const verify = ui.verifyOtp(vi.fn(), vi.fn());
  store.clearUserState(); ui.resetOnboarding();
  pending.resolve({ user: { id: 'A' } }); await verify;
  expect(store.state.utente.id).toBe('');
  expect(API.getTastings).not.toHaveBeenCalled();
  expect(showScreen).not.toHaveBeenCalled();
});

it('un cambio di sessione durante il caricamento non naviga alla home', async () => {
  await ui.requestOtp(); fields.get('input-otp').value = '123456';
  const pending = deferred(); API.getTastings.mockReturnValue(pending.promise);
  const renderHome = vi.fn(); const verify = ui.verifyOtp(vi.fn(), renderHome);
  await vi.waitFor(() => expect(API.getTastings).toHaveBeenCalledOnce());
  store.clearUserState(); ui.resetOnboarding(); pending.resolve([]); await verify;
  expect(renderHome).not.toHaveBeenCalled(); expect(showScreen).not.toHaveBeenCalled();
  expect(fields.get('onboarding-verify-btn').disabled).toBe(false);
});

it('una sola verifica può emettere cookie e il reset manuale attende il completamento', async () => {
  await ui.requestOtp(); fields.get('input-otp').value = '123456';
  const pending = deferred(); API.verifyOtp.mockReturnValue(pending.promise);
  const first = ui.verifyOtp(vi.fn(), vi.fn());
  ui.restartOtpFlow(); await ui.verifyOtp(vi.fn(), vi.fn());
  expect(API.verifyOtp).toHaveBeenCalledOnce(); expect(fields.get('onboarding-otp-group').hidden).toBe(false);
  pending.resolve({ user: { id: 'A' } }); await first;
  expect(showScreen).toHaveBeenCalledWith('home');
});
