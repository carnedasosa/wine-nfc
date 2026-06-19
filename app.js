// ═══════════════════════════════════════════════════
// DATABASE MOCK — vini della fiera
// ═══════════════════════════════════════════════════
let viniDB = [];

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let state = {
  utente: { nome: '', email: '' },
  assaggi: [],
  vinoCorrente: null,
  emozioneSelezionata: null,
  viniQueue: [...viniDB] // per simulare tap diversi
};

let queueIndex = 0;

let pendingVinoId = null; // ID vino da aprire dopo onboarding (NFC URL routing)

// ═══════════════════════════════════════════════════
// LOCAL STORAGE
// ═══════════════════════════════════════════════════
function saveState() {
  try {
    const dataToSave = {
      utente: state.utente,
      assaggi: state.assaggi
    };
    localStorage.setItem('vinoPassportState', JSON.stringify(dataToSave));
  } catch (e) {
    console.error('Errore nel salvataggio in localStorage:', e);
  }
}

function loadState() {
  try {
    const stored = localStorage.getItem('vinoPassportState');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.utente) state.utente = parsed.utente;
      if (parsed.assaggi) {
        state.assaggi = parsed.assaggi.map(a => ({
          ...a,
          timestamp: new Date(a.timestamp)
        }));
      }
    }
  } catch (e) {
    console.error('Errore nel caricamento dal localStorage:', e);
    localStorage.removeItem('vinoPassportState');
  }
}

// ═══════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
}

let previousScreen = 'home';

function goBack() {
  showScreen(previousScreen);
  renderHome();
}

function showTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  if (tab === 'passport') {
    document.querySelectorAll('.nav-tab')[0].classList.add('active');
    showScreen('home');
    renderHome();
  } else if (tab === 'dna') {
    document.querySelectorAll('.nav-tab')[1].classList.add('active');
    showScreen('dna');
    renderDNA();
  }
}

// ═══════════════════════════════════════════════════
// ONBOARDING
// ═══════════════════════════════════════════════════
async function startPassport() {
  const nome = document.getElementById('input-nome').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const btn = document.querySelector('.onboarding-inner .btn-primary');

  if (!nome || !email) {
    showToast('Inserisci nome ed email per continuare', 'error');
    return;
  }

  if (btn) btn.disabled = true;
  
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email })
    });
    
    if (!res.ok) throw new Error('API Error');
    const data = await res.json();
    
    state.utente = { id: data.id, nome, email };
    saveState();

    if (pendingVinoId) {
      const vino = viniDB.find(v => v.id === pendingVinoId);
      pendingVinoId = null;
      if (vino) {
        openWine(vino);
        if (btn) btn.disabled = false;
        return;
      }
    }

    showScreen('home');
    renderHome();
  } catch (e) {
    showToast('Errore di connessione. Riprova.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ═══════════════════════════════════════════════════
// SIMULA TAP NFC
// ═══════════════════════════════════════════════════
function simulateNfcTap() {
  // Ripple effect
  const ripple = document.getElementById('nfc-ripple');
  ripple.classList.remove('animate');
  void ripple.offsetWidth;
  ripple.classList.add('animate');

  // Prendi prossimo vino non ancora assaggiato
  const assaggiatiIds = state.assaggi.map(a => a.vino.id);
  const nonAssaggiati = viniDB.filter(v => !assaggiatiIds.includes(v.id));

  if (nonAssaggiati.length === 0) {
    showToast('Hai assaggiato tutti i vini della fiera! 🎉');
    return;
  }

  const vino = nonAssaggiati[Math.floor(Math.random() * nonAssaggiati.length)];
  openWine(vino);
}

// ═══════════════════════════════════════════════════
// SCHEDA VINO
// ═══════════════════════════════════════════════════
function openWine(vino) {
  state.vinoCorrente = vino;
  state.emozioneSelezionata = null;
  previousScreen = 'home';

  // Reset sliders
  ['acidita', 'corpo', 'persistenza'].forEach(s => {
    const slider = document.getElementById('slider-' + s);
    slider.value = 3;
    slider.style.setProperty('--val', '50%');
    document.getElementById(s + '-val').textContent = '3';
  });

  // Reset emozioni
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));

  // Colore hero
  document.getElementById('wine-hero').style.background =
    `linear-gradient(180deg, ${vino.colore}55 0%, var(--bg) 100%)`;

  document.getElementById('wine-emoji').textContent = vino.emoji;
  document.getElementById('wine-cantina-label').textContent = vino.cantina;
  document.getElementById('wine-name').textContent = vino.nome;
  document.getElementById('wine-meta').textContent = `${vino.annata} · ${vino.vitigno} · ${vino.territorio}`;
  document.getElementById('wine-desc').textContent = vino.desc;

  showScreen('wine');
}

