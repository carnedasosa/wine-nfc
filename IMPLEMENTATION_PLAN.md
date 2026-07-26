# Vino Passport — Piano di implementazione per sicurezza e production readiness

> Stato: **proposta eseguibile**
>
> Data: **23 luglio 2026**
>
> Obiettivo: rendere l'applicazione idonea a un evento pubblico con circa **1.000 partecipanti**, inclusi picchi concentrati, rete intermittente e gestione sicura dei dati personali.

## 1. Executive summary

Il progetto è oggi un MVP funzionante, ma non è ancora idoneo a un rilascio pubblico. I blocchi principali sono:

- credenziale PostgreSQL attiva presente nella cronologia Git e servita dal server locale;
- login basato sulla sola conoscenza dell'email;
- stored XSS nel Wine DNA;
- assaggi duplicabili e classifica manipolabile;
- dati Wine DNA calcolati dal client invece che dal server;
- modello Anthropic ritirato e fallback difettoso;
- assenza di rate limit, migrazioni versionate, osservabilità e test dei flussi critici;
- PWA dichiarata offline-first ma priva di una sincronizzazione offline affidabile;
- lacune di accessibilità, privacy e lifecycle operativo.

Il programma è diviso in sette milestone. Le milestone M0–M3 sono bloccanti anche per un pilot pubblico; M4–M6 sono necessarie per sostenere in modo dimostrabile il carico atteso.

### Baseline verificata dall'audit

| Evidenza | Stato iniziale |
|---|---|
| Credenziale DB storica | coincide con la credenziale attiva e funziona |
| Login | JWT emesso conoscendo solamente nome ed email |
| Stored XSS | emozione e output AI raggiungono sink `innerHTML` |
| Database | 7 utenti, 6 vini, 16 assaggi, 3 righe duplicate in eccesso |
| Migrazioni | database non gestito da Prisma Migrate |
| Test | 5 test passati, ma nessun flusso production critico coperto |
| Supply chain npm | 0 advisory note su 188 dipendenze al momento dell'audit |
| AI | modello hard-coded ritirato; fallback difettoso sulle eccezioni |
| Capacity | nessun load test staging esistente |

### Verdetto di rilascio

Fino al completamento dei gate descritti in questo documento:

- demo locale con dati sintetici: **consentita**;
- test controllato interno: **consentito solo dopo M0**;
- pilot con utenti reali: **no-go fino a M3**;
- evento pubblico da circa 1.000 persone: **no-go fino a M6**.

## 2. Principi di implementazione

1. **Revocare prima di ripulire:** una credenziale compromessa deve essere ruotata prima di riscrivere la cronologia Git.
2. **Il server è la fonte di verità:** identità, statistiche, Wine DNA, classifica e autorizzazioni non devono dipendere da valori dichiarati dal client.
3. **Ogni write deve essere idempotente:** retry, doppio tap e perdita della risposta non devono creare righe duplicate.
4. **Fail closed:** in caso di errore di autenticazione o autorizzazione l'accesso deve essere negato; il vecchio login insicuro non è un rollback accettabile.
5. **Migrazioni prima del deploy:** il database deve essere versionato e aggiornabile con rollback o roll-forward documentato.
6. **Privacy by default:** raccogliere e condividere solo i dati necessari, con leaderboard non pubblica per default.
7. **Misurare prima di dichiarare capacità:** 1.000 utenti sono supportati solo dopo un test di carico su staging equivalente alla produzione.
8. **Concorrenza esplicita:** i conflitti tra dispositivi e replay offline devono usare versioni server-side, non timestamp dichiarati dal client.

## 3. Target architetturale

```text
Browser/PWA
  ├─ app shell e catalogo cacheabili
  ├─ sessione verificata
  └─ outbox IndexedDB con idempotency key
          │
          ▼
Vercel Edge / API
  ├─ security headers e CORS esplicito
  ├─ autenticazione Supabase Auth/OIDC
  ├─ validazione schema centralizzata
  ├─ rate limit condiviso
  ├─ request ID, log e metriche
  └─ feature flags
          │
          ├───────────────► Cache condivisa
          │                 ├─ catalogo
          │                 ├─ leaderboard
          │                 └─ Wine DNA
          ▼
Supabase Pooler / PostgreSQL
  ├─ migrazioni Prisma
  ├─ Event
  ├─ vincoli e indici
  └─ backup/PITR verificato
          │
          ▼
Anthropic
  ├─ prompt derivato solo dal DB
  ├─ modello configurabile e supportato
  ├─ timeout, quota e circuit breaker
  └─ output trattato sempre come testo non fidato
```

## 4. Piano per milestone

| Milestone | Obiettivo | Priorità | Stima |
|---|---|---:|---:|
| M0 | Contenimento incidente e segreti | P0 | 0,5–1 giorno |
| M1 | Identità, sessioni, validazione e XSS | P0 | 5–8 giorni |
| M2 | Integrità dati, migrazioni e multi-evento | P0 | 3–5 giorni |
| M3 | Wine DNA sicuro, funzionante e controllabile | P0/P1 | 2–4 giorni |
| M4 | Scalabilità, offline, affidabilità e operazioni | P1 | 5–8 giorni |
| M5 | Test, CI, manutenibilità, accessibilità e privacy | P1 | 6–10 giorni |
| M6 | Staging, load test, canary e go-live | P0 release gate | 3–5 giorni |

