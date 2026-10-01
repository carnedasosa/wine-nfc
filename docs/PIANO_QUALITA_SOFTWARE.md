# Piano di implementazione della qualità software di Vino Passport

Data: 1 ottobre 2026. Stato: implementazione locale in corso sulla branch `codex/software-quality`; nessun rilascio o modifica al database remoto effettuati.

Questo piano traduce la revisione del codice in interventi verificabili per gli sviluppatori e il responsabile del progetto. Copre correttezza dei salvataggi, coerenza delle sessioni, autenticazione, classifica, logica sensoriale, test, documentazione e pulizia del repository. Ogni attività include le conseguenze sui componenti collegati e le condizioni per considerarla conclusa.

Il piano governa queste nuove correzioni. Il precedente [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md) conserva il contesto storico e le attività operative ancora da verificare. Il [runbook di rilascio](RUNBOOK_RELEASE_FIERA.md) e il [runbook di ripristino](DR_RUNBOOK.md) restano riferimenti operativi: completare le attività qui descritte non certifica automaticamente capacità, SMTP, AI reale o ripristino di produzione.

## Evidenze e limiti della baseline

- Revisione di API, servizi, frontend, schema, migrazioni, service worker e CI.
- Esecuzione ordinaria dei test: 81 superati e 1 fallito; suite con ambiente isolato: 82 superati. Il test OTP passa anche isolando le sole variabili Upstash. Il difetto osservato riguarda la dipendenza dei mock dalla configurazione locale.
- Build statica e validazione Prisma superate.
- Riproduzioni con dipendenze simulate: salvataggio con versione appena recuperata ma valori precedenti al recupero; risposta di aggiornamento profilo che ripristina l'utente locale dopo logout, con successivo errore di rete.
- Problemi rilevati per lettura del codice: nome sovrascritto dal Magic Link, classifica limitata implicitamente a 50 partecipanti, divergenza fra statistiche client e server.
- Nessun nuovo collaudo remoto, browser completo o di carico eseguito durante questa revisione. I report precedenti documentano il loro momento di esecuzione e non sono prove della futura versione corretta.

## Criteri di qualità e invarianti

| Dimensione | Risultato richiesto | Prova di accettazione |
|---|---|---|
| Correttezza | Un voto viene aggiornato rispetto alla versione mostrata all'utente | Test del modulo e integrazione PostgreSQL con versioni concorrenti |
| Affidabilità | Retry, risposte tardive e guasti di rete non perdono o attribuiscono male dati | Test deterministici di concorrenza e percorsi browser con errori simulati |
| Sicurezza | Una risposta obsoleta non modifica la nuova sessione; il server continua a determinare l'identità | Regressioni su logout, cambio account, CSRF, ownership e cookie |
| Usabilità e accessibilità | Caricamento, errore, conflitto e salvataggio hanno stati distinguibili e azioni accessibili | Test browser e verifica da tastiera su dispositivi rappresentativi |
| Manutenibilità | Regole condivise, contratti espliciti, controlli statici e documenti autorevoli | CI, revisione delle dipendenze e verifica dei collegamenti |
| Efficienza | Nessuna duplicazione evitabile di richieste, generazioni AI o query per riga | Conteggio delle chiamate nei test e misure prima e dopo su staging |
| Compatibilità | Le schede con il vecchio service worker continuano a ricevere risposte compatibili | Collaudo con client di due build consecutive |
| Testabilità e riproducibilità | I test ordinari non dipendono da credenziali personali o servizi reali | Checkout pulito, rete esterna vietata ai test e PostgreSQL temporaneo |

Restano invariati: identità verificata sul server, cookie HttpOnly, controllo CSRF/origin, consenso alla classifica, registro idempotente e transazioni dei voti. Nessuna migrazione distruttiva è prevista. Se un intervento richiede una modifica dello schema, va aggiunta al piano con migrazione additiva, compatibilità e prova di recupero.

## Ordine di lavoro e responsabilità

Le responsabilità indicano ruoli, da assegnare a persone all'avvio. Lo stesso sviluppatore può coprire più ruoli; per sessioni, integrità dati e rimozioni serve una revisione esplicita del diff da parte del responsabile tecnico.

| Task | Priorità | Responsabile | Dipendenze | Deliverable |
|---|---|---|---|---|
| Q01 Ambiente e test riproducibili | P1 | Sviluppatore e QA | Nessuna | Test isolati e regressioni riproducibili |
| Q02 Sessioni e operazioni asincrone | P1 | Frontend con backend | Q01 | Contesto sessione e invalidazione coerenti |
| Q03 Modifica e salvataggio dei voti | P1 | Frontend con backend | Q01, Q02 | Stato della scheda e versione della bozza |
| Q04 Nome utente nel Magic Link | P2 | Backend | Q01 | Collegamento identità che preserva il nome |
| Q05 Classifica completa e comprensibile | P2 | Frontend con backend | Q01, Q02 | Paginazione e ranking corretti |
| Q06 Regole sensoriali condivise | P2 | Full stack | Q01, Q03 | Funzioni pure e adapter dei dati |
| Q07 Contratti e diagnostica | P2 | Full stack | Q02, Q03, Q04, Q05, Q06 | Controlli statici e log coerenti |
| Q08 CI e verifiche integrate | P1 | Sviluppatore e QA | Q01; completamento dopo Q02–Q07 | Gate automatici riproducibili |
| Q09 Documentazione autorevole | P1 | Autore di ciascun task e responsabile tecnico | Inizia subito; chiusura dopo Q10 | README e runbook coerenti con il codice |
| Q10 Pulizia motivata del repository | P2 | Sviluppatore e responsabile tecnico | Q08 disponibile; coordinamento con Q09 | Rimozioni tracciate e riferimenti aggiornati |
| Q11 Collaudo e rilascio | P1 | Responsabile tecnico e QA | Q02–Q10 | Evidenze, decisione di rilascio e recupero |

