const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware Express che verifica il token JWT nell'header Authorization.
 * Se il token è valido, inietta `req.userId` (string UUID) e prosegue.
 * Se non è valido o assente, risponde 401.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token di autenticazione mancante' });
  }

  const token = authHeader.slice(7); // rimuove "Bearer "

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub; // UUID dell'utente
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token scaduto, effettua nuovamente il login' });
    }
    return res.status(401).json({ error: 'Token non valido' });
  }
}

module.exports = authMiddleware;
