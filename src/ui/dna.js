// ═══════════════════════════════════════════════════
// UI / DNA — profilo sensoriale + condivisione
// ═══════════════════════════════════════════════════

import { state } from '../state.js';
import { API } from '../api.js';
import { calculateAverage, getTopEmotions, downloadBlob, showToast } from '../utils.js';

// Blob pre-generato per evitare blocchi del browser sui click
let instaStoryBlob = null;

// ─── Fallback testo DNA (offline o errore backend) ───────────────────────────

function generaDNAFallback(acidita, corpo) {
  const profili = [
    'Un palato che non cerca conforto — cerca verità. I vini scelti oggi parlano di territorio con accento duro, senza mediazioni. C\'è una preferenza per l\'acidità viva, per quella tensione che tiene sveglio.',
    'Un degustatore del confine, attratto da vini che non si lasciano catalogare facilmente. La struttura non spaventa, anzi invita — come un racconto che richiede attenzione prima di rivelare il finale.',
    'Il profilo di chi lascia spazio al vino di parlare. Preferenza per leggerezza e precisione, come un fotografo che sceglie la luce giusta invece di riempire il frame.'
  ];
  const idx = Math.floor((acidita + corpo) / 4);
  return profili[Math.min(idx, profili.length - 1)];
}

// ─── Render DNA ───────────────────────────────────────────────────────────────

export async function renderDNA() {
  const el = document.getElementById('dna-content');
  const assaggi = state.assaggi;

  if (assaggi.length === 0) {
    el.innerHTML = `
      <div class="empty-state" style="padding: 32px 24px;">
        <div class="empty-state-icon">🧬</div>
        <div class="empty-state-title">Nessun dato ancora</div>
        <div class="empty-state-text">Assaggia almeno un vino per generare il tuo Wine DNA.</div>
      </div>
    `;
    return;
  }

  document.getElementById('dna-subtitle').textContent =
    `Basato su ${assaggi.length} assaggi di ${state.utente.nome}`;

  const avgAcidita = Math.round(calculateAverage(assaggi, 'acidita'));
  const avgCorpo = Math.round(calculateAverage(assaggi, 'corpo'));
  const avgPersistenza = Math.round(calculateAverage(assaggi, 'persistenza'));
  const topEmo = getTopEmotions(assaggi, 3);
  const cantineUniche = [...new Set(assaggi.map(a => a.vino.cantina))];

  // Spinner di caricamento
  el.innerHTML = `
    <div class="dna-profile-card">
      <div class="dna-loading">
        <div class="dna-spinner"></div>
        <span>L'AI sta analizzando i tuoi assaggi...</span>
      </div>
    </div>
  `;

  // Chiama il backend per il testo DNA
  let dnaText = '';
  try {
    dnaText = await API.getDNA({
      assaggiCount: assaggi.length,
      avgAcidita,
      avgCorpo,
      avgPersistenza,
      topEmo,
      viniPreferiti: assaggi.slice(0, 3).map(a => a.vino.nome + ' (' + a.vino.territorio + ')'),
      utenteNome: state.utente.nome
    });
  } catch (e) {
    console.error('Errore backend DNA:', e);
    dnaText = generaDNAFallback(avgAcidita, avgCorpo);
  }

  // Tags dal profilo
  const tags = [];
  if (avgAcidita >= 4) tags.push('Vini tesi');
  else if (avgAcidita <= 2) tags.push('Vini morbidi');
  if (avgCorpo >= 4) tags.push('Struttura densa');
  else if (avgCorpo <= 2) tags.push('Leggerezza');
  topEmo.forEach(e => tags.push(e));
  assaggi.map(a => a.vino.territorio.split(',')[1]?.trim()).filter(Boolean).forEach(t => {
    if (!tags.includes(t)) tags.push(t);
  });

  el.innerHTML = `
    <div class="dna-profile-card">
      <div class="dna-generated-text">${dnaText}</div>
      <div class="dna-tags">
        ${tags.slice(0, 6).map(t => `<span class="dna-tag">${t}</span>`).join('')}
      </div>
    </div>

    <div class="radar-section">
      <div class="radar-label">Profilo sensoriale</div>
      <div class="radar-bars">
        <div class="radar-bar-row">
          <span class="radar-bar-name">Acidità</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgAcidita / 5 * 100}%"></div></div>
          <span class="radar-bar-value">${avgAcidita}/5</span>
        </div>
        <div class="radar-bar-row">
          <span class="radar-bar-name">Corpo</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgCorpo / 5 * 100}%"></div></div>
          <span class="radar-bar-value">${avgCorpo}/5</span>
        </div>
        <div class="radar-bar-row">
          <span class="radar-bar-name">Persistenza</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgPersistenza / 5 * 100}%"></div></div>
          <span class="radar-bar-value">${avgPersistenza}/5</span>
        </div>
      </div>
    </div>

    <div class="cantine-section">
      <div class="radar-label">Cantine visitate</div>
      <div class="cantina-chips">
        ${cantineUniche.map(c => `<span class="cantina-chip">${c}</span>`).join('')}
      </div>
    </div>
  `;

  // Pre-generazione immagine Instagram (risolve il blocco del browser sui click)
  instaStoryBlob = null;
  const shareBtn = document.querySelector('.share-btn');
  if (shareBtn) {
    shareBtn.textContent = 'Preparazione immagine...';
    shareBtn.style.opacity = '0.7';
    shareBtn.disabled = true;
  }

  setTimeout(async () => {
    const ready = prepareInstaLayout();
    if (!ready) return;

    const layout = document.getElementById('insta-story-layout');
    const originalScroll = window.scrollY;
    try {
      const canvas = await html2canvas(layout, {
        scale: 2, useCORS: true, backgroundColor: null,
        width: 1080, height: 1920, windowWidth: 1080, windowHeight: 1920
      });
      window.scrollTo(0, originalScroll);
      canvas.toBlob(blob => {
        instaStoryBlob = blob;
        if (shareBtn) {
          shareBtn.textContent = '↗ Condividi il tuo Wine DNA';
          shareBtn.style.opacity = '1';
          shareBtn.disabled = false;
        }
      }, 'image/png');
    } catch (e) {
      console.error('Errore pre-generazione', e);
      if (shareBtn) shareBtn.textContent = 'Errore immagine';
    }
  }, 500);
}