Sequenza consigliata delle PR: Q01 e infrastruttura iniziale Q08; Q02; Q03; Q04; Q05; Q06; Q07 e completamento Q08; Q09/Q10; Q11. Ogni PR include i propri test e la documentazione modificata. Non accumulare correzioni funzionali, riformattazione massiva e cancellazioni nello stesso diff.

## Q01 Rendere riproducibili test e difetti

**Azioni.** Introdurre un setup Vitest eseguito prima degli import applicativi. Definire esplicitamente l'ambiente di test, con URL fittizi, segreti sintetici e nessuna configurazione Upstash ereditata. Impedire richieste di rete non simulate nei test unitari. Separare i mock di Supabase e Redis per URL e contratto: una sequenza globale di risposte non deve servire indistintamente entrambi. Ripristinare globali, ambiente, timer, store e spy fra test.

Portare le riproduzioni della revisione in test permanenti sul comportamento. Aggiungere fixture minime per DOM, sessione e risposte HTTP; usare promesse controllate per decidere l'ordine di risoluzione, senza attese arbitrarie. Ogni correzione deve avere un test che fallisce prima della modifica e passa dopo; non lasciare test deliberatamente rossi nella branch principale.

**Relazioni e conseguenze.** Gli import CommonJS possono inizializzare Prisma e leggere configurazione prima di `beforeEach`: isolare soltanto il singolo test non basta. I test che verificano proprio il comportamento production devono attivarlo esplicitamente e continuare a controllare il blocco del servizio quando Redis manca. Non usare l'isolamento per nascondere errori reali del rate limiter.

**Accettazione.** La suite passa sia senza `.env` sia con variabili Upstash sintetiche presenti nel processo chiamante; i mock non contattano la rete. In CI non sono necessari segreti. Un test intenzionalmente non simulato deve fallire subito indicando la destinazione, senza stampare credenziali.

**Recupero.** Modifica limitata all'infrastruttura di test; nessun effetto runtime. Se emerge un comportamento prima mascherato, correggere il test o il codice con evidenza, senza disattivare globalmente l'isolamento.

## Q02 Proteggere lo stato dalle risposte obsolete

**Azioni.** In `src/state.js` introdurre un contesto di sessione con contatore monotono e identità/evento catturati all'avvio dell'operazione. Incrementare il contatore su logout, scadenza, cambio account ed evento; evitare l'invalidazione indiscriminata a ogni aggiornamento del nome. Fornire funzioni per catturare e verificare il contesto, da usare in impostazioni, onboarding, caricamento assaggi, vino, DNA, classifica e storie.

Prima di applicare una risposta, modificare DOM/stato, inviare una seconda richiesta o eseguire un `finally` che riabilita pulsanti, verificare che l'operazione appartenga ancora al contesto attivo. Uniformare successi e rami di errore: una vecchia richiesta fallita non deve ridisegnare una schermata nuova. Conservare i contatori specifici di rendering dove distinguono due operazioni nella stessa sessione.

Bloccare il doppio logout e coordinare logout, refresh e modifiche in corso. L'annullamento HTTP è solo un'ottimizzazione: non prova che il server non abbia applicato una scrittura o emesso cookie. Verificare in browser l'ordine delle risposte con `Set-Cookie`, specialmente refresh seguito da logout. Per più schede, propagare l'invalidazione tramite un canale senza token o dati personali e richiedere la verifica server prima di nuove scritture dopo un cambio di sessione osservato.

Gestire esplicitamente il salvataggio parziale delle impostazioni: oggi nome e partecipazione sono due richieste. In questo intervento mantenerle separate, acquisire i valori del modulo prima degli `await`, distinguere l'esito delle due operazioni e ritentare soltanto la parte fallita. Non annullare automaticamente una modifica al nome già confermata dal server.

**Relazioni e conseguenze.** Tocca `src/state.js`, `src/api.js`, `app.js` e moduli UI. `clearDnaCache()` invalida anche le storie: il reset deve preservare questa relazione. Il single-flight del refresh deve restare efficace. I controlli locali non sostituiscono autenticazione e ownership backend; la sincronizzazione tra schede riduce le incoerenze ma non costituisce una garanzia server di attribuzione delle scritture. Se il test multi-tab rivela scritture sotto un account diverso, introdurre un controllo server del contesto atteso prima del rilascio, con contratto compatibile e analisi dedicata.