function updateSlider(tipo, el) {
  const val = el.value;
  document.getElementById(tipo + '-val').textContent = val;
  
  // Track fill background
  const min = el.min || 1;
  const max = el.max || 5;
  const percentage = ((val - min) / (max - min)) * 100;
  el.style.setProperty('--val', `${percentage}%`);
  
  // Haptic feedback
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

function selectEmo(el, emo) {
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.emozioneSelezionata = emo;
}

async function saveWine() {
  if (!state.utente || !state.utente.id) {
    return showToast("Sessione non valida, utente mancante", "error");
  }

  const vino = state.vinoCorrente;
  const btn = document.querySelector('.wine-cta .btn-save');
  if (btn) btn.disabled = true;

  const acidita = parseInt(document.getElementById('slider-acidita').value);
  const corpo = parseInt(document.getElementById('slider-corpo').value);
  const persistenza = parseInt(document.getElementById('slider-persistenza').value);
  const emozione = state.emozioneSelezionata || 'Non specificata';

  try {
    const res = await fetch('/api/tastings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: state.utente.id,
        wineId: vino.id,
        acidita,
        corpo,
        persistenza,
        emozione
      })
    });

    if (!res.ok) throw new Error('Errore salvataggio');
    
    const assaggio = { vino, acidita, corpo, persistenza, emozione, timestamp: new Date() };
    const existing = state.assaggi.findIndex(a => a.vino.id === vino.id);
    if (existing >= 0) {
      state.assaggi[existing] = assaggio;
    } else {
      state.assaggi.push(assaggio);
    }
    saveState();

    showToast(`${vino.nome} salvato nel passaporto ✓`);
    setTimeout(() => {
      showScreen('home');
      renderHome();
    }, 800);
  } catch (e) {
    showToast('Errore nel salvataggio. Riprova.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function requestContact() {
  showToast('Richiesta inviata alla cantina 📬');
}

// ═══════════════════════════════════════════════════
// RENDER HOME
// ═══════════════════════════════════════════════════
function renderHome() {
  const el = document.getElementById('home-content');
  const assaggi = state.assaggi;
  const nome = state.utente.nome;

  const avgAcidita = assaggi.length ? Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length * 10) / 10 : '—';
  const avgCorpo = assaggi.length ? Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length * 10) / 10 : '—';

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
      html += `
        <div class="wine-card" onclick="openWine(${JSON.stringify(a.vino).replace(/"/g, '&quot;')})">
          <div class="wine-card-color" style="background: ${a.vino.colore}22; border: 1px solid ${a.vino.colore}44;">
            ${a.vino.emoji}
          </div>
          <div class="wine-card-info">
            <div class="wine-card-name">${a.vino.nome}</div>
            <div class="wine-card-cantina">${a.vino.cantina} · ${a.vino.annata}</div>
            <div class="wine-card-ratings">
              <span class="rating-pill">Ac. ${a.acidita}/5</span>
              <span class="rating-pill">Corpo ${a.corpo}/5</span>
              <span class="rating-pill">${a.emozione}</span>
            </div>
          </div>
          <div class="wine-card-score">${a.acidita + a.corpo + a.persistenza}</div>
        </div>
      `;
    });
  }

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════
// RENDER DNA
// ═══════════════════════════════════════════════════
async function renderDNA() {
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

  // Calcola medie
  const avgAcidita = Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length);
  const avgCorpo = Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length);
  const avgPersistenza = Math.round(assaggi.reduce((s,a) => s+a.persistenza, 0) / assaggi.length);

  // Conta emozioni
  const emoCount = {};
  assaggi.forEach(a => { emoCount[a.emozione] = (emoCount[a.emozione] || 0) + 1; });
  const topEmo = Object.entries(emoCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);

  // Cantine
  const cantineUniche = [...new Set(assaggi.map(a => a.vino.cantina))];

  // Loading
  el.innerHTML = `
    <div class="dna-profile-card">
      <div class="dna-loading">
        <div class="dna-spinner"></div>
        <span>L'AI sta analizzando i tuoi assaggi...</span>
      </div>
    </div>
  `;

  // Chiama Claude API
  const prompt = `Sei un sommelier poetico. Analizza questo profilo di degustazione e scrivi un paragrafo breve (3-4 frasi) in italiano, stile letterario, che descrive la personalità enologica di questa persona. Sii specifico, evocativo, usa metafore legate al territorio italiano.

Dati: ${assaggi.length} vini assaggiati, acidità media ${avgAcidita}/5, corpo medio ${avgCorpo}/5, persistenza media ${avgPersistenza}/5.
Emozioni prevalenti: ${topEmo.join(', ')}.
Vini preferiti: ${assaggi.slice(0,3).map(a => a.vino.nome + ' (' + a.vino.territorio + ')').join(', ')}.

Rispondi SOLO con il paragrafo, nessun titolo o introduzione.`;

  let dnaText = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    dnaText = data.content?.[0]?.text || generaDNAFallback(avgAcidita, avgCorpo, topEmo);
  } catch (e) {
    dnaText = generaDNAFallback(avgAcidita, avgCorpo, topEmo);
  }

  // Tags dal profilo
  const tags = [];
  if (avgAcidita >= 4) tags.push('Vini tesi');
  else if (avgAcidita <= 2) tags.push('Vini morbidi');
  if (avgCorpo >= 4) tags.push('Struttura densa');
  else if (avgCorpo <= 2) tags.push('Leggerezza');
}

