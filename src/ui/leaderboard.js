// ═══════════════════════════════════════════════════
// UI / LEADERBOARD — classifica live senza sink HTML
// ═══════════════════════════════════════════════════

import { API } from '../api.js';
import { state, captureSession, isCurrentSession } from '../state.js';
import { appendElement, clearElement, renderEmptyState } from '../utils.js';

let cachedData = null;
let cachedViewerId = null;
let cachedContext = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000;
const MAX_ANIMATED = 15;
const PAGE_SIZE = 50;
let nextPage = 1;
let hasMore = false;
let cacheGeneration = 0;
let activeRequest = null;

function renderLoading(container) {
  clearElement(container);
  const spinner = appendElement(container, 'div', 'loading-spinner');
  spinner.style.margin = '40px auto';
}

function rankLabel(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function renderList(container, leaderboard) {
  clearElement(container);

  if (!leaderboard.length) {
    renderEmptyState(
      container,
      '🏆',
      'Nessun partecipante in classifica',
      'Partecipa dalle impostazioni del profilo scegliendo un nickname. La classifica conta vini diversi, non quantità bevute.'
    );
    return;
  }

  const list = appendElement(container, 'ul', 'leaderboard-list');
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', 'Classifica assaggiatori');

  leaderboard.forEach((user, index) => {
    const position = user.rank;
    const item = appendElement(list, 'li', 'leaderboard-item');
    if (position <= 3) item.classList.add('top-3');
    if (user.isCurrentUser) item.classList.add('is-self');
    item.style.animationDelay = `${Math.min(index, MAX_ANIMATED) * 0.05}s`;

    const rank = appendElement(item, 'div', 'leaderboard-rank');
    appendElement(
      rank,
      'span',
      position <= 3 ? 'rank-medal' : 'rank-number',
      rankLabel(position)
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

function renderPage(container, { busy = false, error = '' } = {}) {
  if (cachedData) renderList(container, cachedData);
  else clearElement(container);
  if (cachedData?.length) {
    const note = appendElement(container, 'p', 'empty-state-text', 'Classifica aggiornata alla lettura. Le posizioni possono cambiare durante l’evento.');
    note.setAttribute('role', 'status');
  }
  if (error) {
    const message = appendElement(container, 'p', 'empty-state-text', error);
    message.setAttribute('role', 'status');
  }
  if (hasMore || error) {
    const button = appendElement(container, 'button', 'btn-secondary', busy ? 'Caricamento…' : error ? 'Riprova il caricamento' : 'Mostra altri partecipanti');
    button.type = 'button';
    button.disabled = busy;
    button.addEventListener('click', () => { void renderLeaderboard({ loadMore: true }); });
  }
}

export async function renderLeaderboard({ loadMore = false } = {}) {
  const container = document.getElementById('leaderboard-content');
  if (!container) return;

  const now = Date.now();
  const viewerId = state.utente.id || '';
  const eventId = state.eventId;
  const cacheValid = cachedData && cachedContext && isCurrentSession(cachedContext)
    && cachedViewerId === viewerId && now - lastFetchTime < CACHE_TTL;
  if (cacheValid && !loadMore) {
    renderPage(container, { busy: Boolean(activeRequest) });
    return;
  }

  const generation = cacheGeneration;
  const context = captureSession();
  if (activeRequest?.generation === generation && isCurrentSession(activeRequest.context)) return;
  const requestMarker = { generation, viewerId, context };
  activeRequest = requestMarker;
  const page = cacheValid && loadMore ? nextPage : 1;
  if (page === 1) {
    cachedData = null;
    cachedContext = null;
    nextPage = 1;
    hasMore = false;
    renderLoading(container);
  } else {
    renderPage(container, { busy: true });
  }

  try {
    const leaderboard = await API.getLeaderboard(eventId, page, PAGE_SIZE);
    if (
      generation !== cacheGeneration ||
      !isCurrentSession(context) ||
      state.utente.id !== viewerId || state.eventId !== eventId ||
      activeRequest !== requestMarker
    ) return;
    if (!Array.isArray(leaderboard) || leaderboard.some(row => !Number.isInteger(row.rank) || row.rank < 1)) {
      throw new Error('Risposta classifica non valida');
    }
    cachedData = page === 1 ? leaderboard : [...cachedData, ...leaderboard];
    cachedViewerId = viewerId;
    cachedContext = context;
    if (page === 1) lastFetchTime = Date.now();
    nextPage = page + 1;
    hasMore = leaderboard.length === PAGE_SIZE;
    renderPage(container);
  } catch (error) {
    if (generation !== cacheGeneration || !isCurrentSession(context) || activeRequest !== requestMarker) return;
    console.error('Error fetching leaderboard:', error);
    if (!cachedData) clearElement(container);
    renderPage(container, { error: 'Impossibile caricare la classifica. Riprova tra poco.' });
  } finally {
    if (activeRequest === requestMarker) activeRequest = null;
  }
}

export function clearLeaderboardCache() {
  cacheGeneration += 1;
  activeRequest = null;
  cachedData = null;
  cachedViewerId = null;
  cachedContext = null;
  lastFetchTime = 0;
  nextPage = 1;
  hasMore = false;
}
