const { withAuth } = require('../lib/auth');

module.exports = withAuth(async function(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { assaggiCount, avgAcidita, avgCorpo, avgPersistenza, topEmo, viniPreferiti, utenteNome } = req.body;

    // Fallback locale nel caso in cui Anthropic fallisca o manchi la chiave
    const generaDNAFallback = () => {
      let f = `Un profilo equilibrato che mostra una chiara evoluzione. `;
      if (avgAcidita >= 4) f += `La spiccata propensione per l'acidità rivela un palato che cerca freschezza e tensione, tipiche dei grandi vini verticali. `;
      else if (avgAcidita <= 2) f += `La preferenza per acidità contenute suggerisce un amore per le morbidezze e i vini avvolgenti. `;

      if (avgCorpo >= 4) f += `L'attrazione verso strutture imponenti denota una ricerca di calore, potenza e longevità nel calice. `;
      else if (avgCorpo <= 2) f += `La predilezione per corpi snelli indica una ricerca di bevibilità, eleganza e agilità. `;

      if (topEmo && topEmo.length > 0) {
        f += `Le sensazioni ricorrenti di ${topEmo.join(', ')} confermano un approccio emotivo e viscerale alla degustazione.`;
      }
      return f;
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn("Nessuna chiave ANTHROPIC_API_KEY trovata. Uso il fallback locale.");
      return res.status(200).json({ dnaText: generaDNAFallback(), fallback: true });
    }

    const nomeInserito = utenteNome ? ` di ${utenteNome}` : '';
    const prompt = `Sei un sommelier poetico. Analizza questo profilo di degustazione e scrivi un paragrafo breve (3-4 frasi) in italiano, stile letterario, che descrive la personalità enologica di questa persona. Sii specifico, evocativo, usa metafore legate al territorio italiano.

Dati: ${assaggiCount} vini assaggiati${nomeInserito}, acidità media ${avgAcidita}/5, corpo medio ${avgCorpo}/5, persistenza media ${avgPersistenza}/5.
Emozioni prevalenti: ${(topEmo || []).join(', ')}.
Vini preferiti: ${(viniPreferiti || []).join(', ')}.

Rispondi SOLO con il paragrafo, nessun titolo o introduzione.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20240620',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      console.warn("Errore durante la chiamata ad Anthropic API:", response.status, response.statusText);
      return res.status(200).json({ dnaText: generaDNAFallback(), fallback: true });
    }

    const data = await response.json();
    const dnaText = data.content?.[0]?.text || generaDNAFallback();

    return res.status(200).json({ dnaText, fallback: false });
  } catch (error) {
    console.error('Error in /api/dna:', error);
    // Non facciamo crashare l'app per un errore dell'AI, restituiamo il fallback
    return res.status(200).json({ dnaText: generaDNAFallback(), fallback: true });
  }
});
