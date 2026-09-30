# Wine NFC / Vino Passport — report di prontezza per la fiera

> Questo è il report iniziale, prima delle correzioni. Leggi lo [stato aggiornato della release](STATO_RELEASE_SOVRANATURALE.md) e il [runbook](RUNBOOK_RELEASE_FIERA.md) per i risultati successivi.

**Valutazione del 29 settembre 2026 · Evento del 25 ottobre 2026 · Bari**

**Verdetto: NON PRONTO oggi per l’utilizzo con il pubblico.** Il progetto ha una base utilizzabile e diverse protezioni già implementate, ma presenta difetti riproducibili, database incompleto e verifiche operative ancora mancanti. Un deploy di collaudo è il prossimo passo utile; il semplice successo del deploy non costituirebbe un via libera per la fiera.

Restano **26 giorni di calendario**. È plausibile arrivare a una versione essenziale affidabile concentrando il lavoro sui blocchi descritti qui. Non è possibile promettere la scadenza prima di collaudare email, database e flusso completo sull’hosting scelto.

## Il contesto usato per la valutazione

| Dato | Situazione confermata |
|---|---|
| Partecipanti | 1.500–2.000 complessivi |
| Ora di punta | 600 ingressi/ora, circa 10/minuto |
| Ingresso | QR allo stand → nome ed email |
| Bottiglie | Tag ISO 14443-4 già provati dall’organizzatore, apertura della scheda corretta |
| Connettività | Dati mobili; buona copertura prevista nel centro di Bari |
| Responsabile sul posto | Tu, già coinvolto nell’organizzazione dalla prima edizione |
| Indirizzo pubblico | Non ancora disponibile |

I tap contemporanei sulla **singola bottiglia non sono il problema principale**. Il servizio riceve insieme gli accessi all’ingresso, le richieste dalle diverse bottiglie, i salvataggi, la classifica e il DNA. La rete mobile prevista è adeguata come assunzione di progetto: non serve costruire un sistema offline complesso per giustificare questo evento. La coda offline già presente, però, deve essere resa sicura oppure disattivata.

## Quadro decisionale

| Area | Stato | Cosa significa per il 25 ottobre |
|---|---|---|
| Tag NFC | Favorevole, prova riferita da te | Ripetere il percorso completo sui link HTTPS definitivi |
| Pagina iniziale | Funziona in locale | Data dell’evento sbagliata; privacy non presente |
| Registrazione e sessione | Implementate, non collaudate end-to-end | C’è un codice email OTP aggiuntivo; SMTP e quote sono un punto di blocco |
| Evento e catalogo | Non pronti | Evento reale assente; contesto perso; catalogo non filtrato per evento |
| Salvataggio degli assaggi | Non pronto | Unicità presente, ma retry e coda offline possono alterare i dati |
| Classifica | Non pronta per il pubblico | Mostra nomi e assaggi globali senza usare consenso o evento |
| Wine DNA | Non pronto nella configurazione esaminata | Tabella mancante; modello AI predefinito ritirato |
| Contatto cantina | Non implementato | La conferma visualizzata non corrisponde a un invio |
| Sicurezza | Buona base, lavoro incompleto | Rate limit distribuito degradato; revisione dipendenze e confini di pubblicazione necessaria |
| Prestazioni | Capacità non dimostrata | I vecchi load test non certificano il percorso reale |
| Deploy e ripristino | Da completare | Nessun ambiente pubblico verificabile, build locale bloccata, ripristino non provato |
| Gestione in fiera | Responsabile identificato | Mancano strumenti, procedure provate e un sostituto operativo |

**Versione consigliata per il primo evento:** accesso email verificato, schede dei vini reali, passaporto e salvataggi affidabili. DNA descrittivo senza provider AI possibile dopo aver sistemato la relativa funzione. Classifica e contatti cantina possono essere esclusi dalla prima release, purché siano rimossi anche gli endpoint o i comportamenti problematici, non soltanto i pulsanti.

## Come è stata condotta la verifica

Ho esaminato frontend, API, autenticazione, limiti, schema e migrazioni, service worker, test, configurazione Vercel, documentazione e report di carico. Ho eseguito i test esistenti, validazione Prisma, audit delle dipendenze di produzione e tentativo di build. Ho interrogato **in sola lettura** il database indicato dal `.env` locale, senza estrarre nomi o email personali; ho controllato la pagina iniziale nel browser locale già avviato e riprodotto tre difetti con dipendenze simulate.

Riferimento: commit `704faf988638499a7399b447f2495fe5a5d06feb`, **più le modifiche locali già presenti** in `README.md`, `IMPLEMENTATION_PLAN.md` e `lib/auth.js`. Questi file non sono stati modificati dall’audit. Node locale: `v22.13.1`.