Stima complessiva: **25–41 giornate tecniche**, escluse decisioni legali e tempi di approvazione dei provider. Con due sviluppatori e supporto DevOps/security part-time: circa **3–5 settimane di calendario**, più buffer evento.

---

## M0 — Contenimento incidente e segreti

### SEC-001 — Rotazione immediata della credenziale PostgreSQL

**Owner:** DevOps / responsabile Supabase  
**Priorità:** P0 immediata  
**Dipendenze:** nessuna

#### Implementazione

1. Inventariare tutte le copie della credenziale:
   - `.env` locali;
   - Vercel Environment Variables;
   - cronologia Git, branch e tag;
   - log, backup, CI e computer dei collaboratori.
2. Creare credenziali separate:
   - ruolo runtime con privilegi minimi e senza DDL;
   - ruolo migrazioni usato solo nella pipeline di deploy.
3. Distribuire la nuova credenziale in staging e produzione.
4. Eseguire smoke test di:
   - connessione DB;
   - catalogo;
   - login;
   - lettura e scrittura di un assaggio sintetico in staging.
5. Revocare la password compromessa e chiudere le connessioni che la usano.
6. Controllare i log DB a partire dal commit che ha introdotto il file, cercando:
   - connessioni da IP o regioni inattese;
   - DDL;
   - esportazioni o query massive;
   - modifiche anomale a utenti e assaggi.

#### Criteri di accettazione

- la vecchia password viene rifiutata;
- l'applicazione funziona con il nuovo ruolo runtime;
- il ruolo runtime non può creare, alterare o eliminare tabelle;
- nessun valore segreto appare in log, screenshot o ticket;
- l'esito della verifica incidentale è registrato.

#### Rollback

La credenziale compromessa non deve mai essere riattivata. Se il rollout fallisce, generare una terza credenziale e correggere la configurazione.

### SEC-002 — Rimozione del segreto dal repository e dal server locale

**Owner:** Tech lead  
**Priorità:** P0  
**Dipendenze:** SEC-001 completato

#### Implementazione

- eliminare la copia locale `password-supabase.txt`;
- usare `git filter-repo` o BFG per rimuovere il file da tutti i branch e tag;
- coordinare il force-push e richiedere il re-clone ai collaboratori;
- invalidare o archiviare clone e artefatti che conservano la vecchia storia;
- aggiungere secret scanning in CI e, se adottato dal team, pre-commit;
- aggiungere test automatico che impedisca file sensibili nel pacchetto di deploy;
- modificare `dev-server.js` affinché serva esclusivamente una directory `public/`;
- bind predefinito su `127.0.0.1`; esposizione LAN solo tramite flag esplicito;
- utilizzare HTTPS/tunnel controllato per i test NFC da smartphone.

#### Criteri di accettazione

- `GET` e `HEAD /password-supabase.txt` restituiscono `404`;
- `package.json`, `node_modules`, sorgenti backend e schema Prisma non sono serviti staticamente;
- secret scanner senza finding attivi su working tree, branch e tag;
- tutti i collaboratori hanno sostituito il clone precedente.

### SEC-003 — Modalità di contenimento temporanea

Fino alla chiusura di M1 e M3:

- disabilitare `/api/dna` tramite `AI_ENABLED=false`, se l'app è pubblicamente raggiungibile;
- limitare il pilot a dati sintetici;
- non promuovere il login corrente come autenticazione;
- predisporre una modalità read-only o maintenance che non riattivi il vecchio login.

---

## M1 — Identità, sessioni, validazione e XSS

### AUTH-001 — Sostituzione del login con identità verificata

**Owner:** Backend engineer  
**Priorità:** P0  
**Scelta raccomandata:** Supabase Auth con magic link/OTP e sessione same-origin

#### Target

- il possesso dell'email deve essere verificato;
- l'identificatore autorevole deve essere il `sub` immutabile del provider;
- l'email non deve più essere usata come prova di identità;
- il custom JWT attuale deve essere rimosso.

#### Implementazione

1. Aggiungere a `User` un campo `authSubject` univoco.
2. Introdurre callback server-side per il magic link/OTP.
3. Impostare la sessione in cookie:
   - `HttpOnly`;
   - `Secure`;
   - `SameSite=Lax`;
   - durata e rotazione documentate.
4. Verificare server-side firma, issuer, audience, algoritmo e scadenza.
5. Usare il `sub` verificato per recuperare il record applicativo.
6. Gestire il cambio email esclusivamente tramite nuovo flusso verificato.
7. Eliminare gli endpoint legacy duplicati:
   - `api/auth.js`;
   - `api/users.js`;
   - middleware auth duplicato non più necessario.
8. Invalidare tutti i JWT emessi dal vecchio sistema.
9. Aggiungere risposte anti-enumerazione per richiesta e verifica OTP.

Se il team sceglie bearer token invece dei cookie, la decisione deve essere registrata in un ADR con il rischio residuo della memorizzazione accessibile a JavaScript.

#### Migrazione dei sette utenti esistenti

