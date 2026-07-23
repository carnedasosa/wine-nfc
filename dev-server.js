require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const auth = require('./api/middleware/auth');

app.use(express.json());

// ── Route pubbliche (nessun token richiesto) ─────────────────────────────────
// IMPORTANTE: Le route API devono essere registrate PRIMA di express.static,
// altrimenti Express 5 intercetta le richieste /api/* cercando file statici
// nella cartella api/ del progetto e restituisce 404.
app.all('/api/wines', require('./api/wines'));
app.post('/api/auth/login', require('./api/auth'));
app.get('/api/leaderboard', require('./api/leaderboard'));

// ── Route protette (richiedono JWT valido) ───────────────────────────────────
app.all('/api/tastings', auth, require('./api/tastings'));
app.all('/api/dna', auth, require('./api/dna'));
app.put('/api/users/:id', auth, require('./api/users'));

// Servi i file statici (index.html, style.css, app.js, ecc.) dalla cartella corrente
app.use(express.static(path.join(__dirname, '.')));

const os = require('os');
const networkInterfaces = os.networkInterfaces();
let localIp = 'localhost';
for (const interfaceName in networkInterfaces) {
  const iface = networkInterfaces[interfaceName];
  for (let i = 0; i < iface.length; i++) {
    const alias = iface[i];
    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
      localIp = alias.address;
    }
  }
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🍷 Server locale di sviluppo avviato!`);
  console.log(`👉 Accesso dal PC: http://localhost:${PORT}`);
  console.log(`👉 Accesso da Mobile: http://${localIp}:${PORT}\n`);
});