function requestContact() {
  showToast('Richiesta inviata alla cantina 📬');
}

// ═══════════════════════════════════════════════════
// RENDER HOME
// ═══════════════════════════════════════════════════
function renderHome() {
  const el = document.getElementById('home-content');
  const assaggi = state.assaggi;
  const nome = state.utente.nome;

  const avgAcidita = assaggi.length ? Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length * 10) / 10 : '—';
  const avgCorpo = assaggi.length ? Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length * 10) / 10 : '—';

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
      html += `
        <div class="wine-card" onclick="openWine(${JSON.stringify(a.vino).replace(/"/g, '&quot;')})">
          <div class="wine-card-color" style="background: ${a.vino.colore}22; border: 1px solid ${a.vino.colore}44;">
            ${a.vino.emoji}
          </div>
          <div class="wine-card-info">
            <div class="wine-card-name">${a.vino.nome}</div>
            <div class="wine-card-cantina">${a.vino.cantina} · ${a.vino.annata}</div>
            <div class="wine-card-ratings">
              <span class="rating-pill">Ac. ${a.acidita}/5</span>
              <span class="rating-pill">Corpo ${a.corpo}/5</span>
              <span class="rating-pill">${a.emozione}</span>
            </div>
          </div>
          <div class="wine-card-score">${a.acidita + a.corpo + a.persistenza}</div>
        </div>
      `;
    });
  }

  el.innerHTML = html;
}

