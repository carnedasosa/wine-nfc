// Regole pubbliche e pure: nessun DOM, provider o dato di sessione.
export const SENSORY_VERSION = 'sensory-v3';
/**
 * @typedef {'acidita' | 'corpo' | 'persistenza'} SensoryField
 * @typedef {{nome?: string, cantina?: string, territorio?: string}} SensoryWine
 * @typedef {{acidita?: unknown, corpo?: unknown, persistenza?: unknown, emozione?: unknown, wine?: SensoryWine, vino?: SensoryWine}} SensoryTasting
 */
/** @type {SensoryField[]} */
const FIELDS = ['acidita', 'corpo', 'persistenza'];

/** @param {SensoryTasting[]} tastings @param {SensoryField} field */
function rawAverage(tastings, field) {
  const values = (Array.isArray(tastings) ? tastings : [])
    .map(row => row?.[field]).filter(/** @returns {value is number} */ value => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** @param {SensoryTasting[]} tastings @param {SensoryField} field */
export function calculateAverage(tastings, field) {
  const mean = rawAverage(tastings, field);
  return mean === null ? null : Math.round(mean * 10) / 10;
}

/** @param {SensoryTasting[]} tastings @param {number} [count] */
export function getTopEmotions(tastings, count = 3) {
  /** @type {Map<string, number>} */
  const counts = new Map();
  for (const row of Array.isArray(tastings) ? tastings : []) {
    const emotion = row?.emozione;
    if (typeof emotion === 'string' && emotion) counts.set(emotion, (counts.get(emotion) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .slice(0, count).map(([emotion]) => emotion);
}

/** @param {SensoryTasting[]} tastings */
export function buildSensoryStats(tastings) {
  const rows = (Array.isArray(tastings) ? tastings : []).filter(row => row && typeof row === 'object')
    .map(row => ({ ...row, wine: row.wine || row.vino || {} }));
  const averages = Object.fromEntries(FIELDS.map(field => [field, calculateAverage(rows, field)]));
  const acidita = rawAverage(rows, 'acidita');
  const corpo = rawAverage(rows, 'corpo');
  const topEmo = getTopEmotions(rows);
  const tags = [];
  if (acidita !== null && acidita >= 4) tags.push('Vini tesi');
  else if (acidita !== null && acidita <= 2) tags.push('Vini morbidi');
  if (corpo !== null && corpo >= 4) tags.push('Struttura densa');
  else if (corpo !== null && corpo <= 2) tags.push('Leggerezza');
  tags.push(...topEmo);
  const territories = rows.map(row => typeof row.wine.territorio === 'string' ? row.wine.territorio.split(',')[1]?.trim() : '')
    .filter(Boolean);
  for (const territory of [...new Set(territories)].sort()) if (!tags.includes(territory)) tags.push(territory);
  return {
    assaggiCount: rows.length,
    averages,
    topEmo,
    tags,
    cantine: [...new Set(rows.map(row => row.wine.cantina).filter(value => typeof value === 'string' && value))].sort(),
    ultimiVini: rows.slice(0, 3).map(({ wine }) => `${wine.nome || 'Vino'} (${wine.territorio || 'territorio non indicato'})`)
  };
}

/** @param {ReturnType<typeof buildSensoryStats>} stats */
export function describeSensoryStats(stats) {
  if (!stats.assaggiCount) return 'Nessun assaggio trovato.';
  const intensity = FIELDS.filter(field => stats.averages[field] !== null)
    .map(field => `${field === 'acidita' ? 'acidità' : field} ${stats.averages[field]}/5`);
  const summary = intensity.length ? `Le intensità medie registrate sono: ${intensity.join(', ')}.` : 'Non sono disponibili intensità valide.';
  const emotions = stats.topEmo.length ? ` Le emozioni più ricorrenti sono ${stats.topEmo.join(', ')}.` : '';
  return `${summary}${emotions} Questo riepilogo descrive gli assaggi, senza dedurre preferenze personali.`;
}