**Accettazione.** Risposta profilo dopo logout; account A sostituito da B; richiesta vecchia che fallisce dopo nuovo login; chiusura e riapertura impostazioni; due refresh simultanei; logout durante refresh; nome aggiornato e partecipazione fallita. Nessuna risposta obsoleta modifica identità, bozza, cache, focus o pulsanti della nuova operazione. Un logout completato non deve essere annullato da cookie emessi tardivamente.

**Recupero.** Distribuire come unità coerente le modifiche allo stato e ai suoi consumer. Non ripristinare isolatamente un consumer che assume un diverso contratto di sessione. Nessuna modifica DB prevista.

## Q03 Legare il voto alla versione mostrata

**Azioni.** Modellare la scheda con stati espliciti: caricamento, pronta, errore di caricamento, salvataggio, conflitto. Prima di permettere la modifica, ottenere uno stato assaggi valido per utente/evento. Un caricamento fallito deve offrire un retry e non rappresentare l'assenza di dati come assenza di un voto.

Alla visualizzazione creare una bozza con `wineId`, contesto di sessione, valori e `baseVersion` del voto mostrato. Usare zero soltanto dopo una lettura riuscita che confermi l'assenza del voto. Al salvataggio utilizzare quella versione, mai una versione recuperata silenziosamente da uno stato globale più recente.

Mantenere la stessa chiave idempotente per il retry della stessa bozza dopo esito incerto. Un cambiamento di payload richiede una nuova chiave. Su `409`, recuperare il dato attuale e mostrare conflitto e scelte di ricarica o riapplicazione consapevole della bozza. Una ricarica automatica non deve rendere valido il successivo click con valori che l'utente non ha confrontato. Dopo un replay, riconciliare lo stato locale se il server restituisce una risposta storica più vecchia della versione attuale.

**Relazioni e conseguenze.** Modifica `src/ui/wine.js`, caricamento stato e messaggi del modulo; influenza home, conteggi, invalidazione DNA e classifica. Deve funzionare per apertura dalla home, link NFC e ritorno dall'onboarding. Cambiare vino durante una richiesta non deve far chiudere la nuova scheda alla ricezione della vecchia risposta. Conservare l'idempotenza e la transazione di `lib/tasting-store.js`; evitare ulteriori fetch prima di ogni salvataggio quando la fotografia mostrata è già valida.

**Accettazione.** Voto esistente `5/5/5`, caricamento iniziale fallito, recupero con versione 7: nessun invio di valori predefiniti senza revisione. Testare vino nuovo, doppio click, modifica contemporanea da due schede, perdita della risposta dopo commit, retry vecchio dopo voto nuovo, errore durante ricarica del conflitto, cambio vino e logout durante salvataggio. Il DB contiene un solo voto e la UI dichiara successo soltanto dopo conferma.

**Recupero.** Nessuna migrazione richiesta. Una regressione nell'integrità blocca il rilascio; se rilevata dopo il deploy, fermare temporaneamente le scritture con la procedura di manutenzione e applicare una correzione verificata. Evitare di ripristinare una build già nota per sovrascritture inconsapevoli.

## Q04 Preservare il nome durante il collegamento identità

**Azioni.** Distinguere nel servizio account nome esplicitamente richiesto e nome di fallback. Il Magic Link conserva il nome esistente e usa il fallback solo per creazione o nome mancante. Il flusso OTP mantiene la semantica del nome fornito dall'utente. Esplicitare queste opzioni nel contratto di `linkVerifiedIdentity`, senza usare stringhe vuote come segnali impliciti.

**Relazioni e conseguenze.** Aggiornare `api/auth/exchange.js`, `api/auth/verify-otp.js`, `lib/user-account.js`, fixture e mock-login. Preservare email verificata, vincolo su authSubject e gestione dei conflitti legacy. Applicare la stessa politica nei rami transazionali, nel recupero dopo `P2002` e in caso di richieste concorrenti: una risposta tardiva di login non deve annullare un nome appena modificato.

**Accettazione.** Utente nuovo, esistente con nome, nome assente, profilo legacy collegabile, conflitto di identità e concorrenza fra login/aggiornamento. Il nome personalizzato sopravvive al Magic Link; nessuna riduzione delle garanzie anti-takeover. Test di route oltre ai test del servizio.

**Recupero.** API esterna e schema rimangono invariati. Non effettuare backfill automatici dei nomi: il nome precedente non è ricostruibile con certezza dal valore corrente.

## Q05 Rendere esplicita la paginazione della classifica

**Decisione proposta.** Classifica paginata con 50 righe per pagina e comando accessibile per caricare la pagina successiva. La posizione personale dedicata resta un'estensione futura. Il frontend mostra il `rank` restituito dal server, senza ricalcolarlo dall'indice locale. Confermare i testi con il responsabile prodotto prima della chiusura del task.

**Azioni.** Estendere il client con `page` e `limit`, mantenendo la risposta API come array compatibile. Gestire caricamento, errore e retry della singola pagina; una pagina piena permette di richiedere la successiva, un risultato più corto conclude l'elenco. Una pagina finale vuota è ammessa senza introdurre subito un conteggio costoso. La cache deve includere utente, evento, pagina e limite, con invalidazione delle risposte pendenti.

