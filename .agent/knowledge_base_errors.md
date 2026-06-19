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

## Errore 004: Errore Prisma 7 su Datasource URL nello schema
- **Agente Responsabile:** The Engine
- **Descrizione:** Durante l'inizializzazione e validazione di Prisma, `npx prisma generate` ha restituito l'errore P1012 "The datasource property `url` is no longer supported in schema files" a causa di una breaking change in Prisma 7.
- **Soluzione:** Per continuare ad usare il campo `url = env("DATABASE_URL")` all'interno dello `schema.prisma`, installare esplicitamente Prisma 6.x eseguendo `npm install prisma@^6.0.0 @prisma/client@^6.0.0 --save-dev` e procedere con le configurazioni. In caso contrario, migrare la configurazione al nuovo file `prisma.config.ts`.

## Errore 005: Bypass errato nel Service Worker fetch event
- **Agente Responsabile:** The Architect / The Engine
- **Descrizione:** Durante la pianificazione del Service Worker, è stato prescritto di bypassare le chiamate API usando `if (event.request.url.includes('/api/')) { return fetch(event.request); }`. Ritornare una promise direttamente dal listener senza usare `event.respondWith()` causa il fallimento delle richieste POST e chiamate doppie per le GET, poiché il fetch consuma lo stream e il browser esegue il fallback separatamente.
- **Soluzione:** Quando si intercettano eventi `fetch` in un Service Worker per ignorarli e delegarli al browser, usare semplicemente `return;` all'interno della condizione, oppure avvolgere il fetch in `event.respondWith(fetch(event.request));`.

## Errore 006: Express 5 e middleware statici (404 su route API)
- **Agente Responsabile:** The Engine
- **Descrizione:** Dopo l'aggiornamento a Express 5, l'endpoint API `/api/wines` restituiva `404 Not Found`. Il middleware `app.use(express.static('.'))` registrato *prima* delle route API intercettava la chiamata. Essendo presente fisicamente la cartella `api/` nel filesystem, restituiva 404 senza passare al middleware successivo.
- **Soluzione:** Registrare sempre le route API (`app.all('/api/...', ...)`) **prima** del middleware `express.static`. L'ordine di dichiarazione è cruciale per evitare intercettazioni non volute da parte del file server statico.
