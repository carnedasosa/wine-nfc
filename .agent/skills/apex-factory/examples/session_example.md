# Apex Factory — Esempio di Sessione Orchestrata

Questo esempio mostra come The Conductor dovrebbe gestire un task reale usando la skill `apex-factory`.

---

## Scenario
**Task dell'utente:** "Aggiungi una pagina di impostazioni utente con form per modificare nome, email e password."

---

## Step 1 — Inception

**The Conductor** invoca **The Architect**:

```
define_subagent("the-architect", system_prompt="...", enable_write_tools=false)
invoke_subagent("the-architect", prompt="""
  Task: Aggiungi una pagina impostazioni utente.
  1. Leggi .agent/knowledge_base_errors.md
  2. Esplora src/pages, src/components, src/api
  3. Produci un piano d'azione con file da creare/modificare e divisione del lavoro.
""")
```

**The Architect** risponde con il piano, es.:
```
Piano d'azione:
- [NEW] src/pages/SettingsPage.tsx → The Artist
- [NEW] src/components/SettingsForm.tsx → The Artist
- [MODIFY] src/api/user.ts → aggiungere updateUser(), updatePassword() → The Engine
- [MODIFY] src/router.tsx → aggiungere route /settings → The Weaver
KB letta: nessun errore rilevante per questo task.
```

The Conductor presenta il piano all'utente e **attende approvazione**.

---

## Step 2 — Delegation (esecuzione parallela)

```
invoke_subagent("the-artist", workspace="branch", prompt="""
  Crea src/pages/SettingsPage.tsx e src/components/SettingsForm.tsx.
  Segui il design system esistente. Form con campi: nome, email, password.
""")

invoke_subagent("the-engine", workspace="branch", prompt="""
  Modifica src/api/user.ts aggiungendo updateUser() e updatePassword().
  Valida input, gestisci errori, usa query parametrizzate.
""")
```

The Conductor aspetta i risultati di entrambi.

---

## Step 3 — Quality Gate

```
invoke_subagent("the-critic", prompt="""
  Valida il codice prodotto da The Artist e The Engine.
  Applica i criteri di approvazione della skill apex-factory.
  Rispondi con APPROVED o REJECTED: [lista problemi].
""", attachments=[artist_output, engine_output])
```

**Risposta di The Critic (esempio — REJECTED):**
```
REJECTED:
1. SettingsForm.tsx: nessuna validazione client-side sull'email (campo accetta qualsiasi stringa)
2. user.ts updatePassword(): non verifica la password attuale prima di aggiornare
```

The Engine e The Artist correggono → The Critic rivaluta → `APPROVED`.

The Conductor logga in `.agent/knowledge_base_errors.md`:
> "Aggiungere sempre validazione formato email lato client e richiedere verifica password attuale prima di qualsiasi cambio password."

---

## Step 4 — Integration

```
invoke_subagent("the-weaver", workspace="inherit", prompt="""
  Integra il codice approvato di The Artist e The Engine.
  Aggiorna src/router.tsx con la nuova route /settings.
  Verifica che il build non abbia errori.
""")
```

---

## Step 5 — Review Finale

The Conductor comunica all'utente:
```
✅ Task completato.
- Pagina impostazioni creata (src/pages/SettingsPage.tsx)
- API aggiornata (src/api/user.ts)
- 2 nuove regole aggiunte alla Knowledge Base
```