- normalizzare le email in lowercase;
- al primo login verificato, collegare `authSubject` solo se esiste una singola corrispondenza;
- gestire manualmente conflitti o duplicati;
- non collegare mai automaticamente un account sulla sola base di un body HTTP non verificato;
- rimuovere definitivamente il fallback al login legacy dopo il periodo di migrazione.

#### Criteri di accettazione

- conoscere l'email di un'altra persona non permette l'accesso;
- token legacy, falsificato, scaduto, con audience errata o di un altro utente restituisce `401/403`;
- cambio email richiede una nuova verifica;
- tutte le route protette derivano l'utente dall'identità verificata;
- test negativi IDOR presenti per ogni endpoint.

### AUTH-002 — Lifecycle completo della sessione

#### Implementazione

- access token breve e refresh token ruotato;
- logout locale e server-side;
- revoca di tutte le sessioni dell'account;
- gestione frontend centralizzata di `401`;
- nessun loop infinito di refresh;
- cancellazione della cache utente su logout;
- schermata di sessione scaduta con ritorno controllato all'onboarding;
- protezione CSRF per le write se si usano cookie;
- verifica `Origin` sulle richieste mutative;
- nessun token o OTP nei log o negli URL applicativi.

#### Criteri di accettazione

- logout e revoca rendono inutilizzabile la sessione entro l'SLA deciso;
- un refresh token riutilizzato viene rifiutato;
- il frontend recupera correttamente da token scaduto;
- test CSRF e session fixation superati.

### APPSEC-001 — Validazione centralizzata degli input

**Owner:** Backend engineer  
**Priorità:** P0

Adottare schemi condivisi, ad esempio con Zod, per:

- nome e nickname;
- email normalizzata;
- wine ID;
- rating interi da 1 a 5;
- emozione come enum;
- parametri di paginazione;
- event ID;
- body e response delle API.

Limiti iniziali:

- nome/nickname: 1–60 caratteri;
- email: massimo 254 caratteri;
- emozione: solo valori dell'enum prodotto;
- stringhe provenienti dal catalogo: limiti documentati;
- JSON body: limite uniforme e inferiore al limite della piattaforma.

Errori di validazione:

- status `400`;
- struttura stabile `{ code, message, fields }`;
- nessuno stack o dato sensibile;
- stessi contratti in locale e su Vercel.

### APPSEC-002 — Eliminazione dei sink XSS

**Owner:** Frontend engineer  
**Priorità:** P0

#### Implementazione

- sostituire `innerHTML` per dati dinamici con `createElement` e `textContent`;
- trattare come non fidati:
  - emozioni;
  - nome utente;
  - testo LLM;
  - cantina, territorio, nome e descrizione vino;
  - dati futuri di dashboard e condivisione;
- usare DOMPurify solo se diventa indispensabile supportare HTML;
- rimuovere gli handler inline dall'HTML e usare `addEventListener`;
- validare i colori del catalogo con una regex/allowlist, senza CSS arbitrario;
- aggiungere test con payload XSS in ogni campo testuale.

#### Criteri di accettazione

- payload come `<img src=x onerror=...>` viene mostrato come testo o rifiutato;
- nessun dato DB, LLM o client viene passato a `innerHTML`;
- scanner/static check impedisce nuove interpolazioni non sicure;
- test stored XSS cross-account superato.

### APPSEC-003 — Security headers, dipendenze browser e CORS

#### Implementazione

1. Creare configurazione Vercel versionata.
2. Introdurre CSP inizialmente `Report-Only`, poi enforcing:
   - `default-src 'self'`;
   - `object-src 'none'`;
   - `base-uri 'self'`;
   - `frame-ancestors 'none'`;
   - direttive `script-src`, `style-src`, `font-src` e `connect-src` ristrette ai provider necessari.
3. Aggiungere:
   - `X-Content-Type-Options: nosniff`;
   - `Referrer-Policy`;
   - `Permissions-Policy`;
   - HSTS dopo verifica HTTPS completa;
   - COOP/CORP solo dopo test di compatibilità.
4. Installare `html2canvas` da npm e rimuovere il CDN, oppure applicare pinning e SRI.
5. Preferire font self-hosted.
6. Configurare CORS solo per origin, metodi e header esplicitamente richiesti.

#### Criteri di accettazione

- flussi E2E senza violazioni CSP inattese;
- framing impedito;
- origin estranei respinti;
- nessun `unsafe-eval`;
- nessuna dipendenza JavaScript non tracciata nel lockfile.

### ABUSE-001 — Rate limit e quote condivise

**Owner:** Backend/Platform engineer  
**Priorità:** P0/P1

Usare uno storage condiviso tra istanze serverless, non una mappa in memoria.

Valori iniziali da validare:

| Endpoint | Limite iniziale |
|---|---:|
| richiesta OTP | 3/email e 5/IP ogni 15 minuti |
| verifica OTP | 10/IP ogni 15 minuti |
| salvataggio assaggio | 30/utente/minuto |
| Wine DNA | 3/utente ogni 10 minuti |
| leaderboard | 60/IP/minuto, oltre alla cache |

Poiché una fiera può avere molti dispositivi dietro lo stesso IP, il limite IP deve essere una protezione anti-abuso, non il limite primario per utenti autenticati.

