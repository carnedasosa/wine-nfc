require('dotenv').config();
const express = require('express');
const path = require('path');

const { applySecurityHeaders } = require('./lib/http-security');

const app = express();

app.use((req, res, next) => {
  applySecurityHeaders(res, { hsts: false });
  next();
});
app.use(express.json({ limit: '16kb', strict: true }));

// Le route API devono precedere express.static.
app.all('/api/health', require('./api/health'));
app.all('/api/participation', require('./api/participation'));
app.all('/api/wines', require('./api/wines'));
app.all('/api/leaderboard', require('./api/leaderboard'));
app.all('/api/auth/request-otp', require('./api/auth/request-otp'));
app.all('/api/auth/verify-otp', require('./api/auth/verify-otp'));
app.all('/api/auth/exchange', require('./api/auth/exchange'));
app.all('/api/auth/session', require('./api/auth/session'));
app.all('/api/auth/refresh', require('./api/auth/refresh'));
app.all('/api/auth/logout', require('./api/auth/logout'));
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
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

// Non esporre la radice del repository.
app.use(express.static(path.join(__dirname, 'dist')));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => console.log('Wine NFC: http://' + HOST + ':' + PORT));
