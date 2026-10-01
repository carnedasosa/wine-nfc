# Code Audit Report

> Documento storico precedente agli interventi di qualità. Per architettura e procedure correnti usare il [README](README.md) e il [piano qualità](docs/PIANO_QUALITA_SOFTWARE.md). Le valutazioni seguenti conservano il contesto originario e non attestano il codice attuale.

## 1. PANORAMICA DELL'ARCHITETTURA

Il progetto "vino-passport" è strutturato come una Single Page Application (SPA) che si interfaccia con un backend Serverless.
- **Frontend**: Scritto in Vanilla JavaScript, HTML e CSS, senza l'ausilio di framework moderni (come React, Vue o Svelte). È servito come contenuto statico (`dist/`).
- **Backend**: Implementato tramite funzioni serverless deployate su Vercel (`api/**/*.js`), che usano Node.js. In ambiente di sviluppo locale (`dev-server.js`) viene simulato tramite un server Express.
- **Database**: PostgreSQL gestito tramite l'ORM Prisma.
- **Autenticazione**: Delegata a Supabase Auth tramite OTP / Magic Links (passwordless).

**Valutazione Architetturale**: L'architettura backend è moderna, scalabile e appropriata alla dimensione del progetto. Tuttavia, l'architettura del frontend soffre di un marcato **underengineering**: l'uso esclusivo di Vanilla JS per gestire routing, caricamento dati, stato globale e manipolazione del DOM porterà rapidamente a complessità accidentale e problemi di mantenibilità (Spaghetti Code) qualora il progetto dovesse crescere.

## 2. MODULARITÀ

- **Backend**: Presenta un'eccellente separazione delle responsabilità. Le route (`api/`) gestiscono solo il routing e la delega; la logica di business è isolata nel layer `lib/` (es. `tasting-store.js`, `auth.js`, `event.js`); la validazione è centralizzata in `utils/validation.js`. Non ci sono "God Modules" lato server.
- **Frontend**: La modularità è limitata. Sebbene ci sia una divisione in file (es. `router.js`, `state.js`, `ui/*.js`), il file `app.js` tende ad agire come un "God Component", orchestrando in modo imperativo routing, eventi globali, gestione sessione e inizializzazione. Il coupling tra la logica applicativa e il DOM (es. `document.getElementById`) è molto forte.

## 3. MANUTENIBILITÀ

La manutenibilità del progetto è a due facce:
- **Positiva (Backend)**: Naming chiaro, file piccoli, gestione robusta della concorrenza (es. `Serializable` transactions per prevenire race conditions sugli assaggi).
- **Negativa (Frontend)**: Assenza totale di un sistema di tipizzazione (TypeScript). La manipolazione imperativa del DOM unita a uno stato globale mutabile (`state.js`) rende il comportamento del frontend difficile da prevedere in casi limite o in assenza di rete. La complessità accidentale crescerà linearmente con l'aggiunta di nuove schermate.

## 4. PRINCIPI DI SOFTWARE DESIGN

