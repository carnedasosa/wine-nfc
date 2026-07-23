// ═══════════════════════════════════════════════════
// UI / LEADERBOARD — classifica live
// ═══════════════════════════════════════════════════

import { API } from '../api.js';
import { escapeHTML } from '../utils.js';

// ── Cache semplice per evitare fetch ad ogni tab switch ──────────────────────
let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000; // 30 secondi
let fetchInFlight = false;

/**
 * Renderizza la classifica degli assaggiatori.
 * Usa una cache client-side con TTL di 30s e un guard
 * contro chiamate simultanee (tab switching rapido).
 */
export async function renderLeaderboard() {
  const container = document.getElementById('leaderboard-content');
  if (!container) return;

  const now = Date.now();

  // Se abbiamo dati freschi in cache, usali senza fetch
  if (cachedData && (now - lastFetchTime) < CACHE_TTL) {
    renderList(container, cachedData);
    return;
  }

  // Guard contro chiamate simultanee (tab switching nervoso)
  if (fetchInFlight) return;
  fetchInFlight = true;

  // Mostra spinner solo se non abbiamo dati precedenti
  if (!cachedData) {
    container.innerHTML = '<div class="loading-spinner" style="margin: 40px auto;"></div>';
  }

  try {
    const leaderboard = await API.getLeaderboard();
    cachedData = leaderboard;
    lastFetchTime = Date.now();
    renderList(container, leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    // Se abbiamo dati vecchi, mostriamoli comunque
    if (cachedData) {
      renderList(container, cachedData);
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Errore di connessione</div>
          <div class="empty-state-text">Impossibile caricare la classifica. Riprova tra poco.</div>
        </div>
      `;
    }
  } finally {
    fetchInFlight = false;
  }
}

// ── Render della lista ───────────────────────────────────────────────────────

const MAX_ANIMATED = 15; // Cap animation delay per evitare righe invisibili su scroll

function renderList(container, leaderboard) {
  if (leaderboard.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏆</div>
        <div class="empty-state-title">Nessun assaggio registrato</div>
        <div class="empty-state-text">Inizia a degustare per primo e conquista la vetta!</div>
      </div>
    `;
    return;
  }

  let html = '<ul class="leaderboard-list" role="list" aria-label="Classifica assaggiatori">';
  leaderboard.forEach((user, index) => {
    let rankIcon = `<span class="rank-number">#${index + 1}</span>`;
    if (index === 0) rankIcon = '<span class="rank-medal">🥇</span>';
    else if (index === 1) rankIcon = '<span class="rank-medal">🥈</span>';
    else if (index === 2) rankIcon = '<span class="rank-medal">🥉</span>';

    const isTop3 = index < 3 ? 'top-3' : '';
    const isSelf = user.isCurrentUser ? 'is-self' : '';
    const delay = Math.min(index, MAX_ANIMATED) * 0.05;
    const plural = user.tastingsCount === 1 ? 'assaggio' : 'assaggi';

    html += `
      <li class="leaderboard-item ${isTop3} ${isSelf}" style="animation-delay: ${delay}s">
        <div class="leaderboard-rank">${rankIcon}</div>
        <div class="leaderboard-info">
          <div class="leaderboard-name">${escapeHTML(user.nome)}${user.isCurrentUser ? ' <span class="you-badge">Tu</span>' : ''}</div>
          <div class="leaderboard-count"><strong>${user.tastingsCount}</strong> ${plural}</div>
        </div>
      </li>
    `;
  });
  html += '</ul>';

  container.innerHTML = html;
}