**Limiti della verifica:** nessun deploy pubblico, nessun login OTP reale completato, nessun carico nuovo contro servizi reali, nessuna prova fisica aggiuntiva sui telefoni. Il database locale configurato non è automaticamente il futuro database di produzione. La connessione Vercel disponibile non ha restituito team consultabili; piani, impostazioni SMTP, backup e quote del futuro ambiente restano da verificare. Questa è una valutazione tecnica e operativa, non una certificazione di conformità giuridica.

Le prove riproducibili e il riepilogo tecnico sono in `docs/audit-2026-09-29/`. Nessun dato remoto è stato scritto o cancellato e nessuna email è stata inviata.

## Risultati delle prove

| Prova | Risultato osservato | Interpretazione |
|---|---|---|
| `npm test` | 62 passati, 4 falliti, su 66; 8 file verdi e 2 rossi | La release non ha una suite interamente verde |
| Test rate limit | 3 fallimenti | Regressione effettiva rispetto al comportamento di sicurezza atteso |
| Test cache frontend | 1 fallimento | Aspettativa rigida su `v6-m2`, codice ora `v6-m4`: test obsoleto, non prova da solo un guasto della cache |
| `npm run prisma:validate` | Superato | Lo schema è sintatticamente valido; non dimostra che sia applicato al DB |
| `npm run vercel-build` | Fallito: `EPERM` sulla rinomina della DLL Prisma di Windows | Build locale non completata; compatibile con un file in uso, causa non accertata. Non dimostra un errore del futuro build Linux su Vercel |
| `npm audit --omit=dev --json` | 3 pacchetti di gravità alta nella stessa catena, 1 advisory | Richiede analisi e correzione/valutazione documentata; non sono tre vulnerabilità indipendenti |
| Query `DnaProfile` | `P2021`, tabella assente | Il percorso server del DNA non è pronto sul DB esaminato |
| Browser locale | Onboarding visibile, nessun warning/errore nei log catturati | Conferma limitata alla pagina iniziale desktop; non al login o ai telefoni |
| Router, outbox, retry | Tre riproduzioni positive del difetto | Dettagli nei punti B2 e B3 |

### Stato effettivo del database configurato

| Oggetto | Risultato |
|---|---:|
| Utenti | 4.566 |
| Utenti con email riconoscibile come test | 4.565 |
| Vini | 6 |
| Eventi | 2: evento legacy e Load Test Event |
| Associazioni evento–vino | 1 |
| Partecipazioni evento | 0 |
| Assaggi | 782, tutti nell’evento legacy |
| Migrazioni applicate | `0_init`, `m2_models` |
| Migrazione DNA | `m3_dna_profile` presente nel repository, non applicata |

La presenza di sei vini non dimostra che il catalogo della fiera sia completo. Va confrontato con l’elenco approvato dalle cantine. Non risulta configurato l’evento del 25 ottobre.

## Problemi da risolvere prima dell’apertura

**Priorità:** P0 = blocco della versione pubblica; P1 = da chiudere prima dell’evento se la funzione resta attiva; P2 = miglioramento rinviabile. Le verifiche non completate sono esplicitamente distinte dai difetti già osservati.

### B1 — Preparare database ed evento reale · P0 · Verificato

Il codice del DNA interroga `DnaProfile` prima di arrivare al fallback; la tabella manca nel database. Quindi anche disabilitare il provider AI con `AI_ENABLED=false` non risolve questa dipendenza. Il client può mascherare l’errore mostrando un testo generico locale.

Serve un ambiente di produzione separato dai test, con migrazioni applicate e controllate, evento del **25 ottobre 2026**, fuso **Europe/Rome**, orari effettivi concordati, catalogo approvato e associazioni dei vini. Il README descrive ancora soltanto il rollout M1, mentre il codice richiede M2/M3.

La migrazione M2 contiene un `DELETE` dei vecchi assaggi duplicati: va provata su copia e preceduta da backup, non lanciata alla cieca. Il rollback del codice non annulla una modifica o una cancellazione nel database. La scelta più semplice è preparare un database pulito per l’evento, conservando quello di test.

**Criterio di chiusura:** installazione dello schema da zero in staging riuscita; schema applicato identico a quello atteso; evento e vini verificati; zero utenti di carico nella classifica di produzione; backup ripristinabile.

Riferimenti: `prisma/migrations/m2_models/migration.sql`, `prisma/migrations/m3_dna_profile/migration.sql`, `api/dna.js:145`.

### B2 — Conservare l’evento e applicarne le regole · P0 · Verificato e riprodotto