**Relazioni e conseguenze.** Tocca `api/leaderboard.js`, `src/api.js`, `src/ui/leaderboard.js`, controlli HTML/CSS e invalidazione da voto/impostazioni/logout. Preservare nickname e consenso; non esporre userId/email per semplificare il client. L'ordinamento corrente è conteggio decrescente e userId come spareggio: documentare che produce posizioni ordinali, non ranghi condivisi.

La paginazione a offset su dati che cambiano può produrre righe ripetute o saltate fra pagine. Per questa release dichiarare che l'elenco è aggiornabile, non una fotografia transazionale; alla scadenza o invalidazione della cache ripartire dalla prima pagina. Non deduplicare per nickname, che non è univoco. Se si richiede una fotografia stabile, aprire una decisione separata su snapshot/cursore, costi e riservatezza.

**Accettazione.** Dataset di 0, 1, 50, 51 e 101 partecipanti; nickname uguali; conteggi pari; revoca consenso; errore della seconda pagina; cambio account/evento durante richiesta; aggiornamento dopo voto. Tutti i partecipanti del dataset statico sono raggiungibili una volta, con rank coerente. Nessuna query aggiuntiva per singola riga. Aggiornare la denominazione del profilo `LEADERBOARD_IP` o documentare chiaramente che attualmente limita per subject; preservare gli override già configurati con eventuale alias di transizione.

**Recupero.** Il contratto array permette ai client precedenti di continuare a usare la prima pagina. Se si introduce un envelope diverso, mantenerlo opt-in/versionato fino alla dismissione verificata dei vecchi client.

## Q06 Unificare le regole sensoriali

**Azioni.** Estrarre funzioni pure per medie, emozioni, tag e riepilogo descrittivo. Proposta tecnica: `src/domain/sensory.mjs`, privo di dipendenze da DOM, Prisma, ambiente e provider; import ESM dal browser e import dinamico dal backend CommonJS. Verificare questa soluzione nella build delle funzioni prima di adottarla; evitare due implementazioni mantenute a mano.

Normalizzare il dato tramite adapter: il server usa `wine`, il client usa `vino`. Definire una sola precisione di calcolo, soglie dei tag e ordinamento deterministico delle emozioni a pari frequenza. Conservare la precisione per classificare e arrotondare soltanto per la visualizzazione dove necessario. Rendere esplicita la gestione di input vuoti o incompleti senza introdurre rating fittizi.

**Relazioni e conseguenze.** Interessa `api/dna.js`, `src/ui/dna.js`, `src/utils.js`, home e gli eventuali calcoli sovrapposti in `src/story-model.js`. Verificare quali regole delle storie siano intenzionalmente diverse prima di unificarle. Includere il nuovo modulo nel precache e verificarne il packaging serverless. Il modulo condiviso è pubblico e non deve contenere segreti. Il server continua a calcolare il DNA dai dati DB; il fallback locale resta esplicitamente descrittivo.

Se cambiano testo o semantica, incrementare la versione dell'algoritmo nella chiave cache in `lib/dna-generation.js`; senza questo passaggio potrebbero essere serviti vecchi profili. L'invalidazione aumenta temporaneamente le generazioni: misurare chiamate e budget, preservando lease e limite evento.

**Accettazione.** Stessi dati normalizzati producono stessi valori/tag nei due percorsi, inclusi 2,4/2,5 e 3,5/3,9/4,0, pareggi, lista vuota e metadati mancanti. Rendering storie e PNG continuano a funzionare. La nuova build avvia il modulo in browser e nelle funzioni; aggiornamento service worker senza import mancanti. Cache vecchia non riutilizzata per semantica nuova.

**Recupero.** Ripristinare insieme algoritmo e sua versione cache; conservare i record cache esistenti, senza cancellazioni massive. Non promettere un numero invariato di chiamate AI dopo invalidazione.

## Q07 Esplicitare contratti e rendere utile la diagnostica

**Azioni.** Introdurre ESLint e controllo JSDoc con `checkJs` iniziando da stato, API client, bozza voto, account e modulo sensoriale. Definire tipi per utente, evento, voto letto, payload di salvataggio, partecipazione e riga classifica. Configurare correttamente gli ambienti browser, Node, test e service worker. Includere la verifica nei comandi del progetto; non introdurre una migrazione globale a TypeScript in questa fase.

Standardizzare errori e request ID nelle route modificate. Correggere la classificazione in `withAuth`, che oggi etichetta come autenticazione anche errori del relativo handler. Usare categorie distinte per provider, validazione, conflitto e guasto interno. Validare formato/lunghezza dell'ID ricevuto e generarne uno nuovo quando non valido; registrare solo campi ammessi.

**Relazioni e conseguenze.** Gli errori strutturati sono consumati da `src/api.js`: mantenere `code`, messaggio e status compatibili. Evitare di convertire indiscriminatamente ogni guasto in 401, che avvierebbe refresh/logout errati. I log devono consentire diagnosi senza corpi, cookie, token, OTP, email o identificativi provider. La build del codice deve restare distinta dalla formattazione dei file.

