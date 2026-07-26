import { describe, expect, it } from 'vitest';

const {
  EMOTIONS,
  PayloadTooLargeError,
  ValidationError,
  formatValidationError,
  normalizeEmail,
  validateEmail,
  validateDnaPayload,
  validateJsonBody,
  validateName,
  validateOtpRequestPayload,
  validateOtpVerifyPayload,
  validatePagination,
  validateProfileUpdatePayload,
  validateTastingPayload,
  validateWinePayload
} = require('../utils/validation');

const WINE_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('contratti di validazione M1', () => {
  it('normalizza email e nome prima dell’uso', () => {
    expect(normalizeEmail('  Mario.ROSSI@Example.COM ')).toBe('mario.rossi@example.com');
    expect(validateEmail('  Mario.ROSSI@Example.COM ')).toBe('mario.rossi@example.com');
    expect(validateName('  Maria   De   Luca  ')).toBe('Maria De Luca');
  });

  it('rifiuta email ambigue o oltre limite', () => {
    expect(() => validateEmail('mario..rossi@example.com')).toThrow(ValidationError);
    expect(() => validateEmail('mario@-example.com')).toThrow(ValidationError);
    expect(() => validateEmail(`${'a'.repeat(245)}@example.com`)).toThrow(ValidationError);
  });

  it('accetta soltanto il payload OTP previsto', () => {
    expect(validateOtpRequestPayload({ email: 'USER@example.com' })).toEqual({
      email: 'user@example.com'
    });
    expect(validateOtpVerifyPayload({
      email: 'USER@example.com',
      token: '123456',
      nome: ' Utente '
    })).toEqual({ email: 'user@example.com', token: '123456', nome: 'Utente' });
    expect(() => validateOtpRequestPayload({ email: 'a@example.com', isAdmin: true }))
      .toThrow(ValidationError);
    expect(() => validateOtpVerifyPayload({ email: 'a@example.com', token: '12345', nome: 'A' }))
      .toThrow(ValidationError);
  });

  it('normalizza rating e applica allowlist emozioni', () => {
    const result = validateTastingPayload({
      eventId: '11111111-1111-4111-8111-111111111111',
      wineId: WINE_ID.toUpperCase(),
      acidita: '4',
      corpo: 3,
      persistenza: '5',
      emozione: EMOTIONS[0],
      idempotencyKey: '22222222-2222-4222-8222-222222222222'
    });
    expect(result).toEqual({
      eventId: '11111111-1111-4111-8111-111111111111',
      wineId: WINE_ID,
      acidita: 4,
      corpo: 3,
      persistenza: 5,
      emozione: 'Sorpresa',
      idempotencyKey: '22222222-2222-4222-8222-222222222222'
    });
  });

  it('blocca payload XSS e campi di ownership nel tasting', () => {
    const base = {
      eventId: '11111111-1111-4111-8111-111111111111',
      wineId: WINE_ID,
      acidita: 3,
      corpo: 3,
      persistenza: 3,
      emozione: 'Pace',
      idempotencyKey: '22222222-2222-4222-8222-222222222222'
    };
    expect(() => validateTastingPayload({
      ...base,
      emozione: `<img src=x onerror=alert('xss')>`
    })).toThrow(ValidationError);
    expect(() => validateTastingPayload({ ...base, userId: WINE_ID })).toThrow(ValidationError);
  });

  it('valida il payload DNA accettando solo eventId', () => {
    expect(validateDnaPayload({
      eventId: '11111111-1111-4111-8111-111111111111'
    })).toEqual({
      eventId: '11111111-1111-4111-8111-111111111111'
    });
    
    expect(() => validateDnaPayload({
      eventId: '11111111-1111-4111-8111-111111111111',
      extraField: true
    })).toThrow(ValidationError);
  });

  it('impedisce il cambio email dal normale endpoint profilo', () => {
    expect(validateProfileUpdatePayload({ nome: 'Nuovo nome' })).toEqual({ nome: 'Nuovo nome' });
    expect(() => validateProfileUpdatePayload({ nome: 'Nuovo nome', email: 'altro@example.com' }))
      .toThrow(ValidationError);
  });

  it('valida paginazione, catalogo e colore CSS', () => {
    expect(validatePagination({ page: '2', limit: '25' })).toEqual({ page: 2, limit: 25, skip: 25 });
    expect(() => validatePagination({ limit: '1000' })).toThrow(ValidationError);
    expect(validateWinePayload({ nome: 'Nebbiolo', cantina: 'Cantina', colore: '#AABBCC' }).colore)
      .toBe('#aabbcc');
    expect(() => validateWinePayload({ nome: 'Nebbiolo', cantina: 'Cantina', colore: 'red;url(x)' }))
      .toThrow(ValidationError);
  });

  it('impone un limite byte al JSON e produce errori stabili', () => {
    expect(validateJsonBody({ ok: true }, '11', 32)).toEqual({ ok: true });
    let error;
    try { validateJsonBody({ text: 'x'.repeat(40) }, undefined, 32); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(PayloadTooLargeError);
    expect(error.statusCode).toBe(413);
    expect(formatValidationError(error)).toEqual({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Il payload supera il limite di 32 byte',
      fields: {}
    });
  });
});