`cleanURL()` elimina sia `vino` sia `eventId`. Alla successiva ricarica, oppure aprendo un altro tag senza evento, l’app usa `legacy-event-id`. La riproduzione passa da un evento esplicito all’evento legacy dopo l’apertura del vino. Il risultato per il visitatore può essere un passaporto apparentemente vuoto o nuovi assaggi registrati nell’evento sbagliato.

Inoltre `/api/wines` restituisce l’intero catalogo. Il salvataggio verifica le relazioni base tramite il DB, ma non controlla che l’evento sia aperto, che il vino appartenga all’evento e sia attivo, né gestisce la partecipazione. Un evento o vino esistente ma non ammesso può quindi essere usato.

Per una sola fiera non serve un pannello multi-evento complesso: basta un evento esplicito e coerente, risolto anche sul server. I link previsti possono essere `https://<dominio>/?eventId=<evento>` per l’ingresso e `https://<dominio>/?eventId=<evento>&vino=<vino>` per le bottiglie. Il dominio deve essere lo stesso, incluso l’eventuale `www`, per mantenere i cookie di sessione.

**Criterio di chiusura:** QR → login → tag A → reload → tag B conserva sempre evento e profilo; evento chiuso, vino inattivo o estraneo sono rifiutati dall’API.

Riferimenti: `src/router.js:53–60`, `src/state.js`, `app.js`, `api/wines.js`, `api/tastings.js:65`.

### B3 — Rendere affidabili salvataggi, retry e coda offline · P0 · Verificato e riprodotto

L’unicità `(evento, utente, vino)` è un buon controllo: evita più righe per lo stesso assaggio. L’`idempotencyKey` però viene semplicemente salvata e sostituita nell’upsert. Ripetere la stessa richiesta incrementa ancora la versione; un retry vecchio dopo un voto nuovo può ripristinare il voto vecchio. Nella prova: acidità **3 → 5 → 3** per effetto del retry precedente.

La coda IndexedDB non memorizza il proprietario dell’assaggio e non viene separata o ripulita al logout. Nella prova isolata un elemento accodato da A è inviato usando la sessione di B. Non è un aggiramento dell’autenticazione server: è il client che attribuisce la vecchia operazione alla sessione corrente.

Altri limiti: `getAll()` restituisce gli elementi in ordine di chiave, non garantisce l’ordine delle modifiche; manca un blocco per flush concorrenti; gli errori definitivi restano nella coda; la UI non rende visibili gli elementi ancora da sincronizzare. `navigator.onLine=true` non garantisce il successo della richiesta, e in quel caso un fallimento non passa automaticamente alla coda. La sincronizzazione non aggiorna poi in modo completo il passaporto già caricato.

**Scelta minima consigliata:** se non c’è tempo per una coda robusta, disabilitare l’offline e mostrare un errore chiaro con possibilità di riprovare mantenendo il voto. Risolvere comunque l’idempotenza server. Se l’offline resta, aggiungere ownership, ordinamento/versione, isolamento tra sessioni, stato pending/errore e controllo della concorrenza.

**Criterio di chiusura:** stessa chiave e stesso contenuto producono un unico effetto; un retry non sovrascrive una modifica più nuova; stessa chiave con contenuto diverso è gestita esplicitamente; cambio account non invia dati al proprietario sbagliato.

Riferimenti: `api/tastings.js:65–89`, `src/outbox.js:30–46`, `src/ui/wine.js`, `src/state.js:clearUserState`; riproduzione in `audit-2026-09-29/reproductions.json`.

### B4 — Collaudare l’accesso per 600 persone/ora · P0 · Configurazione reale non verificata

Il percorso attuale è **nome + email → ricezione codice → inserimento OTP → accesso**. Non basta inserire nome ed email. Il QR all’ingresso aiuta, ma va spiegato chiaramente che è necessario leggere la posta prima del primo assaggio. Il codice prevede anche Magic Link, con comportamento differente: può aprire un altro browser, perdere il contesto iniziale e usare come nome la parte dell’email prima della chiocciola.

