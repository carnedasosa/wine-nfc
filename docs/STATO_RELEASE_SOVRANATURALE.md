# Sovranaturale — stato dopo le correzioni

Aggiornamento del 29 settembre 2026, successivo al report iniziale. Fiera del 25 ottobre 2026 a Bari, 1.500–2.000 visitatori, picco atteso 600 ingressi/ora. Responsabile operativo: tu, come confermato. **La prima release comprende classifica e Wine DNA con AI**, come richiesto.

## La risposta in pratica

**Il progetto è stato corretto e collaudato nelle sue parti principali, ma non è ancora pronto per l’apertura al pubblico.** Non esiste ancora un deploy pubblico verificato. Le correzioni sono nel progetto locale; le tre migrazioni additive sono state applicate anche al database Supabase configurato. Per il via libera restano configurazione dei servizi, dati reali dell’evento, privacy e prove sull’ambiente pubblico.

Non ho acquistato domini o piani, creato account, inviato email ai visitatori o dichiarato operativa un’AI senza chiave e quota verificate.

## Cosa è stato fatto

| Area | Risultato concreto |
|---|---|
| Evento e NFC | Il parametro dell’evento sopravvive all’apertura del vino e al reload. Catalogo, assaggi, classifica e DNA sono separati per evento. Un voto viene rifiutato se il vino non appartiene all’evento, è disattivato oppure l’evento non è aperto. |
| Salvataggi | Registro persistente delle richieste, transazione serializzabile e versione del voto. Due invii uguali producono un solo risultato. Un retry precedente non sovrascrive una modifica successiva. Un conflitto richiede di ricaricare i dati. |
| Interfaccia dei voti | Recupera i valori salvati, blocca il doppio invio, mantiene la stessa chiave nei retry e non dichiara salvato un voto senza conferma del server. |
| Offline | Disabilitata la vecchia sincronizzazione automatica, che non distingueva il proprietario dei dati. Senza rete si mantiene la scheda aperta e si riprova. Le vecchie code locali non vengono inviate con un altro account. |
| Classifica | Solo per utenti autenticati, riferita all’evento, con nickname e partecipazione facoltativa nelle impostazioni. Il ritiro rimuove il partecipante dalle nuove risposte del server. Nessuna email o nome del profilo viene usato automaticamente come nickname. Risposte private senza cache condivisa. |
| AI | Modello configurabile, timeout di 8 secondi, cache persistente, coordinamento tra richieste concorrenti e limite di 4.000 tentativi di generazione per evento in 24 ore, modificabile. Al modello vengono passate medie ed emozioni, non nome/email/ID dell’utente. |
| DNA senza provider | Un errore o budget esaurito produce un riepilogo descrittivo, chiaramente distinto dall’AI. La cache permette un nuovo tentativo dopo un minuto; resta applicato anche il limite per utente. I testi non spacciano le intensità per preferenze dimostrate. |
| Accesso email | Identificato il servizio: **Supabase Auth**. Verifica OTP con tipo `email`, limite anche per email nei tentativi di verifica, soglie IP più adatte alle reti mobili condivise. Predisposto inoltro dell’IP tramite nuova secret key Supabase, solo lato server. |
| Rate limiting | In produzione, Redis assente o non disponibile restituisce un errore temporaneo: non viene usato un contatore locale che si azzera tra istanze. |
| Pubblicazione | Build in `dist` con soli file pubblici. Il server locale non pubblica più l’intero repository. Endpoint di mock escluso dal caricamento Vercel e rifiutato sui deploy. Client Prisma generato in percorso dedicato e incluso nelle funzioni. |
| Aggiornamenti app | Cache del service worker legata al contenuto della build, nessuna cache API, nessun reload forzato mentre si vota. L’aggiornamento si attiva alla chiusura delle vecchie schede. |
| Operatività | Endpoint `/api/health`, modalità manutenzione, workflow CI, controllo configurazione e harness di carico per staging. Il controllo impedisce una build Vercel di produzione con configurazione incompleta o privacy ancora in bozza. |
| Mobile e accessibilità | Pannello impostazioni scorrevole sui telefoni piccoli, focus limitato al dialogo, schermate sottostanti non interagibili mentre è aperto, etichette dei controlli e contenuti nascosti esclusi dall’albero di accessibilità. |
| Funzioni simulate | Nascosti simulatore NFC e contatti cantina non implementati; eliminata la falsa conferma di invio. |