// ─── Prepara il layout Instagram hidden ──────────────────────────────────────

function prepareInstaLayout() {
  const assaggi = state.assaggi;
  if (assaggi.length === 0) return false;

  document.getElementById('insta-user-name').textContent = state.utente.nome || 'Esploratore';

  const dnaTextEl = document.querySelector('.dna-generated-text');
  const dnaText = dnaTextEl
    ? dnaTextEl.textContent
    : generaDNAFallback(
        Math.round(assaggi.reduce((s, a) => s + a.acidita, 0) / assaggi.length),
        Math.round(assaggi.reduce((s, a) => s + a.corpo, 0) / assaggi.length)
      );
  document.getElementById('insta-dna-text').textContent = dnaText;

  const avgAcidita = Math.round(assaggi.reduce((s, a) => s + a.acidita, 0) / assaggi.length);
  const avgCorpo = Math.round(assaggi.reduce((s, a) => s + a.corpo, 0) / assaggi.length);
  const avgPersistenza = Math.round(assaggi.reduce((s, a) => s + a.persistenza, 0) / assaggi.length);

  document.getElementById('insta-radar-bars').innerHTML = `
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Acidità</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgAcidita / 5 * 100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Corpo</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgCorpo / 5 * 100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Persistenza</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgPersistenza / 5 * 100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
  `;

  const tagEls = document.querySelectorAll('.dna-tag');
  let tagsHTML = '';
  tagEls.forEach(el => {
    tagsHTML += `<span style="display:inline-block; padding:8px 16px; margin:4px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:30px; font-size:24px;">${el.textContent}</span>`;
  });
  document.getElementById('insta-tags-container').innerHTML = tagsHTML;

  return true;
}

// ─── Condivisione ─────────────────────────────────────────────────────────────

export async function shareDNA() {
  if (!instaStoryBlob) {
    showToast('Immagine non ancora pronta. Attendi qualche secondo...', 'error');
    return;
  }

  const file = new File([instaStoryBlob], 'wine-dna.png', { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Wine DNA',
        text: 'Il mio profilo sensoriale su Vino Passport'
      });
    } catch (err) {
      console.log('Condivisione annullata o fallita', err);
    }
  } else {
    downloadBlob(instaStoryBlob, 'wine-dna.png');
    showToast('Immagine scaricata! Aggiungila alle tue Storie.');
  }
}
