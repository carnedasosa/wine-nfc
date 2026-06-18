# Knowledge Base - Registro Errori

## Errore 001: Scrittura file fuori dal branch di lavoro
- **Agente Responsabile:** The Engine
- **Descrizione:** Durante l'estrazione di un file in un branch separato, l'agente ha utilizzato un percorso assoluto per salvare il file (`C:\Users\aless\Documents\antigravity\amazing-bohr\app.js`) sporcando il branch principale.
- **Soluzione:** Quando si lavora in un workspace 'branch', usare path relativi (`./app.js`) o assicurarsi che il path assoluto punti alla cartella del proprio worktree, non al branch master.

## Errore 002: SyntaxError su template literals in estrazione
- **Agente Responsabile:** The Engine
- **Descrizione:** Durante la copia/estrazione di codice JavaScript, i template literals sono stati erroneamente modificati sfuggendo i backtick con backslash (es: `\`Basato su \${...}\``), invalidando la sintassi.
- **Soluzione:** Durante il copia-incolla o il refactoring, mantenere intatti i backtick (`) originali. Se si usano tool automatici di sostituzione/creazione stringa, fare attenzione a non aggiungere escaping doppi dove non richiesto. Eseguire sempre un rapido `node -c app.js` dopo la generazione.

## Errore 003: The Engine tenta di scrivere nel worktree del parent (ripetizione KB-001)
- **Agente Responsabile:** The Engine
- **Descrizione:** Durante il Task 1.2 (NFC URL Routing), The Engine in workspace `branch` ha tentato di scrivere `app.js` usando il path assoluto del worktree parent (`C:\Users\aless\.gemini\...\worktrees\subagent-...\app.js` puntando alla directory del parent). Il sistema di sandboxing ha bloccato la scrittura con errore "files must be written to the correct artifact directory".
- **Soluzione:** Quando si lavora in un workspace `branch`, il sub-agente DEVE: (1) eseguire `Get-Location` per verificare il proprio working directory, (2) usare path relativi (`./app.js`) oppure il path assoluto del proprio worktree (verificabile dal campo `workspaceUris` nella risposta di `invoke_subagent`). MAI usare path che puntano al worktree di un altro agente.
