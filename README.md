# Vino Passport 🍷

Vino Passport è una web app per fiere e degustazioni: il partecipante apre una scheda vino tramite NFC, registra le impressioni sensoriali, consulta la classifica e genera il proprio Wine DNA.

## Stack

- frontend: HTML, CSS e JavaScript nativo;
- API: Vercel Serverless Functions, con Express per lo sviluppo locale;
- database: PostgreSQL/Supabase tramite Prisma;
- identità: Supabase Auth con codice email OTP;
- rate limit: Upstash Redis REST in produzione;
- test: Vitest.

## Installazione

```bash
npm install
```

Copia `.env.example` in `.env` e configura almeno:

- `DATABASE_URL` e `DIRECT_URL`;
- `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY`;
- `APP_ORIGIN`, origin esatto dell’applicazione, senza slash finale;
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` e preferibilmente `RATE_LIMIT_KEY_SECRET` in produzione;
- `ANTHROPIC_API_KEY`, se il Wine DNA AI deve essere attivo.

`SUPABASE_ANON_KEY` resta supportata solo per compatibilità con progetti Supabase legacy. Non usare mai una secret key o una service-role key nel browser o al posto della publishable key.

Per test da telefono sulla LAN, `APP_ORIGIN` accetta una lista separata da virgole, ad esempio:

```dotenv
APP_ORIGIN=http://localhost:3000,http://192.168.1.20:3000
```

In produzione, l’assenza di `APP_ORIGIN` o dello storage Upstash blocca le operazioni protette: il sistema fallisce in modo chiuso.

## Configurazione Supabase Auth

1. Abilita il provider Email in Supabase Auth.
2. Imposta Site URL e redirect consentiti sull’origin dell’app.
3. Personalizza il template Magic Link affinché mostri il codice OTP, includendo `{{ .Token }}` nel corpo dell’email.
4. Configura un provider SMTP adatto alla produzione e verifica dominio, deliverability e quote prima dell’evento.
5. Mantieni l’access token breve; il valore Supabase predefinito di un’ora è compatibile con i cookie applicativi.

Il browser non riceve mai i token in JSON. Access token e refresh token sono conservati in cookie `HttpOnly`, `Secure` in produzione e `SameSite=Lax`; in produzione usano il prefisso `__Host-` per impedire override da sottodomini. Il cookie access segue la scadenza Supabase fino a un massimo di un’ora, mentre il cookie refresh resta nel browser per 30 giorni. Il token CSRF leggibile viene ruotato a login e refresh. I vecchi JWT proprietari e gli header bearer non sono più accettati, e le relative chiavi `localStorage` vengono eliminate all’avvio e a ogni uscita dalla sessione.

La revoca globale elimina la capacità di rinnovare la sessione, ma un access JWT già emesso può restare valido fino alla propria scadenza: l’SLA adottato da M1 è quindi al massimo un’ora. Supabase ruota i refresh token, ma per resilienza ammette normalmente una finestra di riuso breve (10 secondi di default) e il recupero del parent token attivo; non va descritta come garanzia di single-use assoluto. Prima del go-live verifica nelle impostazioni Auth che rotazione e rilevamento del riuso siano attivi e che questi compromessi siano accettabili per l’evento.

## Rollout dello schema M1

M1 aggiunge `User.authSubject`, identificatore immutabile del provider. Il database esistente non ha ancora una baseline Prisma Migrate: per non anticipare M2, l’aggiornamento additivo è contenuto in un DDL isolato e idempotente.

Prima del deploy, fai revisionare il DDL e applicalo consapevolmente all’ambiente corretto:

```bash
npx prisma db execute --file prisma/m1-auth-subject.sql --schema prisma/schema.prisma
npx prisma generate
```

Non usare `prisma db push` sul database reale. L’ordine di rollout è:

1. backup/verifica dell’ambiente target;
2. applicazione di `prisma/m1-auth-subject.sql`;
3. deploy del codice M1;
4. smoke test OTP → sessione → assaggio → logout.

Al primo OTP valido, un profilo legacy viene collegato automaticamente solo se esiste una singola corrispondenza case-insensitive dell’email e non è già collegata a un altro subject. Ogni conflitto viene chiuso senza takeover e richiede risoluzione manuale.

## Rate limit

Valori predefiniti:

| Profilo | Limite |
|---|---:|
| richiesta OTP per email | 3 / 15 minuti |
| richiesta OTP per IP | 5 / 15 minuti |
| verifica OTP per IP | 10 / 15 minuti |
| assaggi per utente | 30 / minuto |
| Wine DNA per utente | 3 / 10 minuti |
| leaderboard per IP | 60 / minuto |

Ogni profilo è sovrascrivibile con `RATE_LIMIT_<PROFILO>` e `RATE_LIMIT_<PROFILO>_WINDOW_SECONDS`. Il limite IP OTP predefinito è prudenziale ma può essere inadatto a una fiera con molti telefoni dietro lo stesso NAT: collaudalo e alzalo in modo esplicito, mantenendo il limite per email come controllo primario. Anche le quote Supabase Auth e SMTP devono essere dimensionate per l’affluenza prevista.

I primi blocchi di ogni finestra e le indisponibilità fail-closed producono log JSON con `type=security.rate_limit` ed evento `blocked` o `unavailable`. Non contengono IP, email, subject o chiavi Redis. In produzione configura sul provider di log almeno due alert: picco di `blocked` per profilo e presenza di qualunque `unavailable`; il secondo richiede intervento immediato perché le route limitate rispondono `503` finché Upstash non torna disponibile.

## Sviluppo e verifica

```bash
npm run dev
npm test
npm run prisma:validate
```

Il server locale è disponibile su `http://localhost:3000`. Le API accettano body JSON fino a 16 KiB e restituiscono errori strutturati senza stack, token, OTP o subject provider.

## Perimetro attuale

Questo repository include gli interventi M1: identità verificata, lifecycle sessione, CSRF/origin, validazione centralizzata, rimozione dei sink XSS, CSP/security headers e rate limiting condiviso. Non equivale ancora alla certificazione di capacità per 1.000 partecipanti: integrità dati/eventi, Wine DNA server-derived, cache/offline, osservabilità e load test appartengono alle milestone successive descritte in `IMPLEMENTATION_PLAN.md`.

Per i test NFC consulta `NFC_TESTING_GUIDE.md`.
