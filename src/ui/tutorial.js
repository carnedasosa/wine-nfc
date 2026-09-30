import { state } from '../state.js';

const steps = [
  {
    title: 'Un tap, un nuovo assaggio.',
    text: 'Avvicina il telefono al tag NFC della bottiglia oppure inquadra il suo QR. Si apre la scheda del vino, pronta per le tue impressioni.',
    hint: 'Se hai già scansionato un vino, la sua scheda ti aspetta qui sotto.'
  },
  {
    title: 'Segui le tue sensazioni.',
    text: 'Regola acidità, corpo e persistenza da 1 a 5, scegli l’emozione che ti dà il vino e tocca “Salva nel passaporto”.',
    hint: 'Non serve essere esperti: racconta quello che senti tu.'
  },
  {
    title: 'Ogni calice, un ricordo.',
    text: 'Nel Passaporto ritrovi i vini assaggiati e le tue valutazioni. Tocca un vino per rivedere la scheda o aggiornare le tue impressioni.',
    hint: 'La Classifica è facoltativa: puoi partecipare dal tuo profilo.'
  },
  {
    title: 'Scopri il tuo Wine DNA.',
    text: 'Dopo aver salvato i primi assaggi, apri Wine DNA: trovi un riepilogo del tuo profilo sensoriale, da condividere se ti va.',
    hint: 'Un ripasso? Nel profilo trovi sempre “Rivedi il tutorial”.'
  }
];

const dismissed = new Set();
let stepIndex = 0;
let activeKey = null;
let lastFocus = null;

function preferenceKey() {
  return `vino-tutorial:v1:${state.utente.id}`;
}

function hasDismissed(key) {
  if (dismissed.has(key)) return true;
  try { return localStorage.getItem(key) === 'done'; } catch { return false; }
}

function renderStep() {
  const step = steps[stepIndex];
  document.getElementById('tutorial-count').textContent = `Passaggio ${stepIndex + 1} di ${steps.length}`;
  document.getElementById('tutorial-title').textContent = step.title;
  document.getElementById('tutorial-description').textContent = step.text;
  document.getElementById('tutorial-hint').textContent = step.hint;
  document.getElementById('tutorial-back-btn').hidden = stepIndex === 0;
  document.getElementById('tutorial-next-btn').textContent = stepIndex === steps.length - 1 ? 'Inizia a degustare →' : 'Avanti →';
  document.querySelectorAll('[data-tutorial-art]').forEach((art, index) => {
    art.hidden = index !== stepIndex;
  });
  document.querySelectorAll('.tutorial-progress span').forEach((dot, index) => {
    dot.classList.toggle('is-current', index === stepIndex);
    dot.classList.toggle('is-complete', index < stepIndex);
  });
  document.getElementById('tutorial-dialog').scrollTop = 0;
  document.getElementById('tutorial-title').focus({ preventScroll: true });
}

export function openTutorial({ force = false } = {}) {
  const dialog = document.getElementById('tutorial-dialog');
  if (!state.utente.id || dialog.open) return;
  const key = preferenceKey();
  if (!force && hasDismissed(key)) return;
  activeKey = key;
  stepIndex = 0;
  lastFocus = document.activeElement;
  document.body.classList.add('tutorial-open');
  dialog.showModal();
  renderStep();
}

export function closeTutorial({ remember = false, restoreFocus = true } = {}) {
  const dialog = document.getElementById('tutorial-dialog');
  if (!dialog.open) return;
  if (remember && activeKey) {
    dismissed.add(activeKey);
    try { localStorage.setItem(activeKey, 'done'); } catch { /* Preferenza solo in memoria se lo storage è bloccato. */ }
  }
  dialog.close();
  document.body.classList.remove('tutorial-open');
  activeKey = null;
  if (restoreFocus) {
    const target = lastFocus?.isConnected && lastFocus.matches('button, input, a[href], [tabindex]')
      && lastFocus.getClientRects().length && !lastFocus.closest('[inert]')
      ? lastFocus : document.querySelector('.screen.active button:not([hidden]):not(:disabled)');
    target?.focus({ preventScroll: true });
  }
  lastFocus = null;
}

export function bindTutorialEvents() {
  document.getElementById('tutorial-skip-btn').addEventListener('click', () => closeTutorial({ remember: true }));
  document.getElementById('tutorial-dialog').addEventListener('cancel', event => {
    event.preventDefault();
    closeTutorial({ remember: true });
  });
  document.getElementById('tutorial-next-btn').addEventListener('click', () => {
    if (stepIndex === steps.length - 1) return closeTutorial({ remember: true });
    stepIndex++;
    renderStep();
  });
  document.getElementById('tutorial-back-btn').addEventListener('click', () => {
    if (stepIndex > 0) stepIndex--;
    renderStep();
  });
}