// ═══════════════════════════════════════════════════
// RENDER DNA
// ═══════════════════════════════════════════════════
async function renderDNA() {
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

  // Calcola medie
  const avgAcidita = Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length);
  const avgCorpo = Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length);
  const avgPersistenza = Math.round(assaggi.reduce((s,a) => s+a.persistenza, 0) / assaggi.length);

  // Conta emozioni
  const emoCount = {};
  assaggi.forEach(a => { emoCount[a.emozione] = (emoCount[a.emozione] || 0) + 1; });
  const topEmo = Object.entries(emoCount).sort((a,b) => b[1]-a[1]).slice(0,3).map(e => e[0]);

  // Cantine
  const cantineUniche = [...new Set(assaggi.map(a => a.vino.cantina))];

  // Loading
  el.innerHTML = `
    <div class="dna-profile-card">
      <div class="dna-loading">
        <div class="dna-spinner"></div>
        <span>L'AI sta analizzando i tuoi assaggi...</span>
      </div>
    </div>
  `;

  // Chiama Claude API
  const prompt = `Sei un sommelier poetico. Analizza questo profilo di degustazione e scrivi un paragrafo breve (3-4 frasi) in italiano, stile letterario, che descrive la personalità enologica di questa persona. Sii specifico, evocativo, usa metafore legate al territorio italiano.

Dati: ${assaggi.length} vini assaggiati, acidità media ${avgAcidita}/5, corpo medio ${avgCorpo}/5, persistenza media ${avgPersistenza}/5.
Emozioni prevalenti: ${topEmo.join(', ')}.
Vini preferiti: ${assaggi.slice(0,3).map(a => a.vino.nome + ' (' + a.vino.territorio + ')').join(', ')}.

Rispondi SOLO con il paragrafo, nessun titolo o introduzione.`;

  let dnaText = '';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    dnaText = data.content?.[0]?.text || generaDNAFallback(avgAcidita, avgCorpo, topEmo);
  } catch (e) {
    dnaText = generaDNAFallback(avgAcidita, avgCorpo, topEmo);
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
        ${tags.slice(0,6).map(t => `<span class="dna-tag">${t}</span>`).join('')}
      </div>
    </div>

    <div class="radar-section">
      <div class="radar-label">Profilo sensoriale</div>
      <div class="radar-bars">
        <div class="radar-bar-row">
          <span class="radar-bar-name">Acidità</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgAcidita/5*100}%"></div></div>
          <span class="radar-bar-value">${avgAcidita}/5</span>
        </div>
        <div class="radar-bar-row">
          <span class="radar-bar-name">Corpo</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgCorpo/5*100}%"></div></div>
          <span class="radar-bar-value">${avgCorpo}/5</span>
        </div>
        <div class="radar-bar-row">
          <span class="radar-bar-name">Persistenza</span>
          <div class="radar-bar-track"><div class="radar-bar-fill" style="width:${avgPersistenza/5*100}%"></div></div>
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

  // PRE-GENERAZIONE IMMAGINE (Risolve il blocco di sicurezza del browser sui click)
  window.instaStoryBlob = null;
  const shareBtn = document.querySelector('.share-btn');
  if (shareBtn) {
    shareBtn.textContent = 'Preparazione immagine...';
    shareBtn.style.opacity = '0.7';
  }
  
  setTimeout(async () => {
    const ready = prepareInstaLayout();
    if (ready) {
      const layout = document.getElementById('insta-story-layout');
      const originalScroll = window.scrollY;
      try {
        const canvas = await html2canvas(layout, {
          scale: 2, useCORS: true, backgroundColor: null, width: 1080, height: 1920, windowWidth: 1080, windowHeight: 1920
        });
        window.scrollTo(0, originalScroll);
        canvas.toBlob(blob => {
          window.instaStoryBlob = blob;
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
    }
  }, 500);
}

function generaDNAFallback(acidita, corpo, emozioni) {
  const profili = [
    'Un palato che non cerca conforto — cerca verità. I vini scelti oggi parlano di territorio con accento duro, senza mediazioni. C\'è una preferenza per l\'acidità viva, per quella tensione che tiene sveglio.',
    'Un degustatore del confine, attratto da vini che non si lasciano catalogare facilmente. La struttura non spaventa, anzi invita — come un racconto che richiede attenzione prima di rivelare il finale.',
    'Il profilo di chi lascia spazio al vino di parlare. Preferenza per leggerezza e precisione, come un fotografo che sceglie la luce giusta invece di riempire il frame.'
  ];
  const idx = Math.floor((acidita + corpo) / 4);
  return profili[Math.min(idx, profili.length - 1)];
}

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('error');
  if (type === 'error') t.classList.add('error');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function prepareInstaLayout() {
  const assaggi = state.assaggi;
  if (assaggi.length === 0) return false;
  
  // Setta il nome
  document.getElementById('insta-user-name').textContent = state.utente.nome || 'Esploratore';
  
  // Prendi il testo generato o fallback
  const dnaTextEl = document.querySelector('.dna-generated-text');
  const dnaText = dnaTextEl ? dnaTextEl.textContent : generaDNAFallback(
    Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length),
    Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length),
    []
  );
  document.getElementById('insta-dna-text').textContent = dnaText;
  
  // Medie e tags
  const avgAcidita = Math.round(assaggi.reduce((s,a) => s+a.acidita, 0) / assaggi.length);
  const avgCorpo = Math.round(assaggi.reduce((s,a) => s+a.corpo, 0) / assaggi.length);
  const avgPersistenza = Math.round(assaggi.reduce((s,a) => s+a.persistenza, 0) / assaggi.length);
  
  document.getElementById('insta-radar-bars').innerHTML = `
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Acidità</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgAcidita/5*100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Corpo</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgCorpo/5*100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
    <div class="insta-stat-row" style="display:flex; justify-content:space-between; margin-bottom:8px;">
      <span style="font-weight:500;">Persistenza</span>
      <div style="flex:1; margin:0 15px; height:8px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden; display:flex; align-items:center;">
        <div style="height:100%; width:${avgPersistenza/5*100}%; background:rgba(255,255,255,0.9);"></div>
      </div>
    </div>
  `;
  
  // Prendi i tags dal dom se ci sono
  const tagEls = document.querySelectorAll('.dna-tag');
  let tagsHTML = '';
  tagEls.forEach(el => {
    tagsHTML += `<span style="display:inline-block; padding:8px 16px; margin:4px; background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.3); border-radius:30px; font-size:24px;">${el.textContent}</span>`;
  });
  document.getElementById('insta-tags-container').innerHTML = tagsHTML;
  
  return true;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
}