Il server SMTP predefinito Supabase è destinato ai test, invia solo a indirizzi autorizzati del team e indica attualmente un limite di 2 messaggi/ora. Anche dopo l’attivazione di SMTP personalizzato esiste una quota Auth da dimensionare. **Non ho verificato quale SMTP sia attivo sul tuo progetto.** Configurarlo e provarlo è obbligatorio per il via libera. [Documentazione Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

Ci sono due ulteriori livelli di limite:

- Il codice applicativo consente per default solo **5 richieste OTP/IP in 15 minuti** e **10 verifiche/IP in 15 minuti**. I dati mobili non assicurano un IP pubblico diverso per ogni persona: va collaudato anche un IP condiviso, mantenendo protezioni per indirizzo email.
- Tutte le chiamate Auth partono dal backend. Senza una gestione verificata dell’IP inoltrato, Supabase può limitare l’IP del server. La documentazione indica per `/verify` un default di **30 richieste ogni 5 minuti**, inferiore ai 50 nuovi ingressi previsti nello stesso intervallo se concentrati su un IP. La funzione prova inoltre fino a tre tipi OTP per un tentativo. L’effettivo raggruppamento delle istanze e i limiti del progetto vanno misurati, non presunti. [Rate limit Supabase](https://supabase.com/docs/guides/auth/rate-limits).

La soluzione non è rimuovere l’autenticazione o mettere chiavi privilegiate nel frontend: occorre dimensionare quote e architettura Auth server-side secondo le impostazioni supportate dal provider. Aggiungere un recupero comprensibile per email errata, codice scaduto, reinvio e attesa imposta dal server.

**Criterio di chiusura:** utenti nuovi e di ritorno accedono con caselle esterne al team; prova Gmail/Outlook e altri domini del campione; refresh e ritorno dopo un’ora funzionano; picco concordato senza blocchi indebiti; richiesta e consegna email misurate separatamente.

Riferimenti: `src/ui/onboarding.js`, `api/auth/request-otp.js`, `lib/rate-limit.js:8–9`, `lib/supabase-auth.js:58,226`, `api/auth/exchange.js`.

### B5 — Ripristinare il limite condiviso in produzione · P0 · Verificato dai test

Se Upstash è assente, mal configurato o irraggiungibile, il codice usa la memoria locale **anche in produzione**. Ogni istanza serverless può quindi avere un contatore diverso. Tre test falliscono proprio perché si aspettano che il controllo di produzione non degradi così. Il README descrive ancora un rifiuto temporaneo delle richieste quando il servizio di limite non è disponibile.

Nel `.env` locale non risultano URL/token Upstash. Questo non dimostra cosa sarà configurato su Vercel, ma rende necessario completare la configurazione di produzione. Scegliere e implementare una politica esplicita: per gli OTP, niente fallback permissivo distribuito; un eventuale comportamento di emergenza per gli assaggi deve essere limitato, monitorato e provato.

**Criterio di chiusura:** contatori condivisi tra istanze, simulazione di indisponibilità riuscita, alert ricevuto e comportamento coerente con test e documentazione.

Riferimenti: `lib/rate-limit.js:192–204`, `tests/rate-limit.test.js`.

### B6 — Informativa, classifica e uso dei dati · P0 · Lacune applicative verificate

La registrazione non contiene un’informativa o un link alla privacy. La classifica è interrogabile anche senza login e restituisce i nomi degli utenti che hanno assaggi, aggregando tutti gli eventi. I campi `nickname` e `consensoLeaderboard` esistono nello schema, ma non sono usati dalla classifica; nel DB non risultano partecipazioni.

Prima della raccolta reale vanno definiti con gli organizzatori: titolare e contatto privacy, finalità e basi giuridiche, destinatari e fornitori, tempi di conservazione, eventuali trasferimenti, gestione di accesso/cancellazione dei dati. Il tuo ruolo di referente tecnico sul posto è già chiaro; non determina automaticamente chi sia il titolare del trattamento. L’informativa deve essere disponibile al momento della raccolta. [Garante: informativa e sua distinzione dal consenso](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/10292539).

Per il primo evento consiglio **classifica disattivata**, oppure limitata all’evento con nickname scelto e partecipazione facoltativa registrata. L’accesso al passaporto deve restare possibile anche senza classifica. Non trattare l’email di login come autorizzazione generica a marketing o comunicazione dei contatti alle cantine; quelle finalità vanno definite separatamente. [Garante: comunicazioni promozionali e comunicazione a terzi](https://www.garanteprivacy.it/home/docweb/-/docweb-display/print/2542348).

I cookie di sessione/CSRF tecnici non implicano automaticamente un banner di consenso: serve l’informativa, e il consenso per ulteriori tracciamenti va valutato sulle funzioni effettive. [FAQ cookie del Garante](https://www.garanteprivacy.it/faq/cookie).

Se si abilita Gemini, il prompt invia anche il nome dell’utente insieme ai dati del profilo. Rimuovere il nome se non necessario e includere questo trattamento nella valutazione dei fornitori. Valutare anche font Google e libreria esterna; ospitare gli asset localmente semplifica disponibilità e inventario dei destinatari.

**Criterio di chiusura:** informativa accessibile, scelte coerenti con UI/API, nessun nome pubblicato contro la scelta dell’utente, procedura di cancellazione provata anche su Auth e dati derivati. Non è indispensabile costruire subito un portale privacy: una procedura manuale funzionante e un contatto possono bastare al processo operativo.

Riferimenti: `index.html:75–112`, `api/leaderboard.js:48–65`, `prisma/schema.prisma:EventParticipant`, `api/dna.js:165`.

### B7 — Eliminare le promesse non implementate · P1 · Verificato

`requestContact()` mostra “Richiesta inviata alla cantina” senza chiamare alcuna API né salvare una richiesta. Il placeholder email promette di “ricevere il tuo Wine DNA”, ma non esiste un invio del DNA via email. La pagina mostra **Bari, 14 giugno 2025**, mentre l’evento è il 25 ottobre 2026; è ancora visibile “Simula tap NFC”.

**Intervento minimo:** nascondere il contatto cantina finché non esiste un flusso completo e verificabile, correggere promessa email e data, rimuovere il comando demo dalla release. Se il contatto è una funzione commerciale essenziale, servono memorizzazione, destinatario, prova di consegna e gestione errori oltre alla disciplina dei dati.

Riferimenti: `src/ui/wine.js:requestContact`, `index.html:92,109,140,220`.

### B8 — Decidere il livello del Wine DNA · P1 se attivo · Verificato

Oltre alla tabella mancante, il modello predefinito è `gemini-1.5-flash`, ritirato il **29 settembre 2025**. Il `.env.example` elenca invece una chiave Anthropic, non quelle Gemini effettivamente lette dal codice. Nel `.env` locale non è configurata la chiave Gemini. [Release notes ufficiali Google](https://ai.google.dev/gemini-api/docs/changelog).

Il fallback server è utile, ma la UI non distingue chiaramente il risultato AI da quello descrittivo. La scrittura della cache non viene attesa prima della risposta: la persistenza non è garantita dal solo codice in un ambiente serverless. Richieste concorrenti possono generare più chiamate AI per lo stesso profilo. Le ultime tre bottiglie sono inoltre denominate “vini preferiti” nel prompt senza una misura della preferenza.

C’è anche un caso di errore frontend: con assaggi solo locali/pending e nessun dato sul server, l’API restituisce `stats: null`, mentre il renderer accede a `result.stats.tags`. La funzione va protetta e va chiarita la differenza tra assaggi salvati e pending.

**Scelta minima:** DNA senza AI esterna, presentato correttamente, con schema e gestione degli stati sistemati. Se resta Gemini: modello attuale verificato, quota e budget, timeout/fallback testati, cache affidabile e riduzione delle generazioni duplicate. Provare condivisione/download anche sui telefoni: l’immagine è generata a 1080×1920 con scala 2, con un carico non trascurabile di memoria.

Riferimenti: `api/dna.js:107,145,179,211`, `src/ui/dna.js:180,204`, `.env.example`.

### B9 — Ottenere un deploy riproducibile e delimitare i file pubblici · P0 · Parzialmente verificato

Non c’è ancora un ambiente pubblico da collaudare. La build locale ha incontrato il blocco DLL descritto sopra; serve una build pulita sull’ambiente target. `vercel-build` esegue solo `prisma generate`: non include test o migrazioni. Non risultano workflow CI nel repository, né una versione Node dichiarata in `package.json`.

`npm start` avvia il server di sviluppo, che serve tutta la root del repository e ascolta su tutte le interfacce. Nel server locale erano leggibili via HTTP `/lib/supabase-auth.js`, `/prisma/schema.prisma` e `/docs/DR_RUNBOOK.md`. **Non ho riscontrato un’esposizione di credenziali e non ho richiesto `.env`.** Questo server non è una configurazione di produzione. L’output statico Vercel va delimitato e controllato separatamente, senza presumere che replichi il comportamento locale.

Configurare dominio HTTPS definitivo, origin esatto, variabili separate per preview/produzione, runtime Node supportato, accesso pubblico del visitatore senza login Vercel, pooling DB, regione coerente e limiti delle funzioni. `APP_ORIGIN` è assente in locale; il codice può derivarlo dalle variabili Vercel, ma per il dominio scelto serve una verifica esplicita. Escludere mock-login dalla release oppure provarne il 404 in produzione.

La base di sicurezza comprende cookie HttpOnly/Secure, controlli Origin/CSRF, identità verificata dal provider, validazione, protezione dei profili, output DOM senza `innerHTML`, CSP e SRI. Vanno mantenuti e verificati sulla risposta pubblica effettiva.

L’audit dipendenze segnala `deepmerge-ts` nella catena `prisma → @prisma/config → deepmerge-ts`: esaurimento dello stack su oggetti ricorsivi. Non ho dimostrato che un input pubblico raggiunga quel percorso, e il pacchetto è principalmente legato alla configurazione/build. Va aggiornato o valutato formalmente; non eseguire automaticamente un downgrade di Prisma suggerito da `audit fix --force`. [Advisory GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).

**Criterio di chiusura:** build pulita e deploy di staging riusciti, suite verde con test pertinenti, asset pubblici controllati, API mock inaccessibili, configurazione produzione verificata e rollback applicativo provato.

### B10 — Dimostrare capacità e recupero operativo · P0 · Evidenze insufficienti

I report di carico esistenti sono del **26 luglio 2026**, su `localhost`, con 1.000 utenti in 30 secondi. I test autenticati usano `mock-login`: non verificano invio email, OTP né il costo delle chiamate al provider Auth. Non sono stati rieseguiti durante questo audit.

| Report storico | Evidenza utile |
|---|---|
| `report.json` | 2.000 risposte 200 su home/catalogo; p95 complessivo 224 ms circa |
| `report-auth.json` | Tutti i 1.000 salvataggi ricevono 403, pur con `vusers.failed=0` |
| `report-auth-2.json`, `report-auth-4.json` | Tutti i 1.000 salvataggi ricevono 400, pur con `vusers.failed=0` |
| `report-auth-3.json` | 213 login con 500; i restanti 787 salvataggi con 400 |
| `report-auth-final.json` | 777 percorsi completati, 223 login con 500: **22,3% degli utenti falliti**; p95 salvataggi circa 4,49 secondi |

Il carico storico è molto più brusco dei 600 ingressi/ora previsti: non dimostra che la fiera fallirà. Dimostra però che non si può usare “1.000 utenti testati” come certificazione di prontezza. I nuovi test devono fallire anche per codici HTTP inattesi e verificare il dato effettivamente salvato.

Il runbook prescrive `MAINTENANCE_MODE=true`, ma il codice non legge questa variabile. Descrive Anthropic, mentre il codice usa Gemini. I log JSON sono un inizio; non risultano nel repository una readiness check, allarmi configurati o una prova di ripristino. L’eventuale presenza di monitor esterni non è stata verificata.

**Criterio di chiusura:** collaudo sullo staging equivalente alla produzione, allarmi ricevuti sul tuo telefono, fallback e manutenzione realmente attivabili, prova di backup/ripristino e rollback completata.

## Capacità da dimensionare per questa fiera

Le quantità seguenti sono **obiettivi di collaudo proposti**, non prestazioni misurate o capienza garantita. Per prudenza assumono che tutti i visitatori usino l’app; il numero di utenti attivi insieme non coincide con gli ingressi nell’ora.

| Voce | Base attesa / ipotesi | Obiettivo proposto |
|---|---|---|
| Nuove registrazioni | 600/ora = 10/minuto | 10/min per 60 min e burst 30/min per 5 min |
| Email | 1 per accesso + reinvii | Quota almeno 1.500/ora e 3.000/giorno per il percorso singolo OTP; aumentare se si aggiungono altri invii |
| Assaggi | Ipotesi 600 utenti attivi, 1 voto/2 min = 5 scritture/s | 10 scritture/s sostenute 30 min; burst 30/s per 5 min, con letture concorrenti |
| Scenario estremo di permanenza | 2.000 attivi, 1 voto/2 min ≈ 16,7 scritture/s | Aggiungere prova sostenuta ≥20/s se la permanenza rende questo scenario plausibile |
| Volume assaggi | Ipotesi 10–20 vini per persona | 15.000–40.000 righe uniche; stimare anche le modifiche successive |
| AI opzionale | 1 generazione finale/utente = fino a 2.000 | Tetto di generazioni e budget globale; ogni nuovo voto può invalidare la cache |

Le quote email sono margini di preparazione, non un invito a inviare migliaia di email di test. La consegna si prova con un campione di indirizzi autorizzati; il carico si misura in staging con account controllati e scenari distinti, includendo il costo reale dell’autenticazione.

**Soglie di accettazione proposte:** nessun voto perso, duplicato o assegnato all’utente/evento sbagliato; nessun blocco 429 per il traffico legittimo concordato; errori server sotto 0,5% e senza cause ripetute irrisolte; p95 API di lettura/salvataggio entro 2 s, p99 entro 5 s; 95% delle email del campione entro 30 s e percorso di recupero per le altre. Queste soglie vanno misurate end-to-end e concordate con gli organizzatori.

La quota del pool è da controllare sul servizio reale. `connection_limit=1` per istanza, già previsto su Vercel, non limita il numero complessivo di connessioni prodotte da molte istanze. Il `.env` usa già un pooler sulla porta 6543: è un buon punto di partenza, non una prova di capacità.

## Privacy del database, manutenzione e costi

Nel DB esaminato RLS è disattivata sulle tabelle applicative, ma le verifiche dei permessi effettivi non attribuiscono SELECT/INSERT su `User` e `Tasting` ai ruoli `anon` e `authenticated`; non sono emersi grant diretti a questi ruoli sulle tabelle pubbliche. **Non è quindi corretto affermare che i dati siano pubblicamente leggibili solo perché RLS è disattivata.** Prima della produzione controllare comunque Data API, grant ereditati, ruolo DB dell’app e principio del privilegio minimo; usare RLS e/o disabilitare/restringere l’accesso Data API secondo l’architettura scelta.

Non sono stati rilevati `.env` o file password tracciati nell’indice Git corrente. Non è stata svolta una scansione completa della storia Git: questo non certifica l’assenza di segreti in vecchi commit. Il `JWT_SECRET` locale è residuo del sistema precedente, non un sostituto della configurazione Auth attuale.

Per hosting, database, SMTP, Redis, dominio e AI serve un budget approvato con quote e avvisi. Non è possibile dare un costo reale senza piani e utilizzo effettivi. Se la fiera è un uso commerciale, verificare l’idoneità del piano Vercel: **Hobby è limitato all’uso personale non commerciale**. [Piano Vercel Hobby](https://vercel.com/docs/plans/hobby).

Scegliere esplicitamente quanta perdita dati e quanto fermo siano accettabili. Obiettivo operativo suggerito: perdita massima **15 minuti** (RPO), ripristino entro **30 minuti** (RTO), da dimostrare. Il solo backup giornaliero può perdere quasi tutta una giornata di evento; occorre una strategia coerente con l’RPO scelto. Supabase documenta backup giornalieri su piani a pagamento e PITR come opzione; sul piano gratuito raccomanda export regolari e copie esterne. [Backup Supabase](https://supabase.com/docs/guides/platform/backups).

## Collaudo da completare prima del via libera

| Percorso | Risultato richiesto |
|---|---|
| Primo accesso dal QR con telefono pulito | Nome/email/OTP chiari, nessun account di test, evento corretto |
| QR → app email → ritorno → NFC | Sessione mantenuta nel browser effettivo; istruzioni per eventuale browser diverso |
| NFC prima di registrarsi | Dopo il login si torna alla bottiglia scelta |
| Più bottiglie, reload, chiusura e riapertura | Stesso evento, stesso utente, stessi voti salvati |
| Sessione oltre un’ora e più schede | Refresh funzionante, nessun logout inatteso o interferenza fra refresh |
| Doppio tap su Salva e risposta persa | Un solo effetto, nessuna regressione del voto |
| Rete interrotta durante il salvataggio | Messaggio corretto, stato recuperabile; nessuna falsa conferma |
| Logout A → login B sullo stesso dispositivo | Dati e coda separati |
| Vino/URL inesistente, evento chiuso | Errore comprensibile e ritorno al percorso corretto |
| AI/Redis/DB indisponibili | Comportamento previsto, alert e ripristino verificati |
| Classifica, se presente | Solo evento reale e partecipanti ammessi; nessun dato dei test |
| Privacy e assistenza | Informativa raggiungibile, richiesta di cancellazione eseguibile |
| Accessibilità e mobile | Safari iPhone e Chrome Android, schermo piccolo, tastiera, zoom, focus, lettore schermo, movimento ridotto |
| Condivisione DNA, se presente | Condivisione oppure download realmente funzionanti senza bloccare l’app |
| Nuova release con service worker già installato | Nessuna schermata obsoleta, nessuna perdita durante l’aggiornamento |

Il browser locale mostra la pagina correttamente, ma l’albero di accessibilità espone anche il pannello impostazioni chiuso e il layout della storia fuori schermo. Va verificato e corretto con `hidden`/`inert`/gestione del focus appropriata. Non è stata misurata la conformità WCAG né il contrasto su smartphone all’aperto.

Il service worker non include `src/outbox.js` nella lista di precache, pur essendo importato dall’app; viene eventualmente memorizzato in seguito. Il catalogo può restare nella cache mentre l’aggiornamento avviene in background; l’attivazione del worker forza la navigazione dei client. Questi comportamenti richiedono prova di aggiornamento e stato pending, soprattutto se si rilascia una correzione durante l’evento.

## Piano di lavoro fino al 25 ottobre

Le date sono una proposta; le stime sono ordini di grandezza per chi conosce già il progetto. Per una versione essenziale considero **8–12 giornate tecniche effettive**, più disponibilità degli organizzatori e tempi dei fornitori. Mantenere tutte le funzioni può portare a **12–18 giornate**. Non basta distribuire poche ore occasionali tra oggi e la fiera.

| Quando | Lavoro e responsabilità | Risultato verificabile |
|---|---|---|
| 29 settembre–2 ottobre | Tu + organizzatori: congelare funzioni, dati evento, titolarità/privacy, hosting e SMTP; scegliere dominio | Perimetro, catalogo da completare, account e ambiente staging identificati |
| 3–8 ottobre | Sviluppo: B1–B3 e B5; nascondere contatti/demo, correggere testi; schema e database separati | Percorso ingresso→assaggio coerente e regressioni coperte |
| 9–13 ottobre | Sviluppo + organizzatori: B4, B6, eventuale B8; produzione e monitoraggio | Email funzionanti, informativa pronta, staging completo |
| 14–18 ottobre | Tu + piccolo gruppo di prova: telefoni veri, tag finali, carico e guasti simulati | Esiti registrati, problemi residui assegnati |
| 19–21 ottobre | Correzioni mirate, prova backup/restore e rollback, verifica catalogo e associazioni | Candidato definitivo; procedure provate |
| 22 ottobre | Tu + organizzatori: decisione go/no-go basata sulla checklist | Via libera solo se i blocchi sono chiusi; altrimenti ridurre funzionalità o rinunciare al lancio completo |
| 23–24 ottobre | Congelare release, verificare ogni QR/tag, predisporre materiale e accessi | Nessuna novità funzionale; kit operativo pronto |
| 25 ottobre | Tu referente tecnico, un sostituto istruito e assistenza ingresso | Monitoraggio e gestione utenti senza dover sviluppare durante la fiera |

Non occorre una squadra strutturata: la tua conoscenza della fiera è un vantaggio. Serve però una seconda persona che sappia assistere l’OTP e indirizzare i visitatori mentre tu gestisci un problema tecnico. Un problema di posta su 600 arrivi/ora non deve obbligarti a scegliere fra fila all’ingresso e backend.

## Procedura operativa essenziale

**Prima dell’apertura:** prova completa su due telefoni e due operatori; verifica email con account nuovo e già esistente; controllo catalogo, data, URL, salvataggio e alert; conferma che non ci siano deploy in corso; backup e release precedente identificati; laptop, alimentazione e accessi amministrativi disponibili in modo sicuro.

**Materiale allo stand:** QR ben leggibile, breve istruzione “inserisci nome/email e verifica il codice”, indirizzo corto digitabile, contatto assistenza. Prevedere QR alternativi sulle bottiglie o un catalogo accessibile se un telefono non legge NFC. I tag già funzionanti vanno inventariati e ricontrollati sugli URL definitivi; valutarne la protezione dalla riscrittura solo dopo il collaudo finale.

**Durante l’evento:** monitorare tasso di errore, tempi API, richieste e verifiche OTP, 429/503, connessioni DB e coda pending se mantenuta. Se l’AI fallisce, passare al fallback già collaudato; se OTP o DB hanno un problema esteso, attivare una manutenzione reale e assistere i visitatori senza promettere salvataggi riusciti. Una modalità di sola consultazione può essere il piano B, ma va predisposta e provata: non è già implementata.

**Dopo l’evento:** export controllato dei dati autorizzati, verifica finale degli assaggi, gestione delle richieste privacy, conservazione/cancellazione secondo la durata decisa, chiusura dell’evento e revisione di costi/errori. Nessun invio commerciale automatico sulla sola base dell’email raccolta per accedere.

## Checklist finale go/no-go

- [ ] Database e migrazioni completi; dati di test separati; evento e catalogo reali approvati.
- [ ] Evento persistente fra QR, NFC e reload; regole evento/vino verificate lato server.
- [ ] Salvataggi idempotenti; nessuna sovrascrittura da retry vecchi; outbox corretta oppure rimossa.
- [ ] SMTP e quote applicative/provider provati per il picco; accesso e refresh funzionanti sui telefoni.
- [ ] Rate limiter condiviso e comportamento in caso di guasto verificati.
- [ ] Informativa pubblicata e trattamento dei dati definito; classifica corretta oppure disattivata anche lato API.
- [ ] Contatti cantina reali oppure rimossi; data, testi e comandi demo corretti.
- [ ] Wine DNA nella modalità scelta provato, inclusi errori e condivisione se promessa.
- [ ] Build pulita e suite verde; dipendenze valutate; dominio HTTPS e configurazione target verificati.
- [ ] Prova di carico con controllo dei risultati superata, oltre alla prova sul campione di utenti reali.
- [ ] Monitoraggio, manutenzione, backup/restore e rollback provati; referente e sostituto operativi.
- [ ] Ogni QR/tag finale verificato e release congelata.

**Decisione attuale: no-go per il pubblico, sì alla preparazione e al collaudo di una release essenziale.** I tag già testati e la tua presenza sul posto rendono più semplice l’operatività. Per arrivare pronti alla fiera il lavoro prioritario è rendere affidabili accesso, contesto dell’evento e salvataggio, completare privacy e configurazione, e ottenere evidenze sul sistema effettivamente pubblicato.
