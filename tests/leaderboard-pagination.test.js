import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deferred } from './helpers/deferred.js';

const { node } = vi.hoisted(() => ({ node: (tag = 'div', text = '') => ({
  tag, text, children: [], style: {}, events: {}, classList: { add() {} },
  setAttribute() {}, append(child) { this.children.push(child); },
  addEventListener(event, callback) { this.events[event] = callback; }
}) }));
vi.mock('../src/utils.js', () => ({
  appendElement(parent, tag, className, text = '') {
    const child = node(tag, text); parent.children.push(child); return child;
  },
  clearElement(parent) { parent.children = []; },
  renderEmptyState(parent) { parent.children = [node('empty')]; }
}));

let store, API, ui, container;
function descendants(element) { return [element, ...element.children.flatMap(descendants)]; }
function rows() { return descendants(container).filter(item => item.tag === 'li'); }
function buttons() { return descendants(container).filter(item => item.tag === 'button'); }
function pageRows(count, page = 1) {
  return Array.from({ length: count }, (_, index) => ({ rank: (page - 1) * 50 + index + 1, nome: 'Nickname uguale', tastingsCount: 2 }));
}
beforeEach(async () => {
  vi.resetModules();
  container = node();
  vi.stubGlobal('document', { getElementById: () => container, createTextNode: text => node('text', text) });
  store = await import('../src/state.js');
  store.setAuthenticatedUser({ id: 'A' }); store.setActiveEvent('event-A');
  ({ API } = await import('../src/api.js'));
  vi.spyOn(API, 'getLeaderboard');
  ui = await import('../src/ui/leaderboard.js');
});

describe('classifica paginata', () => {
  it.each([0, 1, 50, 51, 101])('rende raggiungibili tutti i %i partecipanti del dataset statico', async total => {
    API.getLeaderboard.mockImplementation(async (_eventId, page) => pageRows(Math.max(0, Math.min(50, total - (page - 1) * 50)), page));
    await ui.renderLeaderboard();
    for (let page = 0; buttons().length && page < 4; page++) await ui.renderLeaderboard({ loadMore: true });
    expect(buttons()).toHaveLength(0);
    expect(rows()).toHaveLength(total);
    if (total > 50) expect(descendants(container).some(item => item.text === '#51')).toBe(true);
    expect(API.getLeaderboard).toHaveBeenCalledWith('event-A', 1, 50);
  });

  it('ritenta la pagina fallita conservando la prima senza duplicarla', async () => {
    API.getLeaderboard.mockResolvedValueOnce(pageRows(50)).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(pageRows(1, 2));
    await ui.renderLeaderboard();
    await ui.renderLeaderboard({ loadMore: true });
    expect(rows()).toHaveLength(50);
    expect(buttons()[0].text).toBe('Riprova il caricamento');
    await ui.renderLeaderboard({ loadMore: true });
    expect(API.getLeaderboard.mock.calls.map(call => call[1])).toEqual([1, 2, 2]);
    expect(rows()).toHaveLength(51);
  });

  it('alla scadenza riparte dalla prima pagina', async () => {
    vi.useFakeTimers();
    API.getLeaderboard.mockResolvedValue(pageRows(50));
    await ui.renderLeaderboard();
    vi.advanceTimersByTime(31000);
    await ui.renderLeaderboard({ loadMore: true });
    expect(API.getLeaderboard.mock.calls.map(call => call[1])).toEqual([1, 1]);
    expect(rows()).toHaveLength(50);
  });

  it('ignora una risposta del vecchio account dopo il reset', async () => {
    const pending = deferred(); API.getLeaderboard.mockReturnValueOnce(pending.promise);
    const loading = ui.renderLeaderboard();
    store.clearUserState(); store.setAuthenticatedUser({ id: 'B' }); ui.clearLeaderboardCache();
    API.getLeaderboard.mockResolvedValueOnce(pageRows(1));
    await ui.renderLeaderboard();
    pending.resolve(pageRows(50)); await loading;
    expect(rows()).toHaveLength(1);
  });
});