#### Criteri di accettazione

- rate limit efficace su istanze serverless differenti;
- risposta `429` con `Retry-After`;
- metriche e alert su blocchi e bypass;
- nessuna fiducia in `X-Forwarded-For` fuori dalla catena proxy documentata.

---

## M2 — Integrità dati, migrazioni e multi-evento

### DATA-001 — Baseline di Prisma Migrate

**Owner:** Database engineer / backend engineer  
**Priorità:** P0

Il database attuale non è gestito da Prisma Migrate.

#### Implementazione

1. Eseguire backup e provare il restore prima di modificare dati.
2. Introspezionare lo schema reale e confrontarlo con `schema.prisma`.
3. Creare una baseline Prisma Migrate.
4. Aggiungere in CI:
   - `prisma validate`;
   - verifica drift;
   - applicazione migrazioni su DB temporaneo.
5. In produzione usare `prisma migrate deploy`, mai `db push`.
6. Eseguire le migrazioni una sola volta in un job pre-deploy tramite `DIRECT_URL`, mai allo startup delle function.
7. Documentare rollback/roll-forward per ogni migrazione.

#### Criteri di accettazione

- `prisma migrate status` indica database gestito e allineato;
- staging nasce da zero applicando le migrazioni;
- deploy fallisce se è presente drift non approvato;
- restore testato prima della migrazione distruttiva.

### DATA-002 — Modello Event

#### Nuovo modello logico

- `Event`: nome, slug, inizio/fine, timezone, stato;
- `EventWine`: evento, vino, stato attivo e ordine; chiave composta evento–vino;
- `EventParticipant`: evento, utente, nickname e consenso leaderboard; chiave composta evento–utente;
- relazione Event–Tasting;
- leaderboard e catalogo sempre filtrati per evento;
- URL NFC con identificatore evento e vino non ambiguo;
- retention e archiviazione per evento.

#### Criteri di accettazione

- catalogo e classifica di due eventi non si mescolano;
- un tag NFC identifica un vino nell'evento corretto;
- tutte le query applicative richiedono un event ID valido;
- il server verifica che l'evento sia attivo, l'utente partecipi e il vino appartenga all'evento;
- l'event ID dichiarato dal client non è mai l'unica autorità.

### DATA-003 — Cleanup duplicati, vincolo univoco e upsert

#### Ordine della migrazione

1. Aggiungere `eventId` inizialmente nullable.
2. Creare un evento legacy/default e fare backfill.
3. Esportare o archiviare i duplicati prima di eliminarli.
4. Eseguire uno script di dry-run che mostri solo conteggi e checksum, senza PII.
5. Per ogni coppia evento–utente–vino conservare l'assaggio più recente, ordinando deterministicamente per `createdAt` e ID.
6. Verificare conteggi, checksum e medie prima/dopo.
7. Rendere `eventId` non nullable.
8. Aggiungere `@@unique([eventId, userId, wineId])`.
9. Aggiungere `updatedAt` e `version`.
10. Sostituire `tasting.create` con `upsert`.
11. Aggiornare leaderboard e statistiche.
12. Rimuovere il codice legacy solo in una release successiva compatibile.

Per retry offline o perdita della risposta, ogni write deve includere una `idempotencyKey` UUID univoca.

#### Criteri di accettazione

- due richieste concorrenti per lo stesso vino producono una sola riga;
- ripetere una richiesta con la stessa idempotency key restituisce lo stesso risultato;
- classifica e medie non aumentano per retry;
- test concorrente con almeno 100 richieste simultanee superato;
- query di controllo non rileva duplicati.

### DATA-004 — Vincoli, indici e contratti

#### Implementazione

- `@@index([eventId, userId, createdAt])`;
- `@@index([eventId, wineId])`;
- `@@index([eventId, createdAt])`;
- indici verificati con `EXPLAIN ANALYZE`;
- normalizzazione email coerente;
- campi Wine nullable gestiti o resi obbligatori;
- enum per emozione e, se utile, tipo vino;
- policy esplicita `onDelete` per utenti, eventi e vini;
- selezione Prisma dei soli campi necessari;
- paginazione/cursor o delta-sync degli assaggi;
- risposta API versionata.

#### Criteri di accettazione

- nessun crash su campi catalogo mancanti;
- query storico e leaderboard usano gli indici previsti;
- payload dello storico rimane bounded;
- email con differenze di case non crea account duplicati.

---

## M3 — Wine DNA sicuro e funzionante

### AI-001 — Profilo calcolato esclusivamente lato server

**Owner:** Backend engineer  
**Priorità:** P0

Il client deve inviare al massimo `eventId` e la richiesta di generazione. Il server:

1. identifica l'utente dalla sessione;
2. recupera gli assaggi dal database;
3. calcola medie ed emozioni;
4. seleziona vini e territori;
5. costruisce il prompt con dati normalizzati;
6. non invia nome o email se non strettamente necessari.

#### Criteri di accettazione

- cambiare `avgAcidita`, `topEmo` o altri campi nel body non cambia il profilo;
- un utente non può generare il DNA di un altro;
- prompt e output non contengono email o identificatori;
- test di prompt injection produce output conforme o fallback sicuro.

