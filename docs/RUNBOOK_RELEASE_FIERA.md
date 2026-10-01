# Sovranaturale — procedura di rilascio e collaudo

Questa procedura completa il [piano qualità corrente](PIANO_QUALITA_SOFTWARE.md). Lo [stato della release di settembre](STATO_RELEASE_SOVRANATURALE.md) è una prova storica: verificare ambiente, migrazioni applicate e dati evento prima di ogni nuovo rilascio.

## Comandi disponibili

```text
npm ci
npm run prisma:validate
npm run check
npm run vercel-build
npm run release:check
npm run dev
```

`release:check` fallisce finché mancano variabili di produzione o la privacy è in bozza. È un blocco voluto. La build Vercel di produzione esegue automaticamente questo controllo; quella locale e la preview possono essere preparate prima. `npm run dev` costruisce i file pubblici e ascolta solo su `127.0.0.1:3000`. Per una prova LAN autorizzata impostare `HOST=0.0.0.0` e usare la rete di collaudo. Il vecchio processo di sviluppo eventualmente già aperto va riavviato dall’operatore per usare il nuovo codice.

`npm run test:db` richiede `TEST_DATABASE_URL` esplicita, PostgreSQL su loopback e un database dedicato con nome che termina in `_test`; non legge `.env`. Crea uno schema temporaneo `wine_check_*`, applica le migrazioni, verifica salvataggi/AI/classifica/Magic Link e rimuove quello stesso schema. Richiede permesso di creare schemi. Produce `output/quality/db-tests.json`, senza modificare i report storici. La CI fornisce PostgreSQL 16; il [README](../README.md#database) contiene il comando PowerShell locale.

## 1. Ambiente pubblico di collaudo

- Collegare l’account/team Vercel appropriato. Il codice è un’app statica con funzioni Node, non Next.js: output `dist`, build `npm run vercel-build`, Node 22.
- Usare le variabili server indicate in `.env.example`. Non pubblicare `.env`, cookie di collaudo, chiavi Supabase secret, token Redis o Gemini. Sono esclusi dal caricamento tramite `.vercelignore`.
- Impostare `DATABASE_URL` con pooler e `DIRECT_URL` adatta alle migrazioni del progetto di staging. Applicare le migrazioni con `prisma migrate deploy`, senza `reset` o `db push --accept-data-loss`.
- Caricare evento di collaudo, almeno due vini e relative righe `EventWine`. Stato esatto `active`, periodo comprendente l’orario della prova; `ACTIVE_EVENT_ID` uguale all’ID dell’evento.
- Configurare origine HTTPS in `APP_ORIGIN`. Catalogo di produzione e API rifiutano link a un evento diverso da quello configurato.
- Verificare limite e numero di bundle finali delle funzioni, inclusa `/api/health`, ora non esclusa da `.vercelignore`. Verificare che il bundle DNA contenga `src/domain/sensory.mjs` e il client Prisma generato. La build statica locale non certifica il packaging Vercel.

## 2. Email e accesso

Il codice chiama Supabase Auth, non un servizio SMTP direttamente. Nel pannello del progetto verificare Authentication → Email/SMTP, template, URL e Rate Limits.

1. Identificare/configurare il provider SMTP, il mittente verificato e le impostazioni DNS richieste dal provider. Provare caselle esterne al team Supabase, su più fornitori.
2. Template OTP con il codice `{{ .Token }}`; controllare durata e formato. Il form accetta 6–8 cifre. Preferire il codice al link per mantenere il browser aperto dall’ingresso/NFC.
3. Dimensionare le quote partendo da **600 nuovi accessi/ora più reinvii e margine**. Una soglia di collaudo proposta è almeno 1.200 email/ora e 3.000 nel giorno, da concordare con il fornitore e verificare nei limiti effettivi.
4. Impostare la nuova `SUPABASE_SECRET_KEY` sul server e abilitare il forwarding IP nel progetto. La chiave publishable e le vecchie chiavi anon/service-role non sono equivalenti per questa funzione. Verificare che il provider non raggruppi tutto il traffico nell’IP del server.
5. Provare: nuovo utente, utente già registrato, codice errato/scaduto, reinvio, refresh pagina, sessione scaduta, logout e cambio account. Il campo email è in sola lettura nel profilo.

Obiettivo proposto: almeno il 95% dei codici di prova ricevuti entro 60 secondi, senza dover cercare nello spam. È un criterio da misurare, non un risultato già ottenuto. Evitare test massivi di invio senza destinatari di collaudo e quote concordate.

## 3. Classifica e AI

Classifica: inizialmente nessuna pubblicazione del profilo. Impostare nickname e checkbox, salvare, verificare da un secondo account; nome reale ed email non devono comparire automaticamente. Un secondo voto sullo stesso vino non deve incrementare il conteggio. Ritirare la partecipazione e verificare una nuova risposta: il nickname deve sparire. Una pagina già aperta può contenere dati precedentemente caricati.

AI: impostare `AI_ENABLED=true`, `GEMINI_API_KEY`, `GEMINI_MODEL` e Redis. Il modello di esempio è `gemini-3.8-flash`; prima del deploy verificare disponibilità e quote dell’account. La generazione invia solo numero di vini, medie sensoriali ed emozioni; controllare le condizioni del piano Google e completare l’informativa.

Provare una generazione reale, due richieste simultanee identiche, nuova generazione dopo modifica del voto, provider lento/non disponibile e budget esaurito. Il timeout e il riepilogo descrittivo devono evitare il blocco del passaporto. Non contare il fallback come successo della prova del provider. Il tetto applicativo di 4.000 tentativi in 24 ore non sostituisce un limite di spesa e gli allarmi del servizio Google.

## 4. Carico dello staging

L’harness `scripts/load-staging.cjs` verifica i codici HTTP e il contenuto dei salvataggi: un errore 400/401/429/500 fa fallire il flusso. Controlla anche che un replay non crei un secondo assaggio.

Preparare un file locale `collaudo.sessions.json` con sessioni di utenti sintetici distinti, ottenute tramite il flusso di accesso dello staging:

```json
[{ "cookie": "cookie della sessione di collaudo, inclusi accesso e CSRF" }]
```

Il file contiene credenziali: è escluso da Git e non va allegato al report. Impostare nell’ambiente della shell:

```text
LOAD_TEST_ENVIRONMENT=staging
LOAD_TEST_URL=https://indirizzo-del-collaudo
LOAD_TEST_EVENT_ID=uuid-evento-di-collaudo
LOAD_TEST_SESSIONS_FILE=percorso-locale/collaudo.sessions.json
LOAD_TEST_ARRIVALS=300
LOAD_TEST_INTERVAL_MS=6000
```

Eseguire `npm run load:staging`: 300 nuovi visitatori distribuiti su circa 30 minuti, equivalenti a 600/ora. Ripetere con margine, ad esempio intervallo 2.000 ms per un carico triplo più breve. Servono sessioni distinte sufficienti, senza cookie scaduti. Le sessioni non vengono rinnovate automaticamente dall’harness: la scadenza deve essere considerata nel test.

Il flusso comprende catalogo, assaggi, salvataggio, replay e classifica. L’AI è esclusa per impostazione predefinita; `LOAD_TEST_AI=true` la include e può consumare quota reale. OTP e rendering mobile richiedono prove separate. Il test non copre ancora tutto il traffico degli utenti che restano in fiera e assaggiano più vini: aggiungere questo scenario alla prova di capacità prima del via libera.

L’harness applica una soglia severa: nessun flusso fallito e p95 per endpoint ≤ 3 secondi. Se si include l’AI, usare un profilo di latenza AI concordato separatamente, perché il suo timeout è superiore. Questa soglia non è stata misurata sull’hosting finale. Non usare il vecchio report Artillery come certificazione: conteneva salvataggi falliti non conteggiati correttamente.

## 5. Prova sul posto e go/no-go

Preparare QR ingresso `https://indirizzo/?eventId=UUID`, tag e QR di riserva per bottiglia `https://indirizzo/?eventId=UUID&vino=ID`. I tag già provati dall’organizzatore restano un buon punto di partenza; la nuova prova serve a validare URL e sessioni definitivi.

Su iPhone/Safari e Android/Chrome, usando dati mobili: ingresso → nome/email → codice → NFC → scheda corretta → emozione e intensità → salvataggio → seconda bottiglia → passaporto → classifica → Wine DNA → condivisione. Provare anche email aperta in un’altra app, browser interno del lettore QR, schermo piccolo, tastiera aperta, ritorno dopo blocco schermo e un’interruzione breve della rete. La connettività prevista a Bari non elimina la necessità di provare questi passaggi.

Chiudere le schede vecchie prima della prova finale di una nuova build. Non fare aggiornamenti applicativi durante la fiera salvo necessità.

Per il 22 ottobre: informativa completa, contatto attivo, catalogo reale, orari confermati, SMTP e AI reali provati, carico accettato, ripristino dimostrato. Gli orari 10–20 nel file draft non autorizzano l’apertura al pubblico.

## 6. Durante la fiera e incidenti

- Tenere aperti monitor dell’URL pubblico, `/api/health`, log applicativi, Supabase Auth/SMTP e utilizzo Gemini/Redis. Il controllo health verifica database, evento e colonne necessarie; **non prova consegna email, budget AI o disponibilità Redis**.
- Definire un sostituto raggiungibile e tenere accessibili i pannelli con gli account corretti. Non annotare segreti nel runbook.
- In caso di guasto al database/accesso: impostare `MAINTENANCE_MODE=true` e applicare il nuovo ambiente con un deploy. Le API protette e gli ingressi principali rispondono 503 con messaggio e Retry-After. Avvisare lo stand. Verificare il comportamento prima della fiera.
- In caso di solo guasto AI: `AI_ENABLED=false` e redeploy; il passaporto continua e il DNA mostra il riepilogo descrittivo. Ripristinare e collaudare prima di riattivare l’AI.
- Per un difetto introdotto da un deploy: promuovere la versione precedente verificata, ricontrollare variabili e compatibilità dello schema. Le migrazioni aggiunte sono additive; non cancellare tabelle o assaggi come metodo di rollback.
- Per recupero dati: ripristinare il backup in un database separato, verificare evento/utenti/assaggi e solo dopo pianificare il cambio di connessione. Non improvvisare il restore sul database attivo.
- Dopo l’evento: chiudere i salvataggi modificando stato o periodo, seguire la conservazione concordata, gestire richieste di accesso/cancellazione. Non usare la raccolta email come consenso implicito al marketing.

Il vecchio `DR_RUNBOOK.md` cita Anthropic: per questa release il provider implementato è Gemini e vale la procedura qui sopra.
