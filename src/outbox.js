export async function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VinoPassportOutbox', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('tastings', { keyPath: 'idempotencyKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTastingToOutbox(payload) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tastings', 'readwrite');
    const store = tx.objectStore('tastings');
    store.put({ ...payload, _status: 'pending' });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function flushOutbox() {
  if (!navigator.onLine) return;
  const db = await openDB();
  
  const pending = await new Promise((resolve, reject) => {
    const tx = db.transaction('tastings', 'readonly');
    const store = tx.objectStore('tastings');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (pending.length === 0) return;
  
  const { API } = await import('./api.js');
  
  for (const item of pending) {
    try {
      const { _status, ...payload } = item;
      await API.saveTasting(payload);
      
      await new Promise((resolve, reject) => {
        const tx = db.transaction('tastings', 'readwrite');
        tx.objectStore('tastings').delete(payload.idempotencyKey);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (err) {
      console.error('Failed to sync tasting', err);
    }
  }
}

export async function registerSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.sync.register('sync-tastings');
    } catch (err) {
      console.error('Background Sync registration failed:', err);
    }
  }
}
