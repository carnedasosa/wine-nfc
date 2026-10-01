import { calculateAverage } from './domain/sensory.mjs';

// Dati e preferenze della storia: nessuna chiamata AI, nessun dato personale salvato.
export const STORY_THEMES = Object.freeze([
  { id: 'energia', label: 'Energia', colors: ['#BEA3DB', '#F69555'], sticker: '#F5ADCA', decoration: 'rays' },
  { id: 'sorpresa', label: 'Sorpresa', colors: ['#F3BDCF', '#D3B4E8'], sticker: '#F6DA83', decoration: 'stars' },
  { id: 'pace', label: 'Pace', colors: ['#A9BC91', '#F0DA8F'], sticker: '#DCC9E9', decoration: 'leaves' },
  { id: 'radici', label: 'Radici', colors: ['#B9C29A', '#DFA27D'], sticker: '#F4DCA6', decoration: 'leaves' },
  { id: 'nostalgia', label: 'Nostalgia', colors: ['#DBA0B0', '#CCB5DF'], sticker: '#F1D997', decoration: 'loops' },
  { id: 'complessita', label: 'Complessità', colors: ['#C8ADD9', '#DE9F7D'], sticker: '#EDBCD1', decoration: 'loops' }
]);

export function storySeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) hash = Math.imul(hash ^ char.codePointAt(0), 16777619);
  return hash >>> 0;
}

export function createStoryModel({ userId, eventId, name, tastings = [] }) {
  const rows = Array.isArray(tastings) ? tastings : [];
  const counts = new Map(STORY_THEMES.map(theme => [theme.label, 0]));
  rows.forEach(row => { if (counts.has(row.emozione)) counts.set(row.emozione, counts.get(row.emozione) + 1); });
  // In parità l'ordine canonico rende la composizione indipendente dall'ordine degli assaggi.
  const emotions = [...counts].filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]).slice(0, 2).map(([emotion]) => emotion);
  const theme = STORY_THEMES.find(item => item.label === emotions[0]) || STORY_THEMES[0];
  const averages = {};
  for (const field of ['acidita', 'corpo', 'persistenza']) {
    averages[field] = calculateAverage(rows, field);
  }
  // eslint-disable-next-line no-control-regex -- Rimuove intenzionalmente caratteri di controllo dal nome.
  const nameText = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60) : '';
  return {
    userId, eventId, name: nameText, count: rows.length, emotions, averages,
    seed: storySeed(`${userId}|${eventId}`), themeId: theme.id,
    caption: emotions.length
      ? `${rows.length === 1 ? 'Nel mio calice' : 'Nei miei calici'}, ${emotions.map(item => item.toLocaleLowerCase('it')).join(' e ')}.`
      : 'Un ricordo dei miei assaggi.'
  };
}

export function normalizeStoryPreferences(value, seed = 0) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    version: 1,
    variant: Number.isInteger(input.variant) && input.variant >= 0 && input.variant < 3 ? input.variant : seed % 3,
    theme: input.theme === 'auto' || STORY_THEMES.some(theme => theme.id === input.theme) ? input.theme : 'auto',
    showName: typeof input.showName === 'boolean' ? input.showName : true,
    showDetails: typeof input.showDetails === 'boolean' ? input.showDetails : false
  };
}

export function storyPreferenceKey(model) {
  return `sovranaturale-story:v1:${encodeURIComponent(model.userId)}:${encodeURIComponent(model.eventId)}`;
}

export function resolveStoryTheme(model, preferences) {
  return STORY_THEMES.find(theme => theme.id === (preferences.theme === 'auto' ? model.themeId : preferences.theme)) || STORY_THEMES[0];
}

export function readStoryPreferences(model, storage) {
  try { return normalizeStoryPreferences(JSON.parse(storage.getItem(storyPreferenceKey(model))), model.seed); }
  catch { return normalizeStoryPreferences(null, model.seed); }
}

export function writeStoryPreferences(model, preferences, storage) {
  try { storage.setItem(storyPreferenceKey(model), JSON.stringify(normalizeStoryPreferences(preferences, model.seed))); return true; }
  catch { return false; }
}