**Accettazione.** Controlli statici verdi nei moduli coperti, nessuna soppressione generalizzata; import browser e CommonJS funzionanti. Un guasto DB nel tasting handler non è registrato come errore di autenticazione. Un codice di conflitto arriva invariato al client. Test di redazione sui logger e nessun doppio invio della risposta HTTP.

**Recupero.** Contratti pubblici invariati. L'adozione dei controlli statici può essere graduale per directory, con perimetro dichiarato; le nuove aree coperte non tornano prive di controllo per aggirare errori.

## Q08 Portare integrazione e browser nella CI

**Azioni.** Mantenere unit test, schema, build e audit dipendenze; aggiungere PostgreSQL temporaneo come servizio CI e applicare tutte le migrazioni da zero. Adattare `scripts/test-db-isolated.cjs` a una connessione di test esplicita, evitando il fallback trasparente alle credenziali applicative locali. Verificare destinazione, schema casuale e cleanup anche in caso di errore. Spostare gli output dai percorsi di audit storici a una directory di esecuzione ignorata da Git.

Integrare nel progetto una versione dichiarata del runner browser oggi richiesto esternamente dagli script delle storie. Installare il browser in CI e avviare fixture/server in modo riproducibile, con attesa di readiness e teardown. Distinguere test UI con API simulate, integrazione route/DB e smoke test reali su staging: ciascuno dimostra aspetti diversi. Per i percorsi di sessione usare fixture controllate senza introdurre bypass distribuibili in produzione.

**Relazioni e conseguenze.** Tocca workflow, package e lockfile, script DB e helper browser. Il test delle storie usa oggi service worker bloccati: aggiungere una suite dedicata con worker attivi per verificare cache e aggiornamento. Controllare anche gli artefatti di deploy: `.vercelignore` esclude attualmente `api/health.js`, mentre i runbook prevedono health check. Risolvere questa incoerenza o adeguare il gate a un endpoint effettivamente incluso, verificandone esposizione minima.

**Accettazione.** Da checkout pulito: installazione, lint/checkJs, unit, integrazione DB, build ed E2E eseguibili con comandi documentati. Una regressione di concorrenza o migrazione blocca la CI. Nessun segreto reale, OTP esterno o chiamata AI a pagamento nei job ordinari. Report con commit, ambiente sintetico, esito e durata; artifact falliti utili alla diagnosi e privi di sessioni reali.

**Recupero.** Se un test è instabile, correggere sincronizzazione e fixture; non renderlo facoltativo per ottenere il verde. Non usare `prisma db push`, reset o modifiche retroattive alle migrazioni applicate per far passare i test.

## Q09 Aggiornare e consolidare la documentazione

**Azioni.** Rendere il README la guida corrente a setup, comandi, architettura essenziale e configurazione. Allineare limiti OTP effettivi, significato del limite classifica, attivazione/modello AI, migrazioni, comportamento offline disabilitato, gestione conflitti e paginazione. Verificare esempi tramite codice/configurazione, senza copiare valori storici.

Riconciliare piano storico, stato release, report tecnici e runbook. Distinguere chiaramente comportamento implementato, test eseguito con data/commit e verifica remota ancora necessaria. Non riscrivere un audit storico come se le sue prove fossero state ripetute. Documentare le decisioni su sessioni, bozza voto, paginazione e algoritmo condiviso in una sezione architetturale autorevole, evitando la proliferazione di documenti sovrapposti.

**Relazioni e conseguenze.** `scripts/render-release-report.cjs` deriva un HTML dallo stato release: decidere se distribuirlo come artifact generato o continuare a versionarlo con rigenerazione obbligatoria. Migrare tutti i link quando si spostano report; mantenere recuperabili prove, data e commit di riferimento. Aggiornare le istruzioni di restore e la nota sui checksum delle migrazioni quando pertinente, senza alterare la storia del database.

**Accettazione.** Un nuovo collaboratore completa setup e controlli seguendo il README. Un solo riferimento corrente per ogni procedura; nessun link locale interrotto; nessun comando pericoloso presentato come setup ordinario; nessuna dichiarazione di readiness basata soltanto su unit test. La PR di ciascuna funzione include la relativa documentazione; questo task ne verifica la coerenza finale.

**Recupero.** Ripristino documentale da Git o dagli artifact conservati. I link storici necessari ricevono un rimando; i dati sensibili non vanno duplicati per ragioni di archivio.

## Q10 Eliminare soltanto ciò che è realmente superfluo

**Metodo.** Prima di ogni rimozione censire produttore, consumer, riferimenti statici/dinamici, uso manuale nei runbook, copia in `dist`, precache e distribuzione serverless. La sola assenza di import non dimostra inutilità. Per ogni gruppo registrare nella PR decisione, motivazione, sostituto, riferimenti aggiornati e verifica. Non eseguire gli script legacy per scoprirne l'effetto sul database.

