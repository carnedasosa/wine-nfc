# Disaster Recovery Runbook (Vino Passport)

## 1. Database Down
**Sintomi:** Errori 500 continui sulle API (es. `/api/wines`, `/api/leaderboard`, `/api/tastings`). Log con `PrismaClientInitializationError` o timeout di connessione.
**Azioni:**
- Verificare lo stato del provider del database (es. Supabase status page).
- Se il provider è down, inserire la piattaforma in modalità manutenzione modificando la variabile d'ambiente `MAINTENANCE_MODE=true` su Vercel.
- Informare gli utenti tramite i canali di comunicazione previsti.
- Attendere il ripristino del servizio da parte del provider.
- Se il problema è legato a configurazioni errate (es. password modificata), aggiornare `DATABASE_URL` nelle variabili d'ambiente di Vercel.

## 2. Connection Pool Saturo
**Sintomi:** Log con `PrismaClientKnownRequestError` indicanti che il connection pool ha raggiunto il limite. Latenza estremamente elevata.
**Azioni:**
- Assicurarsi che `lib/prisma.js` includa `connection_limit=1&pool_timeout=10` per gli ambienti serverless.
- Verificare su Vercel se ci sono picchi anomali di traffico o attacchi DDoS; in tal caso, inasprire i limiti nel WAF/Rate Limiting.
- Se il traffico è legittimo ma il DB non supporta abbastanza connessioni, scalare le risorse del database o utilizzare un Connection Pooler esterno (es. PgBouncer o Supabase Connection Pooling - port 6543).
- Aggiornare `DATABASE_URL` per puntare al pooler invece che direttamente al DB.

## 3. Anthropic (AI) Down o Rate Limited
**Sintomi:** Le feature basate sull'IA (es. generazione di consigli personalizzati) falliscono o restituiscono timeout/rate limit error (HTTP 429).
**Azioni:**
- Verificare lo status di Anthropic (https://status.anthropic.com/).
- Se c'è un rate limit, implementare backoff esponenziale.
- Per un'indisponibilità prolungata, far fallback su una cache o messaggi di cortesia lato frontend in cui si invita a riprovare.
- Considerare, in caso di down prolungati, l'uso di un modello di fallback (es. OpenAI).
