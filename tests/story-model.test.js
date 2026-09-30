import { describe, expect, it } from 'vitest';
import { createStoryModel, normalizeStoryPreferences, readStoryPreferences, resolveStoryTheme, storyPreferenceKey, writeStoryPreferences } from '../src/story-model.js';

const tasting = (emozione, acidita = 3, corpo = 3, persistenza = 3) => ({ emozione, acidita, corpo, persistenza });
const create = (tastings, extra = {}) => createStoryModel({ userId: 'alex', eventId: 'fiera', name: 'Alex', tastings, ...extra });

describe('storie Sovranaturale', () => {
  it('usa le emozioni registrate senza inventare preferenze o personalità', () => {
    const model = create([tasting('Pace'), tasting('Energia'), tasting('Pace'), tasting('Radici')]);
    expect(model.emotions).toEqual(['Pace', 'Energia']);
    expect(model.themeId).toBe('pace');
    expect(model.caption).toBe('Nei miei calici, pace e energia.');
  });
  it('conserva variante e ordine delle emozioni quando cambia l’ordine dei dati', () => {
    const rows = [tasting('Radici'), tasting('Pace')];
    expect(create(rows)).toEqual(create([...rows].reverse()));
    expect(create([...rows, tasting('Pace')]).seed).toBe(create(rows).seed);
    expect(create(rows, { userId: 'giulia' }).seed).not.toBe(create(rows).seed);
  });
  it('tratta il primo assaggio come un singolo calice e non aggiunge una seconda emozione', () => {
    expect(create([tasting('Sorpresa')])).toMatchObject({ count: 1, emotions: ['Sorpresa'], caption: 'Nel mio calice, sorpresa.' });
  });
  it('ignora emozioni sconosciute e non esporta valori sensoriali inventati', () => {
    expect(create([tasting('<script>', 0, 6, 'bad')])).toMatchObject({ emotions: [], averages: { acidita: null, corpo: null, persistenza: null } });
  });
  it('mantiene i decimali delle intensità medie', () => {
    expect(create([tasting('Pace', 2, 3, 4), tasting('Pace', 3, 4, 5)]).averages).toEqual({ acidita: 2.5, corpo: 3.5, persistenza: 4.5 });
  });
  it('cambiare palette non cambia le emozioni o i dati del profilo', () => {
    const model = create([tasting('Radici')]);
    expect(resolveStoryTheme(model, { theme: 'energia' }).id).toBe('energia');
    expect(resolveStoryTheme(model, { theme: 'auto' }).id).toBe('radici');
    expect(model.emotions).toEqual(['Radici']);
  });
  it('isola le preferenze per utente ed evento e salva solo scelte grafiche', () => {
    const data = new Map(); const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
    const model = create([tasting('Pace')]);
    writeStoryPreferences(model, { variant: 2, showName: false, showDetails: true, theme: 'nostalgia', name: 'private' }, storage);
    expect(readStoryPreferences(model, storage)).toMatchObject({ variant: 2, showName: false, showDetails: true, theme: 'nostalgia' });
    expect([...data.values()].join('')).not.toContain('private');
    expect(readStoryPreferences(create([], { userId: 'different' }), storage).theme).toBe('auto');
    expect(storyPreferenceKey(model)).not.toBe(storyPreferenceKey({ ...model, eventId: 'other' }));
  });
  it('funziona con storage bloccato, JSON rotto e valori salvati non validi', () => {
    const model = create([]);
    expect(readStoryPreferences(model, { getItem() { throw new Error('blocked'); } })).toEqual(normalizeStoryPreferences(null, model.seed));
    expect(readStoryPreferences(model, { getItem: () => '{invalid' }).theme).toBe('auto');
    expect(normalizeStoryPreferences({ variant: -1, theme: 'unknown', showName: 'false' }, 4)).toMatchObject({ variant: 1, theme: 'auto', showName: true });
    expect(writeStoryPreferences(model, {}, undefined)).toBe(false);
  });
});
