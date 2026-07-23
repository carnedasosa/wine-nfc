import { describe, it, expect } from 'vitest';
const { isValidEmail, isValidRating } = require('../utils/validation');

describe('Validation Utils', () => {
  describe('isValidEmail', () => {
    it('dovrebbe accettare email valide', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('nome.cognome@dominio.it')).toBe(true);
    });

    it('dovrebbe rifiutare email non valide', () => {
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });
  });

  describe('isValidRating', () => {
    it('dovrebbe accettare interi tra 1 e 5', () => {
      expect(isValidRating(1)).toBe(true);
      expect(isValidRating(3)).toBe(true);
      expect(isValidRating(5)).toBe(true);
      expect(isValidRating('4')).toBe(true); // se passato come stringa
    });

    it('dovrebbe rifiutare valori fuori range', () => {
      expect(isValidRating(0)).toBe(false);
      expect(isValidRating(6)).toBe(false);
      expect(isValidRating(-1)).toBe(false);
    });

    it('dovrebbe rifiutare decimali o valori non numerici', () => {
      expect(isValidRating(3.5)).toBe(false);
      expect(isValidRating('tre')).toBe(false);
      expect(isValidRating(null)).toBe(false);
      expect(isValidRating(undefined)).toBe(false);
    });
  });
});