### AI-002 — Modello supportato, timeout e fallback

#### Implementazione

- spostare il modello in `ANTHROPIC_MODEL`;
- configurare un modello attivo e testato; alla data del piano il sostituto raccomandato è `claude-sonnet-4-6`;
- ridurre `max_tokens` a quanto serve per 3–4 frasi;
- timeout rigido di 5–8 secondi con `AbortController`;
- retry solo per `429/5xx`, con jitter e dentro il budget temporale;
- circuit breaker e limite condiviso di concorrenza verso il provider;
- fallback definito fuori dal `try/catch`;
- distinguere:
  - successo AI;
  - fallback per timeout;
  - fallback per quota;
  - modello non disponibile;
  - errore applicativo;
- restituire sempre testo plain text con lunghezza massima;
- feature flag `AI_ENABLED` per modalità fallback-only durante picchi;
- kill switch separati per AI e leaderboard, senza interrompere catalogo o salvataggio.

#### Criteri di accettazione

- modello ritirato o risposta `4xx/5xx` genera alert e fallback;
- errore di rete non produce `ReferenceError`;
- risposta entro 8 secondi;
- il frontend controlla `res.ok` e mostra lo stato fallback senza rompersi.

### AI-003 — Cache, deduplicazione e budget

Creare un profilo/versione deterministica, ad esempio hash di:

- event ID;
- user ID;
- timestamp/versione dell'ultimo assaggio;
- modello e prompt version.

Memorizzare o mettere in cache:

- testo;
- modello;
- prompt version;
- timestamp;
- indicazione fallback;
- consumo token/costo stimato.

#### Criteri di accettazione

- riaprire Wine DNA senza nuovi assaggi non richiama Anthropic;
- due richieste simultanee per la stessa versione vengono coalesciate;
- quota e budget massimo per evento configurabili;
- dashboard con chiamate, errori, token, costo e cache hit rate;
- indisponibilità o saturazione AI non degrada login, catalogo o salvataggio assaggi.

---

## M4 — Scalabilità, offline, affidabilità e operazioni

### SCALE-001 — Pool database e co-location

#### Implementazione

- documentare tier e limiti Supabase/Vercel;
- allineare regione delle funzioni a quella del database;
- partire con pool per istanza basso, ad esempio `connection_limit=1`, poi misurare;
- impostare `pool_timeout`;
- alert al 70% di connessioni e CPU;
- verificare cold start e tempo di attesa del pool.

Condizione operativa:

```text
istanze concorrenti × connessioni per istanza < 60–70% del limite disponibile
```

### SCALE-002 — Cache catalogo e leaderboard

#### Catalogo

- response event-aware;
- `Cache-Control` con `s-maxage` e `stale-while-revalidate`;
- ETag;
- invalidazione su modifica catalogo.

Valore iniziale:

```text
public, s-maxage=300, stale-while-revalidate=86400
```

#### Leaderboard

- separare top 50 pubblica dal flag/rango personale;
- cache condivisa per evento;
- refresh ogni 5–15 secondi o aggiornamento incrementale;
- tie-break deterministico;
- nickname/opt-in invece del nome reale;
- se la cache è indisponibile, snapshot stale o query DB rate-limited senza bloccare le write.

#### Criteri di accettazione

- 1.000 richieste ravvicinate non generano 1.000 query aggregate;
- cache hit rate >90% durante il load test;
- aggiornamento classifica entro l'SLA prodotto;
- nessun dato personale non autorizzato nella risposta cacheabile.

### REL-001 — Recovery applicativa

#### Implementazione

- schermata errore catalogo con retry;
- avvio dal catalogo cache quando offline;
- timeout client per tutte le fetch;
- retry con backoff solo per operazioni idempotenti;
- gestione uniforme `400/401/403/409/429/5xx`;
- loading state visibile e annullabile;
- prevenzione delle richieste concorrenti duplicate;
- ordinamento assaggi coerente tra API e UI.

### OFFLINE-001 — PWA e outbox affidabile

#### Implementazione

- precache di tutti gli asset first-party, inclusi moduli e icone;
- manifest completo con `id`, `scope`, `lang`, icone 192/512, maskable e Apple touch icon;
- strategie esplicite: app shell cache-first, navigazioni network-first con fallback, catalogo stale-while-revalidate;
- nessuna cache service worker per login, token, POST o risposte personali;
- strategia di aggiornamento service worker testata, con prompt “aggiornamento disponibile”;
- nessun reload forzato mentre esistono modifiche o assaggi pending;
- IndexedDB per catalogo, stato e outbox;
- ogni assaggio offline include idempotency key;
- ogni update include `baseVersion` o `If-Match`;
- stati outbox: `pending`, `syncing`, `synced`, `failed`;
- replay su ritorno online con backoff;
- Background Sync dove supportato e fallback su evento `online`;
- indicatore offline e stato di sincronizzazione;
- risposta `409` per update basato su una versione obsoleta;
- conflitto mostrato e risolto esplicitamente, senza usare timestamp del client;
- logout impedito o confermato quando esistono write non sincronizzate;
- cache e outbox isolate per identità ed evento.

#### Criteri di accettazione

