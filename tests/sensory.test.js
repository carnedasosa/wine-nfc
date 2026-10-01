import { describe, expect, it } from 'vitest';
import { buildSensoryStats, calculateAverage, describeSensoryStats, getTopEmotions } from '../src/domain/sensory.mjs';

describe('regole sensoriali condivise', () => {
  it.each([
    [[3, 4], 3.5, false],
    [[4, 4, 4, 4, 4, 4, 4, 4, 4, 3], 3.9, false],
    [[4, 4], 4, true]
  ])('classifica la media reale senza arrotondarla alla soglia: %j', (values, mean, tense) => {
    const stats = buildSensoryStats(values.map(acidita => ({ acidita })));
    expect(stats.averages.acidita).toBe(mean);
    expect(stats.tags.includes('Vini tesi')).toBe(tense);
  });
  it('non converte valori mancanti o invalidi in intensità neutrali', () => {
    expect(calculateAverage([{ acidita: '4' }, { acidita: 0 }, {}, { acidita: 6 }], 'acidita')).toBeNull();
    const stats = buildSensoryStats([{}]);
    expect(stats.averages).toEqual({ acidita: null, corpo: null, persistenza: null });
    expect(stats.tags).toEqual([]);
    expect(describeSensoryStats(stats)).toContain('Non sono disponibili intensità valide');
    expect(describeSensoryStats(buildSensoryStats([]))).toBe('Nessun assaggio trovato.');
  });
  it('non classifica 2.4 come morbido e mantiene precisione decimale', () => {
    const stats = buildSensoryStats([2, 2, 2, 3, 3].map(acidita => ({ acidita })));
    expect(stats.averages.acidita).toBe(2.4);
    expect(stats.tags).not.toContain('Vini morbidi');
    expect(buildSensoryStats([{ acidita: 2 }]).tags).toContain('Vini morbidi');
  });
  it('produce lo stesso risultato per righe Prisma e righe client', () => {
    const rows = [{ acidita: 5, corpo: 2, persistenza: 4, emozione: 'Pace', wine: { nome: 'Uno', cantina: 'A', territorio: 'Bari, Puglia' } }];
    expect(buildSensoryStats(rows)).toEqual(buildSensoryStats(rows.map(({ wine, ...row }) => ({ ...row, vino: wine }))));
  });
  it('risolve i pareggi delle emozioni indipendentemente dall’ordine delle righe', () => {
    const rows = ['Pace', 'Gioia', 'Pace', 'Gioia'].map(emozione => ({ emozione }));
    expect(getTopEmotions(rows)).toEqual(['Gioia', 'Pace']);
    expect(getTopEmotions([...rows].reverse())).toEqual(getTopEmotions(rows));
  });
});
