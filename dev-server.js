require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const { applySecurityHeaders } = require('./lib/http-security');

const app = express();

app.use((req, res, next) => {
  applySecurityHeaders(res, { hsts: false });
  next();
});
app.use(express.json({ limit: '16kb', strict: true }));

// Le route API devono precedere express.static.
app.all('/api/wines', require('./api/wines'));
app.all('/api/leaderboard', require('./api/leaderboard'));
app.all('/api/auth/request-otp', require('./api/auth/request-otp'));
app.all('/api/auth/verify-otp', require('./api/auth/verify-otp'));
app.all('/api/auth/exchange', require('./api/auth/exchange'));
app.all('/api/auth/session', require('./api/auth/session'));
app.all('/api/auth/refresh', require('./api/auth/refresh'));
app.all('/api/auth/logout', require('./api/auth/logout'));
if (process.env.NODE_ENV !== 'production') {
  app.all('/api/auth/mock-login', require('./api/auth/mock-login'));
}
app.all('/api/tastings', require('./api/tastings'));
app.all('/api/dna', require('./api/dna'));
app.put('/api/users/:id', require('./api/users/[id]'));

app.use((error, req, res, next) => {
  if (error && (error.type === 'entity.too.large' || error.status === 413)) {
    return res.status(413).json({
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Il payload supera il limite di 16384 byte',
      fields: {}
    });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      code: 'INVALID_JSON',
      message: 'Il body JSON non è valido',
      fields: {}
    });
  }
  return next(error);
});

// Il perimetro statico e il bind di rete appartengono a M0 e restano invariati.
app.use(express.static(path.join(__dirname, '.')));

const networkInterfaces = os.networkInterfaces();
let localIp = 'localhost';
for (const interfaceName in networkInterfaces) {
  const iface = networkInterfaces[interfaceName];
  for (let i = 0; i < iface.length; i += 1) {
    const alias = iface[i];
    if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
      localIp = alias.address;
    }
  }
}

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n🍷 Server locale di sviluppo avviato!');
  console.log(`👉 Accesso dal PC: http://localhost:${PORT}`);
  console.log(`👉 Accesso da Mobile: http://${localIp}:${PORT}\n`);
});