- app avviabile e catalogo leggibile in airplane mode dopo la prima visita;
- assaggio offline sincronizzato una volta sola al ritorno online;
- chiusura del browser durante il sync non perde la write;
- dati o coda di un utente non sono visibili dopo il login di un altro;
- aggiornamento service worker non blocca utenti su asset incompatibili;
- flusso NFC/offline verificato su almeno un dispositivo fisico Android e uno iOS.

### OPS-001 — Osservabilità

#### Log

- JSON strutturato;
- request/correlation ID;
- user ID pseudonimizzato;
- redazione di email, token, OTP, chiavi e prompt;
- livelli e retention documentati.

#### Metriche

- richieste per endpoint;
- p50/p95/p99;
- `400/401/403/409/429/5xx`;
- cold start;
- pool wait e connessioni;
- query lente;
- duplicate/conflict rate;
- outbox pending/failed;
- chiamate, latenza, errori, token e costo AI;
- cache hit rate.

#### Alert iniziali

- error rate >1% per 5 minuti;
- p95 API non-AI >500 ms per 10 minuti;
- connessioni o CPU DB >70%;
- fallback AI >20%;
- qualunque duplicato dopo M2;
- outbox failed oltre la soglia concordata.

### DR-001 — Backup e disaster recovery

#### Implementazione

- verificare PITR e retention del piano Supabase;
- snapshot pre-evento e pre-migrazione;
- restore drill su ambiente isolato;
- RPO target: massimo 5–15 minuti, da confermare in base al piano Supabase;
- RTO target: 30–60 minuti durante l'evento;
- runbook per:
  - database down;
  - pool saturo;
  - deploy difettoso;
  - Anthropic down/429;
  - perdita rete durante evento;
  - compromissione credenziale.

---

## M5 — Test, CI, manutenibilità, accessibilità e privacy

### TEST-001 — Piramide dei test

#### Unit test

- validatori realmente importati dalle route;
- calcoli Wine DNA;
- fallback AI;
- mapping e versionamento stato;
- idempotency key;
- normalizzazione email.

#### Integration test

- magic link/OTP tramite harness di test;
- token invalidi, scaduti e con audience errata;
- proprietà risorse/IDOR;
- assaggio concorrente e upsert;
- migrazioni su DB temporaneo;
- Anthropic mock: success, timeout, `429`, `500`, JSON invalido;
- rate limit su storage condiviso;
- export e cancellazione dati.

#### E2E

- onboarding verificato → NFC → assaggio → Wine DNA → leaderboard;
- sessione scaduta e logout;
- XSS payload;
- offline → save → ritorno online;
- aggiornamento service worker;
- accessibilità automatica;
- errore catalogo e retry.

#### Soglie

- servizi critici backend: almeno 90% branch coverage;
- globale iniziale: almeno 75%, target 85%;
- nessun P0/P1 può essere escluso dai test senza risk acceptance.

### CI-001 — Pipeline obbligatoria

Su ogni pull request:

1. `npm ci`;
2. Node version coerente con `engines`;
3. lint e format check;
4. typecheck;
5. `prisma validate`;
6. migrazioni su DB temporaneo;
7. unit e integration test;
8. build;
9. `npm audit` con gate su high/critical;
10. secret scanning;
11. SAST;
12. E2E smoke.

La pipeline deve usare PostgreSQL usa-e-getta e fixture sintetiche: nessun test può scrivere nel database reale. Branch protection deve bloccare il merge se un job richiesto fallisce e pubblicare coverage ed evidenze E2E come artefatti.

Su main/staging:

- deploy preview;
- smoke test;
- test header/CSP;
- migrazione con approvazione;
- deploy progressivo.

### MAINT-001 — Consolidamento del codice

#### Implementazione

- un solo modulo auth;
- un solo handler per ogni endpoint;
- validatori condivisi e testati;
- wrapper comune per metodo, errori e request ID;
- separazione `handler HTTP → schema → service/use case → repository Prisma`;
- rimozione di file legacy e test manuali obsoleti;
- eliminazione di import e stato inutilizzati;
- store frontend modificabile solo tramite action esplicite e selector testabili;
- versione/migrazione controllata dello stato locale;
- error envelope stabile `{ code, message, fieldErrors, requestId }`;
- rimozione di decisioni client basate su `message.includes(...)`;
- nessun log production di email, token, prompt o payload di degustazione;
- `dotenv` come dipendenza dichiarata oppure rimozione del require;
- `engines.node` e metadata package corretti;
- primo gate con JSDoc e `checkJs`, seguito da TypeScript `strict` in ordine: contratti, service, handler, store e UI;
- schemi runtime come sorgente dei tipi condivisi;
- Vite come build tool leggero, senza obbligo di riscrittura React/Vue;
- `html2canvas` gestito dal lockfile;
- asset fingerprinted e manifest generato;
- comando unico `npm run verify` per riprodurre localmente i gate CI;
- ambiente PostgreSQL isolato per sviluppo/test tramite Supabase CLI o Docker Compose.

### A11Y-001 — WCAG 2.2 AA

#### Implementazione

