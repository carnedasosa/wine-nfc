// Local UI fixtures only. Never included in dist; no connection to a real database.
const express = require('express');
const path = require('node:path');
const { applySecurityHeaders } = require('../../lib/http-security');
const app = express();
app.use((req, res, next) => { applySecurityHeaders(res, { hsts: false }); next(); });
const event = { id: 'story-fixture-event', nome: 'Sovranaturale', inizio: '2026-10-25T09:00:00Z', fine: '2026-10-25T19:00:00Z', timezone: 'Europe/Rome' };
const wines = ['Uno', 'Due', 'Tre'].map((nome, i) => ({ id: `wine-${i}`, nome, cantina: 'Cantina dimostrativa', territorio: 'Italia, Puglia', tipo: 'Bianco', colore: '#E8BC62' }));
app.get('/api/wines', (req, res) => res.json({ event, wines }));
app.get('/api/auth/session', (req, res) => res.json({ user: { id: 'story-fixture-user', nome: 'Alex', email: 'alex@example.test' } }));
app.get('/api/tastings', (req, res) => res.json(wines.map((wine, i) => ({ wine, acidita: i + 2, corpo: 3, persistenza: 4, emozione: i === 1 ? 'Sorpresa' : 'Energia', version: 1, createdAt: '2026-10-25T12:00:00Z' }))));
app.post('/api/dna', (req, res) => setTimeout(() => res.json({ dnaText: 'Nei tuoi assaggi ricorrono energia e sorpresa.', fallback: false, stats: { tags: ['Energia', 'Sorpresa'], cantine: ['Cantina dimostrativa'], averages: { acidita: 3, corpo: 3, persistenza: 4 } } }), Number(process.env.DNA_DELAY_MS || 0)));
app.get('/api/participation', (req, res) => res.json({ nickname: '', consensoLeaderboard: false }));
app.post('/api/auth/logout', (req, res) => res.json({ ok: true }));
app.use(express.static(path.resolve(__dirname, '../../dist')));
app.listen(4173, '127.0.0.1', () => console.log('Story fixture preview: http://127.0.0.1:4173'));
