import { expect, it, vi } from 'vitest';
const { getRequestId, logError, logInfo } = require('../lib/logger');

it('non riversa messaggi provider, credenziali o dati di dominio nei log', () => {
  const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
  const infoLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const secret = 'email-personale@example.test bearer-secret database-url';
  logError('request', 'Salvataggio fallito', Object.assign(new Error(secret), { code: 'P2002', meta: secret }), { body: secret, cookie: secret, count: 2 });
  logInfo('request', 'Lettura completata', { userId: secret, status: 200 });
  expect(JSON.stringify([...errorLog.mock.calls, ...infoLog.mock.calls])).not.toContain(secret);
  expect(JSON.parse(errorLog.mock.calls[0][0])).toMatchObject({ error: 'P2002', count: 2 });
  expect(JSON.parse(infoLog.mock.calls[0][0])).toMatchObject({ status: 200 });
});

it('sostituisce request id arbitrari con identificatori limitati', () => {
  expect(getRequestId({ headers: { 'x-request-id': 'email@example.test\nsegreto' } })).toMatch(/^[a-f0-9-]{36}$/);
});
