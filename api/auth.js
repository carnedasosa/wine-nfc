require('dotenv').config();
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET non è definito nelle variabili d\'ambiente.');
}

/**
 * Valida il formato email con una regex semplice ma efficace.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * POST /api/auth/login
 *
 * Registra un nuovo utente o autentica uno esistente (passwordless).
 * Risponde con un JWT firmato che il client deve conservare e allegare
 * a ogni richiesta successiva nell'header Authorization.
 *
 * Body: { nome: string, email: string }
 * Response: { token: string, user: { id, nome, email } }
 */
module.exports = async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { nome, email } = req.body;

    // ── Validazione input ─────────────────────────────────────────────────
    if (!nome || !nome.trim()) {
      return res.status(400).json({ error: 'Il nome è obbligatorio' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'L\'email è obbligatoria' });
    }
    if (!isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'Formato email non valido' });
    }

    const cleanNome = nome.trim();
    const cleanEmail = email.trim().toLowerCase();

    // ── Upsert utente ─────────────────────────────────────────────────────
    // Se l'utente esiste già, aggiorniamo il nome (potrebbe aver cambiato
    // soprannome tra un evento e l'altro). L'email è l'identificatore stabile.
    const user = await prisma.user.upsert({
      where: { email: cleanEmail },
      update: { nome: cleanNome },
      create: { nome: cleanNome, email: cleanEmail }
    });

    // ── Firma il token ────────────────────────────────────────────────────
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, nome: user.nome, email: user.email }
    });

  } catch (error) {
    console.error('Error in POST /api/auth/login:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
