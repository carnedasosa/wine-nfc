// ═══════════════════════════════════════════════════
// UI / HOME — render del passaporto
// ═══════════════════════════════════════════════════

import { state, viniDB } from '../state.js';
import { calculateAverage, escapeHTML } from '../utils.js';

/**
 * Renderizza la schermata home con stats e lista assaggi.
 * @param {(vino: object) => void} openWine
 */
export function renderHome(openWine) {
  const el = document.getElementById('home-content');
  const assaggi = state.assaggi;

  const avgAcidita = assaggi.length ? calculateAverage(assaggi, 'acidita') : '—';
  const avgCorpo = assaggi.length ? calculateAverage(assaggi, 'corpo') : '—';

  let html = `
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-number">${assaggi.length}</div>
        <div class="stat-label">Assaggi</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${avgAcidita}</div>
        <div class="stat-label">Acidità media</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">${avgCorpo}</div>
        <div class="stat-label">Corpo medio</div>
      </div>
    </div>
  `;

  if (assaggi.length > 0) {
    html += `
      <div class="dna-teaser" onclick="showTab('dna')">
        <div class="dna-teaser-label">Wine DNA · Aggiornato ora</div>
        <div class="dna-teaser-text">Scopri il tuo profilo sensoriale completo</div>
        <div class="dna-teaser-action">
          Vedi l'analisi completa <span class="dna-teaser-arrow">→</span>
        </div>
      </div>
    `;
  }

  html += `
    <div class="section-header">
      <span class="section-title">I tuoi assaggi</span>
      <span class="section-count">${assaggi.length} / ${viniDB.length}</span>
    </div>
  `;

  if (assaggi.length === 0) {
    html += `
      <div class="empty-state">
        <div class="empty-state-icon">🍾</div>
        <div class="empty-state-title">Nessun assaggio ancora</div>
        <div class="empty-state-text">Avvicina il telefono a una bottiglia per iniziare. Usa il pulsante in basso per simulare il tap NFC.</div>
      </div>
    `;
  } else {
    assaggi.slice().reverse().forEach(a => {
      // Usiamo JSON.stringify per l'oggetto completo, e escapeHTML per i dati renderizzati.
      // Eseguiamo stringify sull'oggetto "pulito" se volessimo essere super sicuri,
      // ma dato che openWine si aspetta l'oggetto, bastano gli escape in visualizzazione.
      html += `
        <div class="wine-card" onclick="openWine(${escapeHTML(JSON.stringify(a.vino))})">
          <div class="wine-card-color" style="background: ${escapeHTML(a.vino.colore)}22; border: 1px solid ${escapeHTML(a.vino.colore)}44;">
            ${escapeHTML(a.vino.emoji)}
          </div>
          <div class="wine-card-info">
            <div class="wine-card-name">${escapeHTML(a.vino.nome)}</div>
            <div class="wine-card-cantina">${escapeHTML(a.vino.cantina)} · ${escapeHTML(a.vino.annata.toString())}</div>
            <div class="wine-card-ratings">
              <span class="rating-pill">Ac. ${a.acidita}/5</span>
              <span class="rating-pill">Corpo ${a.corpo}/5</span>
              <span class="rating-pill">${escapeHTML(a.emozione)}</span>
            </div>
          </div>
          <div class="wine-card-score">${a.acidita + a.corpo + a.persistenza}</div>
        </div>
      `;
    });
  }

  el.innerHTML = html;
}