- sostituire `<div>` cliccabili con `<button>` o link semantici;
- rendere l'onboarding un vero `<form>`;
- label accessibili per gli slider;
- `aria-live` per toast ed errori;
- dialog con focus iniziale, focus trap, Escape e ripristino focus;
- schermate SPA inattive marcate `hidden`/`inert`;
- focus e titolo aggiornati a ogni cambio schermata, con `popstate` prevedibile;
- target touch almeno 44×44 px;
- contrasto AA;
- `prefers-reduced-motion`;
- SVG decorativi `aria-hidden`;
- stato attivo non espresso solo tramite colore;
- test tastiera, screen reader e axe.

#### Criteri di accettazione

- nessun finding axe serious/critical;
- flusso completo utilizzabile solo da tastiera;
- zoom 200% senza perdita di contenuto;
- test manuali documentati con NVDA/desktop, VoiceOver/iOS e TalkBack/Android.

### PRIV-001 — Privacy e GDPR

**Owner:** Product owner + referente privacy/legale  
**Gate:** prima del go-live con dati reali

#### Implementazione

- mappa dati browser–Vercel–Supabase–Anthropic;
- finalità e base giuridica per ogni dato;
- retention esplicita per DB, log, backup e output AI;
- DPA/SCC e ruoli controller/processor verificati;
- informativa disponibile prima della raccolta;
- nickname e opt-in per leaderboard;
- nessun nome/email inviato al modello se non necessario;
- export, rettifica e cancellazione end-to-end;
- procedura data breach;
- cookie banner solo per cookie non essenziali eventualmente introdotti.

La durata concreta della retention deve essere una decisione formale di prodotto/privacy, non un valore implicito nel codice.

#### Criteri di accettazione

- richiesta export/cancellazione provata end-to-end;
- utente non iscritto alla leaderboard non compare;
- nessun dato personale nei prompt o log senza necessità documentata;
- policy e responsabilità approvate.

### UX-001 — Correzioni prodotto e documentazione

- implementare realmente `requestContact()` oppure rimuovere il messaggio di invio;
- rendere evento, data e luogo configurabili;
- aggiornare README con auth, ambienti, migrazioni e deploy;
- aggiungere e validare in CI una specifica OpenAPI 3.1 con auth, idempotenza, rate limit ed errori;
- documentare setup di un database locale/test isolato e riproducibile;
- sostituire o marcare come storici `TECHNICAL_ANALYSIS.md` e `REVIEW_REPORT.md`;
- correggere caratteri di controllo e code fence in `NFC_TESTING_GUIDE.md`;
- aggiungere runbook, ADR e changelog;
- documentare limiti e degrado fallback del Wine DNA;
- normalizzare `.gitignore`, attualmente contenente una porzione con encoding anomalo, e verificare i file inclusi negli artefatti.

---

## M6 — Staging, load test e go-live

### PERF-001 — Ambiente staging equivalente

Staging deve avere:

- stessa regione della produzione;
- stesso modello serverless;
- stesso tier o limiti equivalenti del pool DB;
- cache e rate limiter reali;
- dataset sintetico;
- provider AI inizialmente stub, poi test limitato reale;
- metriche e alert già attivi.

### PERF-002 — Piano di carico

| Test | Profilo |
|---|---|
| Smoke | 1–5 virtual users |
| Ramp | 0→250→500→1.000 in 10 minuti |
| Spike ingresso | 0→1.000 in 30 secondi, hold 2 minuti |
| Headroom | 1.500 utenti virtuali per validare il margine |
| Save wave | 1.000 write in 10–30 secondi |
| Leaderboard | 1.000 aperture in 30 secondi, ripetute |
| Soak | 200–300 utenti attivi per 2–4 ore |
| Fault injection | DB lento/down, pool saturo, AI 429/500/timeout, risposta persa dopo write |

Dataset:

- baseline: 1.000 utenti / 6.000 assaggi;
- crescita: 10.000 utenti / 100.000 assaggi;
- almeno due eventi per verificare isolamento.

### SLO e criteri go/no-go

| Metrica | Soglia |
|---|---:|
| API non-AI p95 | <300 ms |
| API non-AI p99 | <800 ms |
| Write p95 | <500 ms |
| Error rate complessivo | <0,5% |
| `5xx` core | <0,1% |
| Connessioni e CPU DB | <70% |
| Duplicati o write perse | 0 |
| Wine DNA | risposta o fallback entro 8 s |
| Cache hit catalogo/leaderboard | >90% |
| Sync outbox dopo ritorno rete | <30 s p95 |

Condizioni di no-go:

- qualunque P0 aperto;
- vecchia credenziale ancora valida;
- possibilità di account takeover o stored XSS;
- duplicati o perdita dati;
- restore non provato;
- alert e runbook mancanti;
- p95/p99 o error rate oltre soglia;
- saturazione DB senza margine almeno 30%;
- assenza di un responsabile operativo durante l'evento.

Ramp, spike e save wave devono rispettare i gate per **tre esecuzioni consecutive** con la stessa configurazione versionata; script e risultati diventano artefatti di release.

### DEPLOY-001 — Canary e rollback

1. Deploy su staging.
2. Migrazione database additiva.
3. Smoke test automatizzato.
4. Canary limitato.
5. Monitoraggio di errori, auth, DB e AI.
6. Estensione graduale.
7. Rollback applicativo o roll-forward DB secondo runbook.

