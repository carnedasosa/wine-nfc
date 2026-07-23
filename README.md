# Vino Passport 🍷

Vino Passport è un'applicazione web-app pensata per le fiere e le degustazioni di vino. Tramite tap NFC sulle bottiglie, i partecipanti possono registrare le loro impressioni sensoriali e generare un profilo "Wine DNA" unico grazie all'intelligenza artificiale di Claude.

## Funzionalità Principali

- **Integrazione NFC**: Tocca il tag NFC sulla bottiglia per aprire direttamente la scheda vino sul tuo smartphone.
- **Valutazione Sensoriale**: Sliders per Acidità, Corpo e Persistenza, con selezione delle emozioni.
- **Wine DNA**: Una volta registrati gli assaggi, l'applicazione genera un "DNA del Vino" personalizzato utilizzando l'API di Anthropic (Claude Sonnet 3.5/4.6).
- **Condivisione Social**: Generazione di grafiche ottimizzate per Instagram Stories.
- **PWA Ready**: Supporto manifesto e service worker per l'installazione su home screen e graceful degradation offline-first.

## Stack Tecnologico

- **Frontend**: HTML5, CSS3 (Vanilla), Vanilla JS.
- **Backend**: Express.js (dev) / Vercel Serverless Functions.
- **Database**: PostgreSQL (Supabase) con Prisma ORM.
- **AI**: Anthropic API.
- **Test**: Vitest.

## Setup Iniziale

1. **Installa le dipendenze**:
   ```bash
   npm install
   ```

2. **Configurazione Ambiente**:
   Copia il file `.env.example` in `.env` e inserisci le tue credenziali per:
   - `DATABASE_URL` e `DIRECT_URL` (PostgreSQL)
   - `ANTHROPIC_API_KEY` (per generare i testi del Wine DNA)

3. **Inizializzazione Database**:
   ```bash
   npx prisma db push
   npm run prisma:seed
   ```

## Sviluppo Locale

Avvia il server di sviluppo:
```bash
npm run dev
```

Il server sarà accessibile su `http://localhost:3000` (e sul tuo IP locale per i test da mobile).

## Testing

Esegui i test di validazione backend:
```bash
npm test
```

## Guida al Testing NFC

Consulta il file `NFC_TESTING_GUIDE.md` per imparare a simulare e programmare tag NFC per l'applicazione.
