const prisma = require('../../lib/prisma');
const { withAuth } = require('../../lib/auth');

/**
 * Valida il formato email con una regex semplice ma efficace.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Handler per PUT /api/users/[id]
 *
 * Aggiorna nome e/o email dell'utente autenticato.
 * Il middleware JWT garantisce che req.userId corrisponde al token firmato;
 * aggiungiamo un controllo esplicito che l'utente stia modificando solo
 * il proprio profilo (prevenendo privilege escalation orizzontale).
 */
module.exports = withAuth(async function(req, res) {

  // ── PUT /api/users/[id] ────────────────────────────────────────────────
  if (req.method === 'PUT') {
    try {
      // Su Vercel, i parametri dinamici sono in req.query
      const id = req.query.id;

      if (!id) {
        return res.status(400).json({ error: 'ID utente mancante' });
      }

      // Controllo di proprietà: un utente può modificare solo se stesso
      if (id !== req.userId) {
        return res.status(403).json({ error: 'Non autorizzato a modificare questo profilo' });
      }

      const { nome, email } = req.body;

      // Validazione input
      if (!nome || !nome.trim()) {
        return res.status(400).json({ error: 'Nome e email sono obbligatori' });
      }
      if (!email || !email.trim()) {
        return res.status(400).json({ error: 'Nome e email sono obbligatori' });
      }
      if (!isValidEmail(email.trim())) {
        return res.status(400).json({ error: 'Formato email non valido' });
      }

      // Verifica che l'utente esista
      const existing = await prisma.user.findUnique({ where: { id } });
      if (!existing) {
        return res.status(404).json({ error: 'Utente non trovato' });
      }

      // Verifica conflitto email (solo se l'email è cambiata)
      if (email.trim() !== existing.email) {
        const emailConflict = await prisma.user.findUnique({
          where: { email: email.trim() }
        });
        if (emailConflict && emailConflict.id !== id) {
          return res.status(409).json({ error: 'Email già in uso da un altro account' });
        }
      }

      // Esegui l'aggiornamento
      const updated = await prisma.user.update({
        where: { id },
        data: {
          nome: nome.trim(),
          email: email.trim()
        }
      });

      return res.status(200).json(updated);

    } catch (error) {
      console.error('Error in PUT /api/users/[id]:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Metodo non supportato ─────────────────────────────────────────────
  return res.status(405).json({ error: 'Method not allowed' });
});