Le migrazioni devono usare il pattern expand/migrate/contract: nessun deploy deve richiedere contemporaneamente una modifica distruttiva incompatibile con la versione precedente.

---

## 5. Gate di approvazione

### Gate G0 — Incidente contenuto

- [ ] password DB ruotata e vecchia password rifiutata;
- [ ] ruolo runtime least-privilege;
- [ ] file e storia Git ripuliti;
- [ ] server locale non espone repository o segreti;
- [ ] verifica log completata.

### Gate G1 — Sicurezza applicativa

- [x] autenticazione verificata;
- [x] sessioni legacy invalidate;
- [x] XSS chiuse;
- [x] input validation centralizzata;
- [x] rate limit condiviso;
- [x] CSP e security headers;
- [x] security regression test verdi.

### Gate G2 — Integrità dati

- [x] Prisma Migrate operativo;
- [x] Event modellato;
- [x] duplicati ripuliti;
- [x] vincolo univoco e upsert;
- [x] idempotenza verificata;
- [x] backup/restore provato.

### Gate G3 — Funzioni core

- [x] Wine DNA server-derived;
- [x] modello attivo;
- [x] timeout/fallback/cache;
- [x] session recovery;
- [x] error states e retry.

### Gate G4 — Qualità e compliance

- [ ] CI obbligatoria;
- [ ] coverage minimo raggiunto;
- [ ] E2E core verde;
- [ ] WCAG 2.2 AA verificata;
- [ ] privacy/retention/leaderboard approvate;
- [ ] documentazione aggiornata.

### Gate G5 — Capacity

- [ ] ramp, spike, save wave e soak superati;
- [ ] SLO rispettati;
- [ ] margine DB ≥30%;
- [ ] osservabilità e alert verificati;
- [ ] fault injection recuperata senza perdita dati.

### Gate G6 — Go-live

- [ ] canary riuscito;
- [ ] runbook accessibili;
- [ ] reperibilità assegnata;
- [ ] feature flag AI/fallback testata;
- [ ] checklist evento firmata dal responsabile.

## 6. Matrice responsabilità proposta

| Ambito | Accountable | Responsible |
|---|---|---|
| Incidente e credenziali | Product/technical owner | DevOps |
| Auth e API security | Tech lead | Backend engineer |
| Database e migrazioni | Tech lead | Backend/DB engineer |
| Frontend, PWA e accessibilità | Product owner | Frontend engineer |
| AI e budget | Product owner | Backend engineer |
| Privacy | Product owner | Referente legale/privacy |
| CI, deploy e osservabilità | Tech lead | Platform/DevOps |
| Test e go-live | Product owner | QA + team tecnico |

Ogni ticket deve avere owner nominale, data, stato, pull request, prova di accettazione e link al runbook pertinente.

## 7. Definition of Done per ticket

Un ticket è completato solo quando:

- codice e configurazione sono versionati;
- test unitari/integration/E2E pertinenti sono presenti;
- metriche e log sono aggiornati;
- documentazione e runbook sono aggiornati;
- migrazione e rollback/roll-forward sono provati;
- criteri di accettazione sono verificati su staging;
- security/privacy review è svolta quando applicabile;
- non introduce nuovi warning high/critical;
- la prova dell'esito è allegata alla pull request.

## 8. Decisioni da chiudere nella prima giornata

| ADR | Decisione | Raccomandazione |
|---|---|---|
| ADR-001 | Provider e trasporto sessione | Supabase Auth + cookie HttpOnly same-origin |
| ADR-002 | Storage rate limit/cache | servizio Redis/KV condiviso e regionale |
| ADR-003 | Modello evento | Event obbligatorio prima della unique tasting |
| ADR-004 | Politica duplicati | conserva il record più recente, archivia prima |
| ADR-005 | Retention dati | decisione Product/Privacy esplicita |
| ADR-006 | Leaderboard | nickname e opt-in |
| ADR-007 | Build/PWA | Vite + asset fingerprinting + manifest generato |
| ADR-008 | Modello AI | configurabile via env, con feature flag e fallback |
| ADR-009 | Envelope di capacità | profilo richieste realistico e collaudo a 1,5× del picco previsto |
| ADR-010 | Conflitti offline | versioning ottimistico con `baseVersion`/`If-Match` e `409` |

## 9. Rischi residui da accettare esplicitamente

- dipendenza da connettività e disponibilità dei provider;
- latenza variabile della rete mobile durante la fiera;
- costi AI sotto picchi inattesi;
- browser senza Background Sync;
- device datati con memoria limitata per la grafica social;
- ritardi nei processi legali/privacy;
- limiti del tier Supabase/Vercel scelto.

Nessuno di questi rischi giustifica l'accettazione di account takeover, credenziali esposte, stored XSS, duplicazione dati o assenza di restore.

## 10. Riferimenti

- Deprecazione modelli Anthropic: <https://platform.claude.com/docs/en/about-claude/model-deprecations>
- Obblighi GDPR per organizzazioni: <https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/obligations_en>
- Baseline Prisma Migrate: <https://pris.ly/d/migrate-baseline>