| File o gruppo | Decisione prevista | Relazioni e condizioni |
|---|---|---|
| `test-post.js` | Eliminare dopo sostituzione con test di route corrente | Chiama il vecchio `POST /api/users`; verificare riferimenti operativi |
| `test-db.js` | Eliminare o sostituire con diagnostica minimale | Legge e stampa utenti; usare health check senza dati personali e disconnessione garantita |
| `create-test-event.js`, `create-test-event-wine.js` | Sostituire con fixture isolate, poi eliminare | Identificativi hardcoded; il primo usa `ATTIVO` mentre il dominio controlla `active`. Vietare uso sul DB applicativo |
| `update_styles.py` | Eliminare dopo conferma che la trasformazione sia conclusa | Mutazione una tantum di CSS; rimuovere anche il riferimento in `.vercelignore` |
| `load-test.yml`, `load-test-auth.yml` | Confrontare con il nuovo harness e consolidare | Trasferire scenari ancora utili prima di cancellare configurazioni di carico |
| `report.json`, `report-auth*.json` | Conservare come evidenza storica identificata oppure trasferire in archivio controllato | Sono citati dal report di settembre. Non eliminarli come semplici duplicati; aggiornare link e verificare contenuti sensibili |
| `CODE_AUDIT.md`, `REVIEW_REPORT.md`, `TECHNICAL_ANALYSIS.md` | Consolidare contenuti correnti, archiviare ciò che ha valore storico, eliminare duplicazioni prive di valore | Verificare data, commit e riferimenti; non perdere motivazioni ancora applicabili |
| Report HTML in `docs` | Generare da una sorgente autorevole; valutare rimozione delle copie versionate | Non cancellare la sola copia condivisibile senza un processo sostitutivo |
| `.agent/**/__pycache__` e file `.pyc` tracciati | Eliminare dal controllo versione e ignorare | Conservare i sorgenti e i dati delle skill; l'assenza di import applicativi non giustifica cancellare strumenti dell'utente |
| `src/outbox.js` e chiamate no-op | Rimuovere come intervento coordinato, mantenendo disabilitato l'invio delle vecchie code | Aggiornare import statici/dinamici in `app.js`, listener online/messaggi, precache e test. Non attivare invii né eliminare IndexedDB senza una distinta decisione sui dati |
| Simulatore NFC e contatti non implementati | Eliminare codice/controlli nascosti se non più usati dalle fixture | Aggiornare listener, markup, CSS e test insieme; un elemento rimosso con listener non protetto può bloccare l'avvio |
| Immagini apparentemente duplicate in `assets` | Verificare hash, CSS, canvas, design source e service worker prima di decidere | Una sorgente grafica può essere necessaria per rigenerare asset pur non apparendo nell'app |
| `dist`, `generated`, `node_modules`, output temporanei | Mantenerli come output ignorati e rigenerabili | Non confondere pulizia Git con rimozione delle dipendenze runtime dal packaging |
| Migrazioni, licenze font, runbook DR, evidenze pertinenti | Conservare | Non sono superflui perché non importati dal frontend |

**Effetti sugli aggiornamenti PWA.** La rimozione di un modulo può rompere client precedenti che lo caricano dinamicamente. Verificare due versioni consecutive e mantenere temporaneamente un modulo compatibile quando necessario. In particolare, la rimozione dell'outbox richiede un nuovo manifest precache e una prova che nessuna coda storica venga sincronizzata. Non cancellare indiscriminatamente cache o storage del dispositivo.

**Accettazione.** Build da checkout pulito, grafo degli import risolvibile, installazione worker riuscita, nessun nuovo 404 di asset, E2E core e storie verdi, link documentali validi. Confrontare l'inventario pubblico prima/dopo: nessun file privato entra in `dist`. Le rimozioni non producono operazioni DB. Evitare obiettivi artificiali di numero di file o righe eliminate.

**Recupero.** Commit di pulizia separati e reversibili, con percorsi espliciti. Ripristinare file e riferimenti insieme. Prima di una cancellazione ricorsiva locale verificare che la destinazione assoluta sia esattamente la directory prevista nel workspace; nessuna cancellazione estesa di cache dell'utente o cartelle strumenti.

## Q11 Verificare la release e predisporre il recupero

**Azioni.** Eseguire l'intero percorso ingresso/NFC, OTP, sessione, voto, conflitto, reload, partecipazione, classifica, DNA, storia e logout. Coprire iPhone/Safari e Android/Chrome rappresentativi; simulare rete lenta, perdita connessione, timeout, risposta persa, 401, 409, 429 e 503. Verificare focus, annunci degli stati e disponibilità delle azioni nei nuovi controlli.

Misurare query, chiamate provider e latenza prima/dopo su staging equivalente. Usare il limite p95 di 3 secondi già presente nell'harness come gate del suo perimetro, senza estenderlo a OTP o AI reale che il test può escludere. Se non è adeguato, modificarlo con motivazione prima dell'esecuzione, non per far passare un risultato negativo. Il collaudo richiede zero scritture perse/duplicate o attribuite ad altro account e zero errori funzionali nello scenario controllato. Il dimensionamento dell'affluenza va confermato rispetto al runbook corrente, non dedotto dal numero di test unitari.

Verificare artifact serverless, disponibilità health check e compatibilità di vecchia app shell con nuove API. Pubblicare prima backend compatibile e poi frontend; mantenere risposte e asset necessari durante la transizione. Non forzare un reload mentre esiste una bozza. Per correzioni urgenti di integrità, predisporre manutenzione delle scritture e messaggio di aggiornamento, anziché lasciare client vulnerabili indefinitamente attivi.

