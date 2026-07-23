const jwt = require('jsonwebtoken');

/**
 * Verifica il token JWT per le serverless functions di Vercel.
 * A differenza del middleware Express, questa funzione non chiama next()
 * ma restituisce il userId o null.
 *
 * @param {import('http').IncomingMessage} req
 * @returns {string|null} userId oppure null se il token è assente/invalido
 */
function verifyToken(req) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Wrapper che protegge un handler. Se il token è invalido o assente,
 * risponde 401 senza eseguire l'handler.
 *
 * @param {Function} handler - (req, res) dove req.userId è già impostato
 * @returns {Function} serverless function compatibile Vercel
 */
function withAuth(handler) {
  return async function(req, res) {
    const userId = verifyToken(req);
    if (!userId) {
      return res.status(401).json({ error: 'Token di autenticazione mancante o non valido' });
    }
    req.userId = userId;
    return handler(req, res);
  };
}

module.exports = { verifyToken, withAuth };
