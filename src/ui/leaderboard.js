// ═══════════════════════════════════════════════════
// UI / LEADERBOARD — classifica live senza sink HTML
// ═══════════════════════════════════════════════════

import { API } from '../api.js';
import { state } from '../state.js';
import { appendElement, clearElement, renderEmptyState } from '../utils.js';

let cachedData = null;
let cachedViewerId = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000;
const MAX_ANIMATED = 15;
let cacheGeneration = 0;
let activeRequest = null;

function renderLoading(container) {
  clearElement(container);
  const spinner = appendElement(container, 'div', 'loading-spinner');
  spinner.style.margin = '40px auto';
}

function rankLabel(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}

function renderList(container, leaderboard) {
  clearElement(container);

  if (!leaderboard.length) {
    renderEmptyState(
      container,
      '🏆',
      'Nessun assaggio registrato',
      'Inizia a degustare per primo e conquista la vetta!'
    );
    return;
  }

  const list = appendElement(container, 'ul', 'leaderboard-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Classifica assaggiatori');

  leaderboard.forEach((user, index) => {
    const item = appendElement(list, 'li', 'leaderboard-item');
    if (index < 3) item.classList.add('top-3');
    if (user.isCurrentUser) item.classList.add('is-self');
    item.style.animationDelay = `${Math.min(index, MAX_ANIMATED) * 0.05}s`;

    const rank = appendElement(item, 'div', 'leaderboard-rank');
    appendElement(
      rank,
      'span',
      index < 3 ? 'rank-medal' : 'rank-number',
      rankLabel(index)
    );

    const info = appendElement(item, 'div', 'leaderboard-info');
    const name = appendElement(info, 'div', 'leaderboard-name', user.nome || 'Degustatore');
    if (user.isCurrentUser) appendElement(name, 'span', 'you-badge', 'Tu');

    const count = Number.isInteger(user.tastingsCount) ? user.tastingsCount : 0;
    const countRow = appendElement(info, 'div', 'leaderboard-count');
    appendElement(countRow, 'strong', '', count);
    countRow.append(document.createTextNode(` ${count === 1 ? 'assaggio' : 'assaggi'}`));
  });
}

export async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-content');
  if (!container) return;

  const now = Date.now();
  const viewerId = state.utente.id || '';
  if (cachedData && cachedViewerId === viewerId && now - lastFetchTime < CACHE_TTL) {
    renderList(container, cachedData);
    return;
  }

  const generation = cacheGeneration;
  if (activeRequest?.generation === generation) return;
  const requestMarker = { generation, viewerId };
  activeRequest = requestMarker;
  if (!cachedData) renderLoading(container);

  try {
    const leaderboard = await API.getLeaderboard();
    if (
      generation !== cacheGeneration ||
      state.utente.id !== viewerId ||
      activeRequest !== requestMarker
    ) return;
    cachedData = Array.isArray(leaderboard) ? leaderboard : [];
    cachedViewerId = viewerId;
    lastFetchTime = Date.now();
    renderList(container, cachedData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    if (cachedData) {
      renderList(container, cachedData);
    } else {
      renderEmptyState(
        container,
        '⚠️',
        'Errore di connessione',
        'Impossibile caricare la classifica. Riprova tra poco.'
      );
    }
  } finally {
    if (activeRequest === requestMarker) activeRequest = null;
  }
}

export function clearLeaderboardCache() {
  cacheGeneration += 1;
  activeRequest = null;
  cachedData = null;
  cachedViewerId = null;
  lastFetchTime = 0;
}
