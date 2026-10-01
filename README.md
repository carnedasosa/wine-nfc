# Sovranaturale — Passaporto del vino

App per eventi e degustazioni: apertura della scheda via NFC, registrazione delle intensità sensoriali, classifica facoltativa e Wine DNA con storia esportabile.

## Riferimenti correnti

- [Piano qualità e avanzamento](docs/PIANO_QUALITA_SOFTWARE.md): interventi, dipendenze, verifiche eseguite e attività residue.
- [Runbook di rilascio](docs/RUNBOOK_RELEASE_FIERA.md) e [ripristino](docs/DR_RUNBOOK.md): operazioni sull'ambiente target.
- [Guida NFC](NFC_TESTING_GUIDE.md).

`IMPLEMENTATION_PLAN.md` e i report di settembre conservano evidenze storiche. Non attestano lo stato dell'ambiente remoto oggi. Le modifiche locali non equivalgono a una release pubblicata o a un collaudo dei provider.

## Setup

Usare Node.js **22.13 o successivo nella serie 22** e npm. Le dipendenze sono bloccate dal lockfile; il requisito minimo comprende i controlli statici ([requisiti ESLint](https://eslint.org/docs/latest/use/migrate-to-10.0.0)).

```sh
npm ci
```

L'installazione genera il client Prisma in `generated/prisma`. Copiare `.env.example` in `.env` e configurare database di sviluppo, Supabase Auth e `APP_ORIGIN`. Non committare credenziali. Per avviare:

```sh
npm run dev
```

Il server Express serve solo `dist` su `http://localhost:3000`; la build precede l'avvio. Dopo una modifica al frontend eseguire nuovamente `npm run build`. Il service worker può mantenere la build precedente fino alla chiusura di tutte le schede dell'app.

Per provare la sola UI con dati sintetici, senza `.env`, database o provider:

```sh
npm run test:preview
```

Aprire `http://127.0.0.1:4174/?eventId=fixture-event`. Questa fixture non verifica le API reali né l'autenticazione.

## Configurazione

| Variabile | Uso |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Connessione runtime e connessione diretta per le migrazioni |
| `APP_ORIGIN` | Origin consentiti, separati da virgole; includere quelli LAN per prove da telefono |
| `ACTIVE_EVENT_ID` | Evento attivo configurato esplicitamente per la release |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Provider email OTP; `SUPABASE_ANON_KEY` è solo un fallback legacy |
| `SUPABASE_SECRET_KEY` | Solo server, per inoltro IP se abilitato nel provider |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `RATE_LIMIT_KEY_SECRET` | Contatori condivisi e pseudonimizzazione degli identificatori |
| `AI_ENABLED`, `GEMINI_API_KEY`, `GEMINI_MODEL` | Abilitazione esplicita, chiave e modello accessibile al proprio account |
| `MAINTENANCE_MODE` | Blocco temporaneo delle route protette e health non pronto |

In produzione origin o Redis mancanti bloccano le operazioni protette. La configurazione del modello nel repository non dimostra disponibilità o quota del provider: verificarle nel collaudo di staging.

In Supabase abilitare Email, redirect autorizzati e un template con `{{ .Token }}` per mostrare l'OTP. Verificare SMTP, consegna e limiti con il runbook. È supportato anche lo scambio di Magic Link: il frammento viene consumato e rimosso dall'URL. Il nome già scelto viene preservato; la verifica OTP con nome esplicito mantiene il proprio comportamento.

Sessioni con cookie HttpOnly, controllo origin/CSRF, identità derivata dal server. Il browser conserva solo stato volatile e preferenze non sensibili della storia. Il segnale fra schede contiene un identificatore casuale, senza token o profili. Il logout dipende dalla risposta del server: la sola cancellazione della UI non revoca una sessione.

## Database

Lo schema usa **Prisma Migrate**; `prisma/migrations` è la storia autorevole. `prisma/m1-auth-subject.sql` è un documento di transizione storico, non un passo del setup corrente. Non usare `db push`, reset o ricreazione della baseline sul database applicativo. Applicare `prisma migrate deploy` soltanto nel processo controllato descritto dal runbook, con ambiente e recupero verificati.

Il test integrato richiede un PostgreSQL locale dedicato, già creato, con nome che termina in `_test`. Non legge `.env` e non usa `DATABASE_URL` come fallback. In PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test:test@127.0.0.1:5432/vino_test'
npm run test:db
```

Il runner accetta solo loopback, crea uno schema casuale, applica le migrazioni, esegue i casi di concorrenza e le route reali, quindi rimuove solo quello schema. I provider sono simulati. Produce `output/quality/db-tests.json`, senza sovrascrivere gli audit storici. Un arresto forzato può lasciare lo schema temporaneo: identificarlo dal log e rimuoverlo nel solo DB di test.

## Verifiche

```sh
npm run check
npm run prisma:validate
npm audit --omit=dev --audit-level=high
```

`check` esegue ESLint sul codice applicativo, TypeScript `checkJs` sullo stato di sessione e sul modulo sensoriale condiviso, Vitest, build e verifica degli import/precache/link dell’artifact. Il controllo dei tipi è intenzionalmente incrementale: non copre ancora tutto il frontend/backend. I test unitari sostituiscono la configurazione locale e rifiutano HTTP non simulato; non richiedono segreti.

La CI aggiunge PostgreSQL 16 temporaneo e `test:db`, quindi conserva le evidenze come artifact. Una configurazione CI aggiunta non è un'esecuzione CI riuscita: lo stato delle prove di questa modifica è nel piano qualità. Restano distinti i test unitari, le prove browser con fixture, l'integrazione DB e il collaudo reale di SMTP/AI/dispositivi.

## Contratti e dipendenze

- **Sessioni:** operazioni asincrone vincolate a generazione, utente ed evento; risposte obsolete non possono aggiornare la UI. Le richieste autenticate inviano `X-Vino-User`: è un vincolo, mai una credenziale. Il server rifiuta con `409 SESSION_CHANGED` una discrepanza rispetto al cookie verificato. Header assente resta compatibile con le app precedenti; queste vanno incluse nel collaudo di aggiornamento.
- **Cookie fra schede:** BroadcastChannel e storage notificano login/logout; Web Locks serializza refresh, login e logout dove disponibile. Una scheda invalidata torna all'accesso e deve ricaricare/verificare la sessione. Nei browser senza Web Locks resta necessario il collaudo degli scambi concorrenti.
- **Voti:** la bozza conserva la versione dei valori effettivamente mostrati. Finché la lettura non riesce, i controlli restano disabilitati. Il retry dello stesso payload conserva la chiave idempotente; il conflitto richiede una ricarica esplicita che sostituisce i valori della bozza. Il server mantiene registro richieste e transazioni serializzabili.
- **Impostazioni:** nome e partecipazione sono due operazioni. Un nome già confermato resta salvato anche se fallisce il consenso; il messaggio e il retry distinguono questo caso.
- **Classifica:** pagine da 50, rank fornito dal server e cache client di 30 secondi per contesto. Solo nickname e consenso esplicito; gli omonimi restano righe distinte. La paginazione a offset è una vista live, non uno snapshot: cambiamenti nel ranking possono spostare righe tra pagine.
- **Sensori:** `src/domain/sensory.mjs` è l'unica implementazione delle medie e dei tag per DNA server/client. Accetta intensità intere 1–5, esclude valori invalidi e restituisce `null` se mancanti; le soglie usano la media non arrotondata. Il server importa ESM da CommonJS. La versione dell'algoritmo entra nella chiave della cache DNA. La storia usa le stesse medie; mantiene l'ordine grafico delle palette per i pareggi delle due emozioni visualizzate.
- **Offline/PWA:** solo asset statici nel precache, nessuna API. Il vecchio modulo outbox resta uno shim senza invii per compatibilità; i dati IndexedDB storici non vengono cancellati. L'attivazione del worker attende la chiusura delle vecchie schede senza forzare reload durante una bozza.
- **Log:** il logger centrale ammette categorie di errore e metriche numeriche; esclude messaggi grezzi dei provider, cookie, body e dati personali. La migrazione di tutta la diagnostica al formato centrale è ancora incrementale.

## Limiti di frequenza

Default dal codice, modificabili con `RATE_LIMIT_<PROFILO>` e `RATE_LIMIT_<PROFILO>_WINDOW_SECONDS`:

| Profilo | Default |
|---|---:|
| OTP email / IP | 3 / 600 in 15 minuti |
| Verifica OTP email / IP | 10 / 1200 in 15 minuti |
| Voto utente | 30 al minuto |
| DNA utente | 3 in 10 minuti |
| DNA evento | 4000 in 24 ore |
| Classifica | 60 al minuto per identità verificata |

Il nome di configurazione storico `LEADERBOARD_IP` è mantenuto per compatibilità, ma la route usa il subject verificato. Quote Supabase, SMTP e AI sono ulteriori vincoli da collaudare. Il riepilogo sensoriale è descrittivo e non deduce preferenze personali; la classifica conta vini distinti con una scheda salvata, non quantità consumate.

## Rilascio

`npm run release:check` verifica la configurazione operativa; `npm run load:staging` richiede ambiente e sessioni di collaudo espliciti. La build pubblica una allowlist di file, rigenera il nome della cache dai contenuti e include la route `/api/health` nel sorgente distribuibile. Verificare il packaging serverless del modulo sensoriale, due versioni consecutive del service worker, iPhone/Safari e Android/Chrome, export PNG 1080×1920, Web Share e fallback download. Nessuno di questi gate si considera superato dal solo `npm test`.