La classifica conta **vini diversi con una scheda salvata**, non quantità bevute. Non certifica il contatto fisico con una bottiglia e non è un sistema antifrode per concorsi a premio. Il client può mantenere una risposta di classifica fino a 30 secondi; il ritiro è immediato nelle nuove risposte API.

## Prove effettivamente eseguite

- **74 test automatici superati su 74**, inclusi i controlli su autenticazione, CSRF, validazione, rate limiting, link NFC, retry e vecchie code offline.
- **Build Vercel locale riuscita** e schema Prisma valido. Questo non equivale a un deploy riuscito sulla piattaforma.
- **Audit npm: zero vulnerabilità segnalate**, comprese dipendenze di sviluppo, alla verifica finale. Aggiornamenti mirati e override documentati in `package.json`; nessun downgrade forzato di Prisma.
- **PostgreSQL reale, schema temporaneo isolato:** installazione da zero delle migrazioni; invii simultanei identici; retry vecchio dopo una modifica; proprietario errato; versione obsoleta; vino disabilitato; evento chiuso; una sola chiamata AI simulata per due richieste concorrenti; risposta descrittiva quando il budget termina.
- **API reali e database:** classifica assente prima del consenso, comparsa del solo nickname, conteggio corretto, ritiro e intestazioni senza cache condivisa.
- **Browser a 390 × 844:** profilo, opt-in e nickname, classifica, modifica del voto, persistenza al reload, Wine DNA descrittivo, preparazione immagine e aggiornamento della versione dopo chiusura della scheda. Nessun errore o avviso nella console osservata. L’accesso era una sessione sintetica di collaudo: **non è una prova di ricezione OTP**.
- **Perimetro HTTP locale:** `/lib/supabase-auth.js`, `/prisma/schema.prisma`, `/docs/DR_RUNBOOK.md` e `/package.json` restituiscono 404; `/api/health` restituisce 200 sul database di collaudo pronto.

Le risposte del provider AI sono state simulate nel test concorrente. La chiamata reale a Gemini e il comportamento su Safari/iPhone, Chrome/Android e reti mobili reali devono ancora essere collaudati.

## Stato del database del progetto

Applicate con `prisma migrate deploy`: `m3_dna_profile`, `m4_tasting_requests`, `m5_dna_generation_lease`. Tutte e cinque le migrazioni risultano completate. Il numero di record preesistenti è rimasto invariato: **4.566 utenti, 6 vini, 782 assaggi**. Non sono stati eliminati dati dimostrativi o utenti.

Le nuove tabelle non concedono lettura ai ruoli Supabase `anon` e `authenticated`; l’accesso avviene tramite il backend. La RLS non è stata attivata: i privilegi effettivi sono stati verificati, senza presentare la sola assenza di RLS come prova di esposizione.

La migrazione `0_init` era UTF-16: la codifica è stata convertita in UTF-8 senza cambiare il SQL, per consentire l’installazione su un database vuoto. Il checksum del file cambia: conservare questa nota nella storia del rilascio e non eseguire reset o risoluzioni arbitrarie delle migrazioni già applicate.

Evidenze tecniche in `docs/audit-2026-09-29/remediation-db-tests.json` e `remediation-database-state.json`.

## Cosa manca per andare in produzione

