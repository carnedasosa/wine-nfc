# Knowledge Base — Template Errori

Usa questo template per loggare ogni nuovo errore nel file `.agent/knowledge_base_errors.md`.
Copia il blocco qui sotto e compilalo con i dettagli dell'errore.

---

## Nuovo Errore da Loggare

```markdown
## [ANNO-MESE-GIORNO] — [Titolo breve dell'errore]

**Agente responsabile:** [The Artist / The Engine / The Weaver / The Conductor]
**Identificato da:** [The Critic / The Weaver / The Conductor / Utente]
**Categoria:** [Frontend / Backend / Database / Sicurezza / Integrazione / Performance / Altro]

### Contesto
Descrivi brevemente il task che si stava eseguendo quando l'errore si è manifestato.

### Errore
Descrivi la natura tecnica del problema. Includi file e riga se disponibili.
- **File:** `path/al/file.ts`
- **Riga:** 42
- **Messaggio di errore (se presente):**
  ```
  Incolla qui l'errore o il log
  ```

### Soluzione
Come è stato risolto il problema? Descrivi la soluzione implementata in modo che un agente futuro possa capirla e replicarla.

### Regola di Prevenzione
> ⚠️ **REGOLA:** [Scrivi qui una regola chiara e concisa in forma imperativa]
> Esempio: "Non usare `any` come tipo TypeScript. Definisci sempre un'interfaccia esplicita."

---
```
