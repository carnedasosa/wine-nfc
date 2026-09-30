// Le vecchie code non contengono il proprietario: non inviarle con la sessione corrente.
// I dati IndexedDB preesistenti restano sul dispositivo, senza sincronizzazione automatica.
export async function flushOutbox() { return 0; }
export async function registerSync() { return false; }
export async function saveTastingToOutbox() { throw new Error('Connessione assente. Resta su questa scheda e riprova quando torna la rete.'); }
