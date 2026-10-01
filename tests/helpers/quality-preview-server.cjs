// Fixture locale per verificare il frontend reale senza DB, credenziali o provider.
const express = require('express');
const path = require('node:path');
const { applySecurityHeaders } = require('../../lib/http-security');
const app = express();
app.use(express.json());
app.use((req, res, next) => { applySecurityHeaders(res, { hsts: false }); next(); });
const event = { id: 'fixture-event', nome: 'Collaudo qualità', inizio: '2026-10-01T08:00:00Z', fine: '2026-10-02T20:00:00Z', timezone: 'Europe/Rome', open: true };
const wine = { id: 'fixture-wine', nome: 'Rosso di collaudo', cantina: 'Cantina sintetica', colore: '#8b2045', emoji: '🍷' };
let user = { id: 'fixture-user', nome: 'Ada', email: 'ada@example.test' };
let tasting = { wine, version: 7, acidita: 5, corpo: 5, persistenza: 5, emozione: 'Pace', createdAt: '2026-10-01T10:00:00Z' };
let failReads = false;
let conflictNext = false;
let leaderboardCount = 101;
const replays = new Map();
app.post('/__fixture/reset', (req, res) => {
  user = { id: 'fixture-user', nome: 'Ada', email: 'ada@example.test' };
  failReads = Boolean(req.body.failReads); conflictNext = Boolean(req.body.conflictNext);
  leaderboardCount = Number.isInteger(req.body.leaderboardCount) ? req.body.leaderboardCount : 101;
  tasting = { ...tasting, version: 7, acidita: 5, corpo: 5, persistenza: 5, emozione: 'Pace' };
  replays.clear(); res.json({ ok: true });
});
app.get('/api/wines', (req, res) => res.json({ event, wines: [wine] }));
app.get('/api/auth/session', (req, res) => res.status(user ? 200 : 401).json({ user }));
app.get('/api/tastings', (req, res) => {
  if (failReads) return res.set('Retry-After', '60').status(503).json({ message: 'Lettura simulata non disponibile' });
  res.json([tasting]);
});
app.post('/api/tastings', (req, res) => {
  const input = req.body;
  if (replays.has(input.idempotencyKey)) return res.set('Idempotency-Replayed', 'true').status(201).json(replays.get(input.idempotencyKey));
  if (conflictNext || input.baseVersion !== tasting.version) {
    conflictNext = false; tasting.version += 1;
    return res.status(409).json({ code: 'TASTING_VERSION_CONFLICT', message: 'Voto modificato altrove' });
  }
  tasting = { ...tasting, ...input, version: tasting.version + 1 };
  replays.set(input.idempotencyKey, tasting);
  res.set('Idempotency-Replayed', 'false').status(201).json(tasting);
});
app.get('/api/participation', (req, res) => res.json({ nickname: 'Ada', consensoLeaderboard: false }));
app.put('/api/users/:id', (req, res) => { user = { ...user, nome: req.body.nome }; res.json({ user }); });
app.put('/api/participation', (req, res) => res.json(req.body));
app.get('/api/leaderboard', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;
  res.json(Array.from({ length: Math.max(0, Math.min(limit, leaderboardCount - offset)) }, (_, index) => ({
    rank: offset + index + 1, nome: 'Nickname di collaudo', tastingsCount: 2, isCurrentUser: false
  })));
});
app.post('/api/dna', (req, res) => res.json({ dnaText: 'Riepilogo di collaudo', fallback: true, stats: { tags: [], cantine: [wine.cantina], averages: { acidita: tasting.acidita, corpo: tasting.corpo, persistenza: tasting.persistenza } } }));
app.post('/api/auth/logout', (req, res) => { user = null; res.status(204).end(); });
app.use(express.static(path.resolve(__dirname, '../../dist')));
app.listen(4174, '127.0.0.1', () => console.log('Fixture qualità: http://127.0.0.1:4174'));