- **Separation of Concerns (SoC)**: Rispettata nel backend, violata nel frontend dove logica di presentazione e business logic convivono o sono strettamente accoppiate.
- **SOLID**: I moduli in `lib/` aderiscono in buona parte alla *Single Responsibility Principle*.
- **DRY (Don't Repeat Yourself)**: Applicato sistematicamente nella validazione (`utils/validation.js`), utilizzata in modo uniforme da tutti gli endpoint.

## 5. SCALABILITÀ DELLA CODEBASE

Mentre l'infrastruttura serverless su Vercel e il database PostgreSQL (con connessioni Prisma gestite per serverless) scalano bene orizzontalmente, la **codebase frontend non è scalabile in termini di estendibilità**. L'aggiunta di flussi complessi (es. paginazione offline, animazioni di transizione stato, form composti) forzerebbe gli sviluppatori a scrivere molto boilerplate per la sincronizzazione del DOM, un problema già risolto dai framework UI moderni (Reactivity).

## 6. SICUREZZA — STANDARD 2026

Il progetto dimostra una fortissima attenzione alla sicurezza, in linea con gli standard più recenti:
- **Protezione OWASP**: L'uso di Prisma mitiga l'SQL Injection.
- **Autenticazione & Autorizzazione**: I JWT emessi da Supabase vengono validati in modo stretto e corretto (controllo su issuer, audience, subject e algoritmi ammessi in `assertVerifiedClaims`). L'endpoint di aggiornamento profilo (`api/users/[id].js`) verifica correttamente che `req.userId === id` prevenendo IDOR (Broken Object Level Authorization).
- **CSRF**: Un token CSRF "Double Submit Cookie" è implementato rigorosamente in `lib/http-security.js` e richiesto per tutti i metodi non sicuri (POST, PUT, ecc.), supportato dall'obbligo di match sull'header `Origin`.
- **Rate Limiting**: Molto avanzato (`lib/rate-limit.js`). Prevede profili differenziati, fallback su memoria se Redis (Upstash) fallisce, e un approccio "Fail Closed" in produzione (per i componenti critici). Previene abusi su OTP e iterazioni di salvataggio.
- **CSP**: Configurata in `vercel.json`, anche se l'utilizzo di `'unsafe-inline'` per lo `style-src` è un rischio minore che potrebbe essere mitigato.
- Nessun mass assignment rilevato grazie alla rigorosa validazione degli input in `utils/validation.js` che accetta solo liste chiuse (allowlist) di campi.

## 7. GESTIONE DEGLI ERRORI

Ottima gestione degli errori in tutto lo stack:
- Frontend: `api.js` incapsula `fetch` e implementa retry esponenziali automatici per endpoint idempotenti, distinguendo fallimenti di rete da limitazioni di rate limit (`429`) e autenticazione (`401`).
- Backend: Error boundaries logici, risposte JSON standardizzate (`code`, `message`, `fields`). Le transazioni database catturano conflitti e deadlock (`P2034`, `P2002`) fornendo feedback accurati.

## 8. GESTIONE DEI DATI

- **Consistenza**: L'implementazione del salvataggio degli assaggi (`lib/tasting-store.js`) usa un meccanismo di Idempotency Key con isolamento di transazione al livello `Serializable`. Questo previene doppi inserimenti o sovrascritture concorrenti (race conditions) perfino a fronte di retry del client.
- **Validazione**: Validazione stretta e normalizzazione (es. trimming di email, normalizzazione di colori esadecimali CSS) è fatta su *tutti* i payload in ingresso.

## 9. API

API pulite e REST-oriented. Rispondono con corretti status HTTP. L'uso sistematico di chiavi di idempotenza su route non sicure (es. POST per `saveTasting`) garantisce operazioni coerenti su connessioni mobili inaffidabili.

## 10. PERFORMANCE

- **Backend**: Nessun problema di n+1 problem query (Prisma fetch in unica query).
- **Frontend**: Il bundle Vanilla JS è estremamente leggero, ma mancano ottimizzazioni tipiche delle moderne SPA (come il prefetching).

## 11. TESTABILITÀ

- I file in `utils/` e `lib/` espongono funzioni pure o testabili tramite iniezione di dipendenze. È presente un'eccellente suite di validazione e sicurezza scritta in Vitest.
- La UI (Vanilla JS) risulta quasi impossibile da "unit-testare" in isolamento senza un vero browser (E2E), a causa del profondo accoppiamento con l'oggetto globale `document` e `window`.

## 12. TYPE SAFETY

**Carenza critica**. Il progetto è scritto interamente in JavaScript (CommonJS lato backend, ESModules lato frontend). Nonostante ci siano alcune annotazioni JSDoc minime, l'assenza di TypeScript nel 2026 aumenta significativamente il rischio di bug da refactoring, typo su chiavi degli oggetti e mismatch di contratti API tra frontend e backend. 

## 13. DIPENDENZE

- Estremamente ridotte. `express` viene usato solo per il dev-server.
- Le uniche librerie reali di produzione sono Prisma (ORM). Non sembrano esserci dipendenze obsolete o inutilizzate. Manca però una chiara separazione tra `dependencies` e `devDependencies` per alcune voci in `package.json` nel caso in cui il build necessiti di altri moduli.

## 14. CONFIGURAZIONE E AMBIENTI

La gestione degli ambienti (Sviluppo vs Produzione) è ben tracciata:
- Il backend implementa protezioni differenziate usando `isProduction()` (es. Cookie Secure flags e HSTS richiesti solo in produzione).
- La gestione dei secret `.env` è standard e priva di hardcoding.

## 15. FRONTEND

Vedi punto 1 e 5. Paradigma imperativo, nessuna modularità basata su componenti (Component-Driven Architecture). Gestione del caricamento (loading) implementata nascondendo/mostrando elementi del DOM. Poca reattività.

## 16. BACKEND

Estremamente solido, strutturato in modo eccellente. 

## 17. DOCUMENTAZIONE E DEVELOPER EXPERIENCE

- Manca documentazione in linea per i flussi complessi.
- Manca TypeScript, riducendo le capacità dell'IntelliSense e l'autocompletamento per i nuovi sviluppatori che devono scoprire lo schema dei dati (es. l'oggetto `vino`).

## 18. TECHNICAL DEBT

- **Mancanza di TypeScript**: (Trasversale) Diminuisce la robustezza dei refactoring. Sebbene validato a runtime, lo schema dei dati non è garantito a compile-time.
- **Architettura Frontend Imperativa**: (`src/app.js`, `src/ui/*.js`) Render e stato non sono sincronizzati automaticamente (come in React). Obbliga lo sviluppatore a fare continui `element.textContent = ...` e `element.classList.toggle(...)`, portando a facili de-sincronizzazioni.

## 19. PUNTI POSITIVI

- **Pattern di Idempotenza e Isolamento**: L'uso della Idempotency Key integrato con Retry-After HTTP è brillante per applicazioni NFC mobile.
- **Difesa in Profondità (Defense-in-Depth)**: Configurazione di rate limiting ibrido (Upstash/Memoria), validazione paranoica degli input, double-submit cookie, Same-Origin protection e JWT verification custom.
- **Nessuna dipendenza frontend**: Questo garantisce caricamenti istantanei per gli utenti in fiera con connettività bassa (Edge case vitale per l'esperienza NFC).

## 20. PROBLEMI RISCONTRATI

### Assenza di un sistema di tipi forte (TypeScript)
**Categoria:** Maintainability / Type Safety
**Severità:** Medium
**File coinvolti:** Tutto il progetto (frontend e backend).
**Problema:** L'intera codebase è scritta in JavaScript. Le strutture dati di passaggio (payload dell'API, ritorni di Prisma, stato del frontend) dipendono dalla deduzione visiva o da run-time checks.
**Perché è importante:** Previene lo scale-up del team e raddoppia i tempi di debug, aumentando le possibilità di refactoring rotti.
**Evidenza:** Nessun file `.ts` o `tsconfig.json`. Manca una definizione formale di cosa sia `state.vinoCorrente`.
**Raccomandazione:** Introdurre gradualmente TypeScript, a partire dalla condivisione dei tipi tra DTO (Data Transfer Objects) frontend e backend.

### Frontend Coupling (Underengineering architetturale)
**Categoria:** Architecture / Frontend
**Severità:** Medium
**File coinvolti:** `src/app.js`, `src/ui/wine.js`, `src/ui/home.js`
**Problema:** Aggiornamento imperativo del DOM mischiato a logica di stato e chiamate API. 
**Perché è importante:** Eventuali bug legati alla mancata pulizia di event listeners, race-conditions sulle transizioni di pagina (già evidenziate da flag come `authTransitionInProgress`) o de-sincronizzazione dei dati visivi peggioreranno con l'espansione.
**Evidenza:** `src/ui/wine.js` imposta decine di `element.textContent = ...` ad ogni apertura di scheda vino.
**Raccomandazione:** Non serve un framework massivo. Potrebbe bastare Alpine.js, Lit o pattern architetturali (es. MVC, Web Components) per astrarre le mutazioni del DOM.

### Utilizzo direttiva CSP 'unsafe-inline'
**Categoria:** Security
**Severità:** Low
**File coinvolti:** `vercel.json`
**Problema:** La direttiva `style-src` in Content-Security-Policy ammette `'unsafe-inline'`.
**Perché è importante:** Permetterebbe esecuzione di injection CSS che in determinati (seppur rari) contesti consentono l'esfiltrazione di dati o redressing visivo.
**Evidenza:** Riga 9 di `vercel.json`.
**Raccomandazione:** Spostare tutti gli stili in un file CSS esterno o applicare un hash crittografico per gli stili inline consentiti.

## 21. PRIORITÀ

### P0 — Da affrontare immediatamente
*(Nessuno. La codebase è molto robusta e sicura dal punto di vista dell'affidabilità core e sicurezza dati).*

### P1 — Alta priorità
*(Nessuno)*

### P2 — Media priorità
- **Migrazione a TypeScript**: Da implementare prima dell'aggiunta di nuove funzionalità massicce.
- **Refactoring Architettura UI Frontend**: Adottare un tool minimo di reattività (es. Alpine.js) o Web Components per rimuovere l'eccesso di codice imperativo.

### P3 — Bassa priorità
- **Rafforzamento CSP**: Rimuovere `'unsafe-inline'` da `vercel.json` se possibile, delegando a fogli di stile isolati.

## 22. VALUTAZIONE FINALE

La codebase del progetto "vino-passport" si presenta in uno stato **sorprendentemente maturo e robusto sul versante backend**. La sicurezza è implementata in profondità, con un rate-limiter allo stato dell'arte per ambienti serverless, protezione anti-CSRF artigianale ma impeccabile, e controlli di idempotenza stringenti con transazioni database ottimizzate.

Tuttavia, si osserva un **forte sbilanciamento tra la qualità dell'API e quella del client frontend**. Il frontend Vanilla JS è stato evidentemente concepito per essere iper-leggero e veloce da caricare (essendo utilizzato in contesti con reti cellulari sature, come le fiere del vino via NFC). Se da una parte questo garantisce performance e azzera il bundle Javascript generato da grossi framework, dall'altra condanna la manutenibilità futura: la manipolazione diretta del DOM combinata all'assenza di type-safety richiederà estrema cautela per futuri sviluppi, configurandosi come il debito tecnico dominante del progetto.

Nel complesso, **il prodotto è solido, eccezionalmente sicuro e pronto all'uso**, ma richiederà attenzione sul layer di presentazione (Type Safety e View Reusability) prima di intraprendere un ridimensionamento (scale-up) delle funzionalità visive.
