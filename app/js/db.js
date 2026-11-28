// IndexedDB storage. Everything lives on this device: devices, photos and
// floorplans (as Blobs), managed lists, counters and saved reports.

const DB_NAME = 'itims';
const DB_VERSION = 1;
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('devices')) db.createObjectStore('devices', { keyPath: 'uid' });
      if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx(store, mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaction aborted'));
  }));
}
const wrap = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });

export const db = {
  all: (store) => tx(store, 'readonly', (s) => wrap(s.getAll())),
  get: (store, key) => tx(store, 'readonly', (s) => wrap(s.get(key))),
  put: (store, val) => tx(store, 'readwrite', (s) => { s.put(val); }),
  putMany: (store, vals) => tx(store, 'readwrite', (s) => { vals.forEach((v) => s.put(v)); }),
  del: (store, key) => tx(store, 'readwrite', (s) => { s.delete(key); }),
  clear: (store) => tx(store, 'readwrite', (s) => { s.clear(); }),
  async meta(key, fallback) { const r = await this.get('meta', key); return r ? r.value : fallback; },
  setMeta: (key, value) => db.put('meta', { key, value }),
};

export async function requestPersistence() {
  try { if (navigator.storage?.persist) return await navigator.storage.persist(); } catch { /* ignore */ }
  return false;
}
