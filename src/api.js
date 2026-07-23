// ═══════════════════════════════════════════════════
// API — tutte le chiamate HTTP in un unico modulo
// ═══════════════════════════════════════════════════

/**
 * Mappa le righe raw dal backend al formato interno degli assaggi.
 */
function mapTasting(d) {
  return {
    vino: d.wine,
    acidita: d.acidita,
    corpo: d.corpo,
    persistenza: d.persistenza,
    emozione: d.emozione,
    timestamp: new Date(d.createdAt)
  };
}

/**
 * Restituisce gli header HTTP con il JWT allegato.
 * Tutte le route protette devono includere questi header.
 * @returns {Record<string, string>}
 */
function getAuthHeaders() {
  const token = localStorage.getItem('vinoPassportToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const API = {
  async getWines() {
    const res = await fetch('/api/wines');
    if (!res.ok) throw new Error('Network error');
    return res.json();
  },

  /**
   * Registra o autentica un utente (passwordless).
   * Restituisce { token, user } — il chiamante deve salvare il token.
   * @param {string} nome
   * @param {string} email
   * @returns {Promise<{ token: string, user: { id: string, nome: string, email: string } }>}
   */
  async login(nome, email) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err.error || 'Login fallito'), { data: err });
    }
    return res.json();
  },

  async updateUser(id, nome, email) {
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ nome, email })
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error('Update failed'), { data });
    return data;
  },

  /**
   * Recupera gli assaggi dell'utente autenticato.
   * Il userId è dedotto dal token JWT lato server — non è più un parametro.
   */
  async getTastings() {
    const res = await fetch('/api/tastings', {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Sync fallito');
    const data = await res.json();
    return data.map(mapTasting);
  },

  async saveTasting(payload) {
    console.log('[API.saveTasting] payload →', JSON.stringify(payload));
    const res = await fetch('/api/tastings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.error('[API.saveTasting] 400 error body →', errBody);
      throw new Error(errBody.error || 'Errore salvataggio');
    }
    return res.json();
  },

  async getDNA(payload) {
    const res = await fetch('/api/dna', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data.dnaText;
  },

  async getLeaderboard() {
    const res = await fetch('/api/leaderboard', {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Errore caricamento classifica');
    return res.json();
  }
};
