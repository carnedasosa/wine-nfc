const express = require('express');
const app = express();
const path = require('path');

app.use(express.json());

// Mappa manualmente le Serverless Functions di Vercel agli handler locali
// IMPORTANTE: Le route API devono essere registrate PRIMA di express.static,
// altrimenti Express 5 intercetta le richieste /api/* cercando file statici
// nella cartella api/ del progetto e restituisce 404.
app.all('/api/wines', require('./api/wines'));
app.all('/api/users', require('./api/users'));
app.all('/api/users/:id', require('./api/users')); // Settings: PUT per aggiornamento profilo
app.all('/api/tastings', require('./api/tastings'));

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
