const prisma = require('../lib/prisma');

/**
 * Valida il formato email con una regex semplice ma efficace.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = async function(req, res) {

  // ── POST /api/users ──────────────────────────────────────────────────────
  // Crea un nuovo utente o restituisce quello esistente con la stessa email.
  if (req.method === 'POST') {
    try {
      const { nome, email } = req.body;

      if (!nome || !email) {
        return res.status(400).json({ error: 'Nome e email sono obbligatori' });
      }

      let user = await prisma.user.findUnique({
        where: { email: email }
      });

      if (user) {
        return res.status(200).json(user);
      } else {
        user = await prisma.user.create({
          data: {
            nome: nome,
            email: email
          }
        });
        return res.status(201).json(user);
      }
    } catch (error) {
      console.error('Error in POST /api/users:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── PUT /api/users/:id ───────────────────────────────────────────────────
  // Aggiorna nome e/o email di un utente esistente.
  if (req.method === 'PUT') {
    try {
      const id = req.params.id;

      if (!id) {
        return res.status(400).json({ error: 'ID utente mancante' });
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
      console.error('Error in PUT /api/users/:id:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // ── Metodo non supportato ────────────────────────────────────────────────
  return res.status(405).json({ error: 'Method not allowed' });
};
