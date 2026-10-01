// ═══════════════════════════════════════════════════
// UTILS — funzioni pure e helper DOM
// ═══════════════════════════════════════════════════

export function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = String(message);
  toast.classList.toggle('error', type === 'error');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

export function clearElement(element) {
  element.replaceChildren();
}

export function appendElement(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  parent.appendChild(element);
  return element;
}

export function renderEmptyState(container, icon, title, message, padding = '', replace = true) {
  if (replace) clearElement(container);
  const empty = appendElement(container, 'div', 'empty-state');
  if (padding) empty.style.padding = padding;
  appendElement(empty, 'div', 'empty-state-icon', icon);
  appendElement(empty, 'div', 'empty-state-title', title);
  appendElement(empty, 'div', 'empty-state-text', message);
  return empty;
}

export function safeHexColor(value, fallback = '#6f3647') {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

export { calculateAverage, getTopEmotions } from './domain/sensory.mjs';

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 100);
}