**Accettazione e decisione.** Registrare commit/build, configurazione non segreta, prove, limiti e responsabile della decisione. Nessun P1 aperto nel perimetro; P2 risolti o esplicitamente motivati con impatto e scadenza. Le questioni SMTP, AI reale, dati evento e restore mantengono i gate del runbook. Un test con provider simulato non chiude il gate del provider reale.

**Recupero.** Provare in staging manutenzione e ritorno a una build conosciuta come sicura. Non ripristinare versioni con difetti noti di identità o integrità solo perché più vecchie. Preferire correzioni additive e roll-forward quando la compatibilità impedisce il rollback; non resettare il DB. Dopo recupero verificare sessioni, scritture, cache e worker, oltre al semplice health check.

## Condizioni comuni di completamento

Ogni task si chiude solo con implementazione, test pertinenti, analisi delle dipendenze aggiornata, compatibilità verificata, documentazione e prova di recupero proporzionata al rischio. La PR indica scenario prima/dopo, moduli coinvolti, comandi eseguiti, esito e limiti delle prove. La coverage numerica può segnalare aree scoperte, ma non sostituisce i casi di guasto elencati.

Resta fuori da questo piano la riscrittura del framework, la riattivazione dell'offline con invio automatico e una migrazione globale dei linguaggi. Eventuali nuove necessità scoperte dai test diventano task espliciti con impatto e dipendenze, senza allargare silenziosamente le PR.

## Stima e avanzamento

### Esecuzione locale del 1 ottobre

Le spunte di chiusura sotto conservano le condizioni di accettazione complete, comprese integrazione e compatibilità. La tabella distingue il codice già implementato dalle verifiche ancora aperte; non rappresenta tutti i task come conclusi sulla base dei soli unit test.

| Task | Implementazione ed evidenza locale | Per chiudere il task |
|---|---|---|
| Q01 | Setup Vitest prima degli import, ambiente sintetico e blocco fetch non simulato; regressioni con promesse controllate. Suite verde anche con Redis sintetico ereditato. Probe HTTP deliberatamente negativo fallito come atteso e rimosso. | Ripetere `npm ci` e suite nel checkout pulito della CI. |
| Q02 | Generazione sessione/evento in stato e consumer, guardie di richieste/successi/errori/finally, single-flight logout/refresh, Web Locks, segnale fra schede senza dati personali. Vincolo server `X-Vino-User` con 409 in caso di cookie diverso. Browser: logout invalida la bozza nell’altra scheda. Test di onboarding, profilo, DNA e cambio account. | Cookie reali con provider, browser senza Web Locks, refresh/login/logout concorrenti su Safari e Chrome; compatibilità con vecchi client privi dell’header. |
| Q03 | Versione associata ai valori visualizzati, controlli disabilitati fino alla lettura, retry con stessa chiave e ricarica esplicita dopo 409. Replay rilegge lo stato senza sovrascrivere una versione locale più recente. Browser: errore lettura, recupero, modifica 5→4 e conflitto. | Eseguire il runner PostgreSQL e il percorso browser con backend reale; verificare risposta persa e concorrenza fra dispositivi. |
| Q04 | Magic Link preserva il nome anche nel claim legacy e nel recupero P2002; riempimento condizionale non sovrascrive una modifica concorrente. Test del servizio e della route, inclusi cookie; scenario aggiunto al runner DB. | Runner PostgreSQL e scambio reale del provider. |
| Q05 | Pagine da 50, rank server, retry pagina senza duplicare gli omonimi, cache per contesto. Test 0/1/50/51/101 righe; browser arriva a #101. | Verificare query reali con 101 partecipanti e variazioni di consenso/ranking durante la paginazione. |
| Q06 | Modulo puro ESM comune a server, fallback e medie della storia; soglie sulla media reale e valori mancanti null. Versione dell’algoritmo nella cache DNA; test di soglia, parità dei formati e route/fallback. | Verificare inclusione del modulo nel bundle serverless e cache persistente reale. |
| Q07 | ESLint su frontend/backend, `checkJs` strict su stato e sensori, JSDoc di User/Wine/Tasting/SessionContext. Controlli runtime delle risposte voti/DNA. Logger centrale con allowlist e test di esclusione dei dati sensibili. | Estendere i contratti verificati a API/bozza/partecipazione e uniformare la diagnostica restante; nessuna copertura globale dei tipi dichiarata. |
| Q08 | `npm run check`, verifica dell’artifact e dei link; workflow con PostgreSQL 16 e artifact di collaudo. Runner DB usa solo `TEST_DATABASE_URL` loopback con suffisso `_test`, non legge `.env` e non sovrascrive gli audit. | Esecuzione CI effettiva e automazione browser stabile. PostgreSQL/Docker non disponibili localmente: nessun nuovo test DB eseguito in questa sessione. |
| Q09 | README e runbook aggiornati; vecchi audit e stato release identificati come storici. Report nuovi sotto `output/quality`. Decisioni e dipendenze correnti nel README, verifiche nel presente piano. | Verificare setup da checkout pulito e aggiornare il risultato della CI/staging senza riciclare evidenze passate. |
| Q10 | Sei script/configurazioni obsoleti e cinque `.pyc` rimossi; simulatori nascosti, CSS e listener eliminati insieme. Shim outbox mantenuto per vecchi client; import attuali e precache verificati. | Concludere il collaudo di due versioni PWA con backend reale e confermare il packaging remoto. |
| Q11 | Prove browser con fixture a desktop e 320 px, nessun overflow del conflitto (larghezza contenuto 305/305). Passaggio alla nuova PWA osservato solo dopo chiusura delle vecchie schede. Anteprima e download PNG 1080×1920 verificati (acidità 4/5, corpo e persistenza 5/5). | Staging, provider reali, Web Share su dispositivi, carico, ripristino e decisione di rilascio. Nessun go-live autorizzato da queste prove. |

