# Analisi Tecnica: Progetto Vino Passport

Questo documento fornisce una mappa chiara e dettagliata dell'architettura e della base di codice del progetto "Vino Passport". È pensato per permettere a un assistente AI o a un nuovo sviluppatore di navigare il progetto in modo mirato, riducendo la necessità di scansionare l'intero repository.

## 1. Overview del progetto
- **Cosa fa**: "Vino Passport" è una web app (Progressive Web App) pensata per eventi e fiere del vino. Permette agli utenti di registrare le proprie degustazioni tramite tap NFC (o simulazione) sulle bottiglie, valutare parametri sensoriali (acidità, corpo, persistenza, emozione) e ottenere un "Wine DNA", ovvero un profilo enologico testuale generato tramite intelligenza artificiale.
- **Target utente**: Partecipanti a fiere vinicole (B2C).
- **Stato attuale**: Prototipo avanzato / MVP (Minimum Viable Product).

## 2. Stack tecnologico
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (Nessun framework UI).
- **Backend**: Serverless functions Node.js (stile Vercel).
- **Database**: PostgreSQL (tramite Supabase) con ORM **Prisma** (`@prisma/client` v6.19.3).
- **Servizi Esterni**: Anthropic API (per la generazione del profilo Wine DNA).
- **Build tool / Deployment**: Express (usato unicamente per il server di sviluppo locale), Vitest per i test. Il deployment target previsto è Vercel (evidenziato dallo script `vercel-build` e dalla struttura della cartella `api/`).

## 3. Mappa della struttura (con percorsi esatti)
- `C:/Users/aless/Documents/antigravity/amazing-bohr/`
  - `index.html`: Entry point dell'applicazione frontend, contiene la struttura UI di tutte le schermate.
  - `app.js`: Motore logico del frontend, gestisce stato, DOM e chiamate API.
  - `style.css`: Design system, stili, variabili e animazioni.
  - `dev-server.js`: Server Express locale per simulare l'ambiente serverless in fase di sviluppo.
  - `package.json`: Dipendenze e script di progetto.
  - `manifest.json` / `service-worker.js`: Configurazione PWA per l'installazione e il caching offline.
  - `api/` (Logica di business / Endpoint backend)
    - `api/users.js`: Gestione registrazione e aggiornamento utenti.
    - `api/tastings.js`: Salvataggio e recupero delle degustazioni.
    - `api/wines.js`: Recupero del catalogo vini.
    - `api/dna.js`: Integrazione AI (Anthropic) per generare il "Wine DNA".
  - `prisma/` (Database e tipi)
    - `prisma/schema.prisma`: Definizione dei modelli dati Prisma.
    - `prisma/seed.js`: Script per il popolamento iniziale del database.
  - `lib/` (Configurazione)
    - `lib/prisma.js`: Inizializzazione del client Prisma condiviso.
  - `utils/` (Utility)
    - `utils/validation.js`: Funzioni helper di validazione.

## 4. Architettura e flusso dati
- **Comunicazione Layer**: Il frontend comunica con il backend tramite chiamate `fetch` RESTful asincrone da `C:/Users/aless/Documents/antigravity/amazing-bohr/app.js` verso gli endpoint in `C:/Users/aless/Documents/antigravity/amazing-bohr/api/`. Il backend interroga il DB tramite il client in `C:/Users/aless/Documents/antigravity/amazing-bohr/lib/prisma.js`.
- **Pattern Architetturale**: Monolite frontend (SPA in Vanilla JS) accoppiato a un backend basato su funzioni serverless indipendenti.
- **Gestione dello stato**: Lo stato risiede in un oggetto globale `let state` in `app.js` (riga 9) e viene persistito nel `localStorage` del browser tramite la funzione `saveState()` per mantenere la sessione tra i ricaricamenti.
- **Autenticazione**: Molto basilare. L'utente inserisce nome ed email; il backend (`api/users.js`) effettua un upsert e restituisce un `userId` UUID. Questo ID viene salvato in `localStorage` (`app.js`) e passato in chiaro come parametro (es. query string o body) nelle richieste successive (`api/tastings.js`).

## 5. File chiave da conoscere
1. **`C:/Users/aless/Documents/antigravity/amazing-bohr/app.js`**
   - **Responsabilità**: Cuore del frontend; gestisce lo stato, la navigazione tra le "schermate" (div nascosti), le interazioni utente e le API calls.
   - **Dipendenze**: Manipola direttamente gli ID definiti in `index.html`.
