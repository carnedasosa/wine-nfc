// ═══════════════════════════════════════════════════
// DATABASE MOCK — vini della fiera
// ═══════════════════════════════════════════════════
const viniDB = [
  {
    id: 'v1',
    nome: 'Primitivo Selvatico',
    cantina: 'Masseria Terre Rosse',
    annata: '2021',
    vitigno: 'Primitivo',
    territorio: 'Valle d\'Itria, Puglia',
    tipo: 'rosso',
    emoji: '🍷',
    desc: 'Nasce su suoli argillosi rossi del tavoliere murgiano. Fermentazione spontanea in anfore di terracotta pugliese, nessuna aggiunta. Il frutto è generoso ma non stanca — c\'è una tensione sotto, come un racconto che non ha ancora finito di parlarsi.',
    colore: '#5c1a28'
  },
  {
    id: 'v2',
    nome: 'Fiano Ambrato',
    cantina: 'Cantine del Fuoco',
    annata: '2020',
    vitigno: 'Fiano',
    territorio: 'Irpinia, Campania',
    tipo: 'arancio',
    emoji: '🧡',
    desc: 'Macerazione sulle bucce per 40 giorni. Color ambra profondo, schiuma quasi assente. Sa di camomilla essiccata, cera d\'api, e un finale salato che ti riporta al mare d\'inverno. Per chi non ha paura dei vini che chiedono tempo.',
    colore: '#7a4a1a'
  },
  {
    id: 'v3',
    nome: 'Nerello delle Rocce',
    cantina: 'Etna Selvaggia',
    annata: '2019',
    vitigno: 'Nerello Mascalese',
    territorio: 'Etna Nord, Sicilia',
    tipo: 'rosso',
    emoji: '🌋',
    desc: 'Da viti centenarie a 800 metri. Il suolo vulcanico si sente — c\'è una mineralità quasi pietrosa che attraversa il frutto come una corrente. Leggero di corpo, pesante di personalità. Come una persona silenziosa in una stanza rumorosa.',
    colore: '#3d1a35'
  },
  {
    id: 'v4',
    nome: 'Vermentino dei Venti',
    cantina: 'Sa Defenza',
    annata: '2022',
    vitigno: 'Vermentino',
    territorio: 'Gallura, Sardegna',
    tipo: 'bianco',
    emoji: '🌿',
    desc: 'Vendemmia notturna per preservare i profumi. Nessun legno, acciaio inox. Agrumi freschi, macchia mediterranea, e un\'amaro finale che ricorda il rosmarino sotto il sole. Il vino dell\'estate che non vuole finire.',
    colore: '#1a4a2e'
  },
  {
    id: 'v5',
    nome: 'Lambrusco Ancestrale',
    cantina: 'Podere Matto',
    annata: '2023',
    vitigno: 'Lambrusco di Sorbara',
    territorio: 'Modena, Emilia',
    tipo: 'frizzante',
    emoji: '✨',
    desc: 'Metodo ancestrale, rifermentazione in bottiglia. Schiuma violacea tenue, quasi impalpabile. Melograno, terra bagnata, e una bollicina che non aggredisce. Da bere freddo, in piedi, in un campo.',
    colore: '#4a1a5c'
  },
  {
    id: 'v6',
    nome: 'Coda di Volpe Vulcanica',
    cantina: 'Vigna del Vesuvio',
    annata: '2021',
    vitigno: 'Coda di Volpe',
    territorio: 'Vesuvio, Campania',
    tipo: 'bianco',
    emoji: '🌊',
    desc: 'L\'uva cresce letteralmente sulla lava del Vesuvio. Giallo paglierino brillante, naso di fiori bianchi e pietra focaia. Bocca verticale, quasi nervosa. Un vino che ti ricorda che la terra viva.',
    colore: '#1a3a5c'
  }
];

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
function startPassport() {
  const nome = document.getElementById('input-nome').value.trim();
  const email = document.getElementById('input-email').value.trim();

  if (!nome) {
    showToast('Inserisci il tuo nome per continuare');
    return;
  }

  state.utente = { nome, email };

  // NFC URL Routing: se c'è un vino pendente, aprilo direttamente
  if (pendingVinoId) {
    const vino = viniDB.find(v => v.id === pendingVinoId);
    pendingVinoId = null; // Consuma il pending
    if (vino) {
      openWine(vino);
      return;
    }
  }

  showScreen('home');
  renderHome();
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
    document.getElementById('slider-' + s).value = 3;
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

function updateSlider(tipo, val) {
  document.getElementById(tipo + '-val').textContent = val;
}

function selectEmo(el, emo) {
  document.querySelectorAll('.emo-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  state.emozioneSelezionata = emo;
}

function saveWine() {
  const vino = state.vinoCorrente;
  const assaggio = {
    vino,
    acidita: parseInt(document.getElementById('slider-acidita').value),
    corpo: parseInt(document.getElementById('slider-corpo').value),
    persistenza: parseInt(document.getElementById('slider-persistenza').value),
    emozione: state.emozioneSelezionata || 'Non specificata',
    timestamp: new Date()
  };

  // Evita duplicati
  const existing = state.assaggi.findIndex(a => a.vino.id === vino.id);
  if (existing >= 0) {
    state.assaggi[existing] = assaggio;
  } else {
    state.assaggi.push(assaggio);
  }

  showToast(`${vino.nome} salvato nel passaporto ✓`);
  setTimeout(() => {
    showScreen('home');
    renderHome();
  }, 800);
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
// NFC URL ROUTING
// ═══════════════════════════════════════════════════
function getVinoFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('vino'); // null se non presente
}

function cleanURL() {
  if (window.location.search) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function init() {
  const vinoId = getVinoFromURL();
  
  if (vinoId) {
    const vino = viniDB.find(v => v.id === vinoId);
    
    if (!vino) {
      // Edge case: ID vino non valido
      showToast('Vino non trovato. Scopri i vini disponibili!');
      cleanURL();
      if (state.utente.nome) {
        showScreen('home');
        renderHome();
      }
      return;
    }
    
    cleanURL();
    
    if (state.utente.nome) {
      // Utente registrato + vino valido → apri direttamente
      openWine(vino);
    } else {
      // Utente NON registrato → onboarding, poi redirect
      pendingVinoId = vinoId;
    }
  } else {
    // Nessun parametro vino → flusso normale
    if (state.utente.nome) {
      showScreen('home');
      renderHome();
    }
  }
}

// Auto-init
init();

// ═══════════════════════════════════════════════════
// UTILS
// ═══════════════════════════════════════════════════
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

function shareDNA() {
  if (navigator.share) {
    navigator.share({
      title: 'Il mio Wine DNA — Vini di Terra 2025',
      text: 'Ho appena scoperto il mio profilo sensoriale alla fiera del vino. Scopri il tuo!',
      url: window.location.href
    });
  } else {
    showToast('Link copiato negli appunti ✓');
  }
}
