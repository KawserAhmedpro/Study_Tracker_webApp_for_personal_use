/**
 * StudyTracker — IndexedDB Promise-based Database Engine
 */

import { DB_NAME, DB_VERSION, STORES, DEFAULT_SETTINGS } from './schema.js';
import { runMigrations } from './migrations.js';

let dbInstance = null;
let initPromise = null;

/**
 * Initializes and opens the IndexedDB database.
 * Subsequent calls return the cached connection promise.
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported by this browser environment.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;
      runMigrations(db, transaction, event.oldVersion, event.newVersion);
    };

    request.onsuccess = async (event) => {
      dbInstance = event.target.result;

      // Handle external version changes
      dbInstance.onversionchange = () => {
        dbInstance.close();
        dbInstance = null;
        initPromise = null;
      };

      try {
        await seedDefaultSettingsIfMissing();
        resolve(dbInstance);
      } catch (err) {
        console.warn('StudyTracker: Warning during settings check:', err);
        resolve(dbInstance);
      }
    };

    request.onerror = (event) => {
      console.error('StudyTracker IndexedDB open failed:', event.target.error);
      initPromise = null;
      reject(event.target.error || new Error('Failed to open IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('StudyTracker IndexedDB open was blocked by another tab.');
    };
  });

  return initPromise;
}

/**
 * Ensures default settings exist in the database.
 */
async function seedDefaultSettingsIfMissing() {
  const existing = await get(STORES.SETTINGS, DEFAULT_SETTINGS.id);
  if (!existing) {
    const initial = {
      ...DEFAULT_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await put(STORES.SETTINGS, initial);
  }
}

/**
 * Generic helper to execute a transaction and return a promise.
 * @param {string|string[]} storeNames
 * @param {'readonly'|'readwrite'} mode
 * @param {Function} callback - Receives the transaction
 * @returns {Promise<any>}
 */
export async function runTransaction(storeNames, mode, callback) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;

    tx.oncomplete = () => resolve(result);
    tx.onerror = (e) => reject(tx.error || e.target.error);
    tx.onabort = () => reject(new Error('Transaction aborted'));

    try {
      result = callback(tx);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves a single record by primary key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<any|null>}
 */
export async function get(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves all records from an object store.
 * @param {string} storeName
 * @returns {Promise<any[]>}
 */
export async function getAll(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieves records using an index.
 * @param {string} storeName
 * @param {string} indexName
 * @param {IDBKeyRange|any} query
 * @returns {Promise<any[]>}
 */
export async function getAllByIndex(storeName, indexName, query) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const req = query !== undefined ? index.getAll(query) : index.getAll();

    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Adds or updates a record.
 * @param {string} storeName
 * @param {Object} value
 * @returns {Promise<IDBValidKey>}
 */
export async function put(storeName, value) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(value);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(new Error('Put transaction aborted'));
  });
}

/**
 * Adds or updates multiple records within a single transaction.
 * @param {string} storeName
 * @param {Array<Object>} items
 * @returns {Promise<void>}
 */
export async function putMany(storeName, items) {
  if (!items || items.length === 0) return Promise.resolve();
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of items) {
      store.put(item);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error('Batch put transaction aborted'));
  });
}

/**
 * Deletes a record by primary key.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @returns {Promise<void>}
 */
export async function remove(storeName, key) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(new Error('Delete transaction aborted'));
  });
}

/**
 * Clears all records from a store.
 * @param {string} storeName
 * @returns {Promise<void>}
 */
export async function clear(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.onerror = () => reject(tx.error || req.error);
    tx.onabort = () => reject(new Error('Clear transaction aborted'));
  });
}

/**
 * Counts records in an object store.
 * @param {string} storeName
 * @returns {Promise<number>}
 */
export async function count(storeName) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();

    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

export { STORES, DB_NAME, DB_VERSION, DEFAULT_SETTINGS };