**Verifica finale locale.** `npm run check`: lint, checkJs, **141 test in 22 file**, build e verifica di **17 moduli** nel precache superati. `npm run prisma:validate` superato; `npm audit --omit=dev --audit-level=high`: zero vulnerabilità segnalate. Runner DB verificato nel rifiuto della connessione implicita; test PostgreSQL non eseguiti. Base Git `fc0ea1f`; verifiche eseguite sul working tree della branch `codex/software-quality` prima del commit di pubblicazione.

**Inventario delle rimozioni.** Eliminati `test-post.js` (route legacy sostituita dai test protetti), `test-db.js` (dump utenti sostituito dal health senza dati personali), `create-test-event.js` e `create-test-event-wine.js` (fixture con identificatori hardcoded sostituite dal runner isolato), `update_styles.py` (trasformazione CSS una tantum, riferimento `.vercelignore` rimosso), `load-test-auth.yml` (mock login/payload vecchio sostituiti da `load:staging`) e cinque `.pyc` in `.agent/skills/ui-ux-pro-max/scripts/__pycache__`. Nessuno script legacy è stato eseguito per valutarne la rimozione. Le rimozioni sono recuperabili da Git.

**Conservazioni deliberate.** `load-test.yml` resta lo scenario anonimo homepage/catalogo, distinto dall’harness autenticato. Report JSON/HTML e audit restano evidenze storiche; `CODE_AUDIT.md`, `REVIEW_REPORT.md` e `TECHNICAL_ANALYSIS.md` hanno un rimando esplicito ai documenti correnti. Conservati sorgenti skill, migrazioni, licenze e asset grafici. `src/outbox.js` rimane nel precache come shim disabilitato: rimossi solo i consumer no-op dell’app corrente, senza inviare o cancellare le code storiche.

**Conseguenze per la distribuzione.** Le modifiche a stato, API client, sincronizzazione e UI formano un insieme coerente da distribuire insieme. L’header atteso è additivo e non sostituisce cookie/CSRF. La nuova versione sensoriale genera chiavi DNA nuove e può aumentare temporaneamente le generazioni: conservare i budget esistenti e misurare in staging. La build ora include anche il sorgente del worker nel digest, così una modifica delle sole regole di cache produce una nuova cache. `/api/health` non è più esclusa dal caricamento Vercel: verificare il numero finale di funzioni del piano prima di pubblicare.

**Limiti delle prove.** Il server `test:preview` usa dati sintetici e non certifica DB o provider. L’attesa dell’evento download nel browser integrato è scaduta, ma il file prodotto è stato recuperato dalla cartella Download e verificato: PNG 1080×1920, dati della fixture coerenti; copia locale in `output/quality/sovranaturale-wine-dna.png`. Il tentativo con agent-browser su Windows non ha avviato il daemon; le prove UI sono proseguite nel browser integrato. Non sono stati eseguiti deploy, invii SMTP, generazioni AI reali o carichi remoti.

Stima preliminare per uno sviluppatore esperto: 13–20 giornate tecniche, inclusi test e revisione, escluse attese di provider e disponibilità dei dispositivi. Ripartizione indicativa: 4–6 giorni per Q01–Q04, 3–5 per Q05–Q07, 3–5 per Q08–Q10, 3–4 per Q11 e correzioni emerse. La somma delle fasce è 13–20; le attività documentali si svolgono anche durante gli altri task, evitando doppio conteggio.

Rivalutare la stima dopo Q01 e dopo il primo E2E con service worker. Se resta l'obiettivo operativo del 25 ottobre riportato nei documenti di release, confrontare subito capacità effettiva e calendario: questa stima non garantisce il rispetto della data. Proteggere il tempo di collaudo e trattare eventuali riduzioni di ambito come decisioni esplicite.

- [ ] Q01 Ambiente e test riproducibili
- [ ] Q02 Sessioni e operazioni asincrone
- [ ] Q03 Modifica e salvataggio dei voti
- [ ] Q04 Nome utente nel Magic Link
- [ ] Q05 Classifica completa e comprensibile
- [ ] Q06 Regole sensoriali condivise
- [ ] Q07 Contratti e diagnostica
- [ ] Q08 CI e verifiche integrate
- [ ] Q09 Documentazione autorevole
- [ ] Q10 Pulizia motivata del repository
- [ ] Q11 Collaudo e rilascio
