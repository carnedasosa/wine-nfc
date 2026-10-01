import { beforeEach, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';
vi.mock('../src/ui/story.js', () => ({ clearStory: vi.fn(), configureStory: vi.fn(), openStory: vi.fn() }));
vi.mock('../src/utils.js', () => ({
  clearElement: parent => { parent.children = []; },
  appendElement: (parent, tag, _className, text = '') => {
    const child = { tag, text, children: [], style: {}, setAttribute: vi.fn() };
    parent.children.push(child); return child;
  },
  renderEmptyState: vi.fn()
}));
let store, API, ui, nodes;
function textContent(node) { return [node.text, ...node.children.flatMap(textContent)].filter(Boolean); }
beforeEach(async () => {
  vi.resetModules(); nodes = new Map();
  vi.stubGlobal('document', { getElementById: id => {
    if (!nodes.has(id)) nodes.set(id, { children: [], style: {} });
    return nodes.get(id);
  } });
  store = await import('../src/state.js'); store.setAuthenticatedUser({ id: 'A', nome: 'Ada' }); store.setActiveEvent('event');
  store.state.assaggi = [3, 4].map((acidita, index) => ({ vino: { id: String(index) }, acidita, corpo: 3, persistenza: 3, emozione: 'Pace' }));
  ({ API } = await import('../src/api.js')); vi.spyOn(API, 'getDNA');
  ui = await import('../src/ui/dna.js');
});

it.each(['rejected', 'malformed'])('usa le medie reali nel fallback quando la risposta è %s', async mode => {
  if (mode === 'rejected') API.getDNA.mockRejectedValue(new Error('offline'));
  else API.getDNA.mockResolvedValue({ dnaText: 'test', stats: { tags: null } });
  await ui.renderDNA();
  const texts = textContent(nodes.get('dna-content'));
  expect(texts).toContain('3.5/5');
  expect(texts).not.toContain('Vini tesi');
  expect(texts.some(text => text.includes('Riepilogo descrittivo'))).toBe(true);
});

it('non ripristina il DNA di A dopo un nuovo login dello stesso account', async () => {
  const pending = deferred(); API.getDNA.mockReturnValue(pending.promise);
  const rendering = ui.renderDNA();
  store.clearUserState(); store.setAuthenticatedUser({ id: 'A' }); ui.clearDnaCache();
  pending.resolve({ dnaText: 'Vecchio profilo', stats: { tags: [], cantine: [], averages: { acidita: 3, corpo: 3, persistenza: 3 } } });
  await rendering;
  expect(nodes.get('dna-content').children).toEqual([]);
});