| Blocco | Azione necessaria | Quando considerarlo chiuso |
|---|---|---|
| Hosting pubblico | Collegare il progetto al corretto account/team Vercel e scegliere un piano adatto all’uso della fiera. Il connettore non ha restituito team disponibili nella verifica precedente. | Preview funzionante, build piattaforma riuscita e ambiente produzione configurato. |
| Numero funzioni | Il progetto ha 13 handler distribuibili, escluso il mock. Il runtime senza bundling può superare il limite Hobby documentato di 12. | Piano compatibile oppure consolidamento delle funzioni prima del deploy, verificato con il build output reale. |
| URL definitivo | Inizialmente basta anche un indirizzo Vercel stabile; il dominio personalizzato del sito non è obbligatorio. Serve invece un mittente email verificato adeguato al servizio SMTP scelto. | QR di ingresso e tag NFC puntano allo stesso indirizzo HTTPS, con evento corretto e redirect Auth coerenti. |
| SMTP | Aprire Supabase → Authentication → Email/SMTP. Identificare o configurare il provider, verificare il mittente e i limiti. Non è possibile dedurre dal codice se lo SMTP personalizzato sia già attivo. | Invio a caselle esterne al team, codici corretti, assenza di blocchi inattesi e capacità adeguata al picco. |
| Quote Supabase | Configurare email, OTP, verifica e IP forwarding nel pannello. Impostare `SUPABASE_SECRET_KEY` soltanto sul server. | Prova con più utenti e IP condiviso, senza bloccare il flusso all’ingresso. |
| Redis | Configurare URL e token Upstash nell’ambiente di deploy. | Limiti realmente condivisi tra istanze; errore del provider gestito e ripristino provato. |
| AI reale | Configurare chiave, modello abilitato nell’account, quote, condizioni di trattamento e limite di spesa del provider. | Testo generato realmente, timeout/fallback provati, costo del carico accettabile. |
| Evento e catalogo | Inserire evento reale, orari confermati, stato `active`, vini effettivi e relative associazioni. Impostare `ACTIVE_EVENT_ID`. | Ogni etichetta fisica apre il vino giusto; non compaiono vini dimostrativi o di altri eventi. |
| Privacy e contatti | Fornire titolare/organizzatore e email di assistenza/privacy; definire basi giuridiche, conservazione, diritti, fornitori e condizioni AI. | Informativa completa, flusso esaminato e procedura operativa di esportazione/cancellazione provata. |
| Backup e ripristino | Attivare un backup adeguato e provarne il recupero su un database separato. | Ripristino riuscito e tempo necessario noto, con accesso disponibile al responsabile. |
| Carico | Eseguire il collaudo su staging rappresentativo dell’hosting finale. | Dati persistiti correttamente, errori e latenza entro le soglie concordate. |
| Telefoni reali | Provare QR → OTP → bottiglia → voto → ritorno → classifica → AI su iPhone e Android. | Nessuna perdita di evento o sessione anche tra browser email/QR/NFC; immagini condivisibili e testo leggibile. |
| Gestione fiera | Monitor, allarmi, accessi ai pannelli, un sostituto contattabile e prova della procedura di manutenzione/rollback. | Tu riesci a individuare e contenere un problema durante la prova generale. |

Gli orari **10:00–20:00 del 25 ottobre** sono fittizi e sono stati inseriti esclusivamente in `config/sovranaturale.draft.json`, con stato `draft` e flag `orariProvvisori: true`. Non vengono spacciati per orari ufficiali e non sono stati applicati al database.

La scelta di includere AI e classifica è rispettata: il fallback AI serve durante un guasto, **non sostituisce il collaudo dell’AI richiesto per il via libera**.

## Come procedere, nell’ordine

1. **Account e mittente:** collegare Vercel, aprire la configurazione Supabase SMTP e predisporre mittente, Redis e Gemini. Non inviare chiavi o password in chat: inserirle nelle variabili server dei servizi.
2. **Preview privata:** impostare le variabili di `.env.example` per l’ambiente di collaudo e un evento separato aperto durante le prove. Usare un database/staging separato dai dati reali.
3. **Contenuti definitivi:** completare catalogo, orari e privacy. L’indirizzo pubblico può essere scelto dopo il primo deploy, ma deve diventare stabile prima di programmare definitivamente QR e tag.
4. **Collaudo:** seguire `docs/RUNBOOK_RELEASE_FIERA.md`, compresi OTP reali, AI reale, carico e ripristino.
5. **Entro il 22 ottobre:** prova generale e decisione finale. Il 24 ottobre bloccare modifiche non essenziali e ricontrollare tutti i collegamenti fisici. Il 25 aprire i pannelli e verificare servizi e mittente prima dell’ingresso del pubblico.

## Fonti ufficiali per le configurazioni da chiudere

Il servizio SMTP predefinito Supabase è limitato ai destinatari del team e a due email/ora; il custom SMTP e le sue quote vanno quindi verificati sul progetto: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp). L’inoltro IP richiede una nuova secret key e configurazione del servizio: [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).

Il modello di esempio `gemini-3.8-flash` risulta stabile nella documentazione verificata; disponibilità, quote e costi dell’account restano da verificare: [Google Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash). Il limite funzioni dipende dal runtime/bundling e dal piano: [Vercel runtimes](https://vercel.com/docs/functions/runtimes).
