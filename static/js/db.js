// IndexedDB wrapper for offline storage
const DB_NAME = 'JNBakeryDB';
const DB_VERSION = 1;

let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id' });
        ps.createIndex('name', 'name');
        ps.createIndex('barcode', 'barcode');
      }
      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('customers')) {
        const cs = db.createObjectStore('customers', { keyPath: 'id' });
        cs.createIndex('phone', 'phone');
      }
      if (!db.objectStoreNames.contains('pending_sales')) {
        db.createObjectStore('pending_sales', { keyPath: 'local_id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = e => reject(e.target.error);
  });
}

async function getDB() {
  if (!db) await initDB();
  return db;
}

async function saveAll(storeName, items) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    items.forEach(item => store.put(item));
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function getAll(storeName) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function getOne(storeName, key) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function savePendingSale(saleData) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('pending_sales', 'readwrite');
    const req = tx.objectStore('pending_sales').add({ ...saleData, timestamp: Date.now() });
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function getPendingSales() {
  return getAll('pending_sales');
}

async function deletePendingSale(localId) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('pending_sales', 'readwrite');
    tx.objectStore('pending_sales').delete(localId);
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function syncPendingSales() {
  const pending = await getPendingSales();
  for (const sale of pending) {
    try {
      const { local_id, timestamp, ...saleData } = sale;
      const res = await fetch('/api/sales/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        await deletePendingSale(local_id);
      }
    } catch (err) {
      console.warn('Sync failed for sale', sale.local_id, err);
    }
  }
  return pending.length;
}

async function saveSetting(key, value) {
  const d = await getDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = resolve;
    tx.onerror = e => reject(e.target.error);
  });
}

async function getSetting(key) {
  const rec = await getOne('settings', key);
  return rec ? rec.value : null;
}

window.BakeryDB = {
  init: initDB,
  saveProducts: items => saveAll('products', items),
  getProducts: () => getAll('products'),
  saveCategories: items => saveAll('categories', items),
  getCategories: () => getAll('categories'),
  saveCustomers: items => saveAll('customers', items),
  getCustomers: () => getAll('customers'),
  savePendingSale,
  getPendingSales,
  deletePendingSale,
  syncPendingSales,
  saveSetting,
  getSetting,
};
