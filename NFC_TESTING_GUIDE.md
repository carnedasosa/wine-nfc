# Guida al Testing dei Tag NFC

Benvenuto nella guida passo-passo per la configurazione e il testing dei tag NFC per la nostra applicazione. Segui attentamente queste istruzioni per assicurarti che il tuo ambiente e i tag funzionino correttamente.

## 1. Avvio Server

Per prima cosa, devi assicurarti che l'applicazione web sia in esecuzione sul tuo computer locale.
Apri il tuo terminale o prompt dei comandi nella root del progetto e lancia il seguente comando:

`ash
npm start
`

> [!NOTE]
> Questo comando avvierà il server di sviluppo locale, che di norma si metterà in ascolto sulla porta 3000. Mantieni il terminale aperto e in esecuzione durante tutto il test.

---

## 2. Trovare l'Indirizzo IP Locale

Poiché testerai il tag NFC usando il tuo smartphone, quest'ultimo dovrà potersi connettere al server locale in esecuzione sul tuo computer. A tal fine, devi conoscere l'**Indirizzo IP locale** della tua macchina.

Su **Windows**:
1. Apri **PowerShell** (o il Prompt dei Comandi).
2. Digita il seguente comando e premi Invio:
   `powershell
   ipconfig
   `
3. Scorri l'output fino a trovare la connessione di rete attiva (es. "Scheda LAN wireless Wi-Fi" o "Scheda Ethernet") e individua la riga **Indirizzo IPv4**.
   *Esempio: 192.168.1.55*

---

## 3. Il Contratto URL

Ora che hai l'indirizzo IP, dobbiamo costruire l'URL corretto da inserire all'interno del tag NFC. Il tag deve puntare alla pagina che mostra le informazioni di uno specifico vino.

**Formato richiesto dell'URL:**
`	ext
http://<TUO_IP_LOCALE>:3000/?vino=<ID_VINO>
`

> [!IMPORTANT]
> Sostituisci <TUO_IP_LOCALE> con l'indirizzo IPv4 trovato al Passo 2.
> Sostituisci <ID_VINO> con uno degli ID vino validi.
> 
> **Valori ammessi per ino:** 1, 2, 3, 4, 5

**Esempio pratico:** Se il tuo IP è 192.168.1.55 e vuoi creare un tag per il primo vino, l'URL esatto da usare sarà:
http://192.168.1.55:3000/?vino=v1

---

## 4. Scrittura del Tag NFC

Il prossimo passo è programmare (scrivere) questo URL sul tag fisico in modo che lo smartphone lo riconosca e lo apra.

1. Scarica e installa l'app gratuita **NFC Tools** sul tuo smartphone (disponibile sugli store per iOS e Android).
2. Apri l'app e vai alla scheda **Scrivi** (Write).
3. Tocca **Aggiungi record** (Add a record).
4. Scegli l'opzione **URL / URI** (oppure "Link personalizzato").
5. Inserisci l'URL completo creato al Passo 3. Assicurati che inizi correttamente con http://.
6. Conferma e premi il grande pulsante **Scrivi / Write**.
7. L'app ti chiederà di avvicinare il tag: appoggia lo smartphone sul tag NFC fisico e attendi il segno di spunta verde che conferma l'avvenuta scrittura.

---

## 5. Procedura di Test

Adesso tutto è pronto per il test reale.

1. Verifica che lo smartphone sia connesso alla **stessa rete WiFi** del tuo computer.
2. Controlla che il terminale con 
pm start stia ancora girando.
3. Esci dall'applicazione "NFC Tools" sul telefono per tornare alla Home (in questo modo eviti che il tag venga intercettato dall'app di scrittura).
4. **Appoggia nuovamente il telefono sul tag NFC**.
5. **Effetto atteso:** Sullo schermo del telefono comparirà una notifica NFC oppure si aprirà direttamente il browser di sistema mostrando la pagina web dell'applicazione con i dettagli della scheda vino corrispondente (es. il vino 1).

---

## 6. Troubleshooting

> [!WARNING]
> **La pagina non carica sul telefono? Attenzione al Firewall!**
> 
> Se, appoggiando il tag, il browser del telefono si apre ma la pagina non carica, mostra un errore "Impossibile raggiungere il sito", o carica all'infinito, il problema risiede molto probabilmente nel **Firewall di Windows** che sta bloccando il traffico in ingresso verso la porta 3000.

**Come sbloccare la porta 3000 sul Firewall di Windows:**
1. Clicca sul menu Start, digita e apri **Windows Defender Firewall con sicurezza avanzata** (Windows Defender Firewall with Advanced Security).
2. Clicca su **Regole connessioni in entrata** (Inbound Rules) nel pannello a sinistra.
3. Clicca su **Nuova regola...** (New Rule...) nel pannello a destra.
4. Seleziona **Porta** (Port) e clicca su Avanti.
5. Scegli **TCP** e, alla voce "Porte locali specifiche", inserisci 3000. Clicca su Avanti.
6. Seleziona **Consenti la connessione** (Allow the connection) e clicca su Avanti.
7. Lascia spuntati i profili di rete applicabili (almeno **Privata**, o tutte se non sei sicuro) e clicca su Avanti.
8. Assegna un nome alla regola (es. Sviluppo Node.js Porta 3000) e clicca su Fine.

Fatto questo, riprova la **Procedura di Test** (Passo 5). La pagina dovrebbe ora caricare istantaneamente!