async function shareDNA() {
  if (!window.instaStoryBlob) {
    showToast('Immagine non ancora pronta. Attendi qualche secondo...', 'error');
    return;
  }
  
  const file = new File([window.instaStoryBlob], "wine-dna.png", { type: "image/png" });
  
  // Il browser accetta navigator.share() o il downloadBlob solo se non ci sono "await" lunghi tra il click e la chiamata.
  // Poiché il blob è già pronto in memoria, l'azione è considerata sicura (user gesture conservato).
  
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Wine DNA',
        text: 'Il mio profilo sensoriale su Vino Passport'
      });
    } catch(err) {
      console.log("Condivisione annullata o fallita", err);
    }
  } else {
    // Fallback immediato senza await
    downloadBlob(window.instaStoryBlob, 'wine-dna.png');
    showToast('Immagine scaricata! Aggiungila alle tue Storie.');
  }
}

function getVinoFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('vino');
}

function cleanURL() {
  const url = new URL(window.location.href);
  url.searchParams.delete('vino');
  window.history.replaceState({}, document.title, url.toString());
}

async function initApp() {
  showScreen('loading');
  try {
    const r = await fetch('/api/wines');
    if (!r.ok) throw new Error('Network error');
    const data = await r.json();
    viniDB = data;
    state.viniQueue = [...viniDB];
    
    loadState();
    const vinoId = getVinoFromURL();
    
    if (vinoId) {
      const vino = viniDB.find(v => v.id === vinoId);
      if (!vino) {
        showToast('Vino non trovato.', 'error');
        cleanURL();
        if (state.utente.nome) {
          showScreen('home');
          renderHome();
        } else {
          showScreen('onboarding');
        }
        return;
      }
      cleanURL();
      if (state.utente.nome) {
        openWine(vino);
      } else {
        pendingVinoId = vinoId;
        showScreen('onboarding');
      }
    } else {
      if (state.utente.nome) {
        showScreen('home');
        renderHome();
      } else {
        showScreen('onboarding');
      }
    }
  } catch (e) {
    console.error(e);
    showToast("Impossibile caricare il catalogo", "error");
  }
}

// ═══════════════════════════════════════════════════
// SETTINGS PANEL
// ═══════════════════════════════════════════════════
function openSettings() {
  if (!state.utente.id) {
    showToast('Completa il profilo prima di modificarlo', 'error');
    return;
  }
  document.getElementById('settings-nome').value = state.utente.nome || '';
  document.getElementById('settings-email').value = state.utente.email || '';
  document.getElementById('settings-overlay').classList.add('open');
  document.getElementById('settings-panel').classList.add('open');
}

function closeSettings() {
  document.getElementById('settings-overlay').classList.remove('open');
  document.getElementById('settings-panel').classList.remove('open');
}

async function saveSettings() {
  const nome = document.getElementById('settings-nome').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  const btn = document.getElementById('settings-save-btn');

  // Validazione frontend
  if (!nome) {
    showToast('Il nome non può essere vuoto', 'error');
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showToast('Inserisci un indirizzo email valido', 'error');
    return;
  }

  // Nessuna modifica — chiudi senza fetch
  if (nome === state.utente.nome && email === state.utente.email) {
    closeSettings();
    return;
  }

  // Guard: id utente obbligatorio
  if (!state.utente.id) {
    showToast('Sessione non valida. Ricarica la pagina.', 'error');
    return;
  }

  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/users/${state.utente.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Errore nel salvataggio', 'error');
      return;
    }

    // Aggiorna state e localStorage
    state.utente.nome = data.nome;
    state.utente.email = data.email;
    saveState();

    // Aggiorna live: DNA subtitle se visibile
    const dnaSub = document.getElementById('dna-subtitle');
    if (dnaSub && dnaSub.textContent.includes('assaggi di')) {
      dnaSub.textContent = `Basato su ${state.assaggi.length} assaggi di ${data.nome}`;
    }

    closeSettings();
    showToast('Profilo aggiornato ✓');

  } catch (e) {
    showToast('Errore di connessione. Riprova.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Auto-init
initApp();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registrato con successo', reg.scope))
      .catch(err => console.error('Errore nella registrazione del Service Worker', err));
  });
}
