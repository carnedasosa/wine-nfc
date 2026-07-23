// ═══════════════════════════════════════════════════
// UTILS — funzioni pure e helper DOM minimali
// ═══════════════════════════════════════════════════

export function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('error');
  if (type === 'error') t.classList.add('error');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

/**
 * Sanifica una stringa per prevenire vulnerabilità XSS (Cross-Site Scripting)
 * quando viene inserita nel DOM tramite .innerHTML.
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, function(match) {
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return escapeMap[match];
  });
}

/**
 * Calcola la media di un campo numerico su un array di assaggi.
 * Restituisce 0 se l'array è vuoto.
 */
export function calculateAverage(assaggi, field) {
  if (!assaggi || assaggi.length === 0) return 0;
  return Math.round(assaggi.reduce((s, a) => s + a[field], 0) / assaggi.length * 10) / 10;
}

/**
 * Restituisce le `count` emozioni più frequenti negli assaggi.
 */
export function getTopEmotions(assaggi, count = 3) {
  if (!assaggi || assaggi.length === 0) return [];
  const emoCount = {};
  assaggi.forEach(a => { emoCount[a.emozione] = (emoCount[a.emozione] || 0) + 1; });
  return Object.entries(emoCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(e => e[0]);
}

/**
 * Scarica un Blob come file.
 */
export function downloadBlob(blob, filename) {
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