2. **`C:/Users/aless/Documents/antigravity/amazing-bohr/index.html`**
   - **Responsabilità**: Contiene l'intero markup della SPA, diviso per sezioni (onboarding, home, wine detail, dna).
3. **`C:/Users/aless/Documents/antigravity/amazing-bohr/prisma/schema.prisma`**
   - **Responsabilità**: Definisce l'architettura relazionale del database (`User`, `Wine`, `Tasting`).
4. **`C:/Users/aless/Documents/antigravity/amazing-bohr/api/tastings.js`**
   - **Responsabilità**: Gestisce il salvataggio di una nuova degustazione e ne recupera lo storico per un dato utente.
   - **Dipendenze**: `lib/prisma.js`.
5. **`C:/Users/aless/Documents/antigravity/amazing-bohr/api/dna.js`**
   - **Responsabilità**: Crea un prompt basato sui dati dell'utente e interroga le API di Anthropic per generare un testo poetico; include un fallback locale in assenza di API Key.

## 6. Qualità del codice e criticità
- **Punti di forza**: Estrema leggerezza lato frontend, zero overhead da framework, utilizzo di un ORM robusto e type-safe (Prisma) lato backend.
- **Criticità concrete**:
  - **Monolite JS (File troppo grande)**: `C:/Users/aless/Documents/antigravity/amazing-bohr/app.js` supera le 800 righe. Mescola rendering dell'UI, state management logico e chiamate di rete. Questo lo rende fragile ai cambiamenti.
  - **Sicurezza e Autenticazione (Gestione debole)**: Passare l'`userId` in chiaro da frontend a backend in `C:/Users/aless/Documents/antigravity/amazing-bohr/api/tastings.js` espone le API a potenziali abusi (basta conoscere un UUID per scrivere/leggere i dati di un altro utente).
  - **Mancanza di Tipizzazione Frontend**: A differenza del backend con Prisma, il frontend in Vanilla JS non ha contratti o interfacce formali per gli oggetti (es. `state.assaggi`).

## 7. Convenzioni di progetto
- **Naming**: Il progetto mescola italiano e inglese. Nel DB troviamo `Wine` e `Tasting`, ma nel frontend array chiamati `viniDB` o `assaggi`.
- **Pattern Ricorrenti**:
  - Nel backend: Esportazione di una singola funzione asincrona `module.exports = async function(req, res)` (convenzione Vercel/Next.js API).
  - Nel frontend: Modifica diretta del DOM (es. `document.getElementById('screen-home').classList.add('active')`) gestita in funzioni globali (`showScreen`, `showTab`).

## 8. Dipendenze e configurazione
- **Dipendenze principali**:
  - `prisma` / `@prisma/client`: Per l'interazione con il DB PostgreSQL.
  - `express`: Usato unicamente da `dev-server.js` per lo sviluppo locale.
- **Variabili d'ambiente richieste**:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `ANTHROPIC_API_KEY`

## 9. Cosa manca / rischi
- **Sicurezza dell'identità**: Manca una vera sessione cifrata (es. JWT); l'identità si basa esclusivamente sulla persistenza del `userId` in locale. File: `C:/Users/aless/Documents/antigravity/amazing-bohr/app.js` e `C:/Users/aless/Documents/antigravity/amazing-bohr/api/users.js`.
- **Offline robusto**: È presente un service worker (`service-worker.js`), ma il frontend in `app.js` non sembra possedere una coda di sincronizzazione solida per salvare le degustazioni (`POST /api/tastings`) effettuate in completa assenza di rete.
- **Scalabilità del frontend**: L'assenza di un bundler o di un framework renderà complessa l'aggiunta di nuove funzionalità senza far collassare `app.js`.

## 10. Suggerimenti rapidi
1. **Modularizzare app.js**: Dividere `C:/Users/aless/Documents/antigravity/amazing-bohr/app.js` in file logici separati (es. `api.js`, `state.js`, `ui.js`) e importarli come ES Modules (`<script type="module">`).
2. **Aggiungere un token di sessione (JWT)**: Aggiornare `C:/Users/aless/Documents/antigravity/amazing-bohr/api/users.js` per restituire un JWT firmato, e richiederlo come Bearer token in `C:/Users/aless/Documents/antigravity/amazing-bohr/api/tastings.js`.
3. **Implementare Sync Offline**: Implementare IndexedDB o una coda robusta nel `localStorage` dentro `C:/Users/aless/Documents/antigravity/amazing-bohr/app.js` per accodare le valutazioni NFC fatte offline e inviarle quando torna la connessione.
