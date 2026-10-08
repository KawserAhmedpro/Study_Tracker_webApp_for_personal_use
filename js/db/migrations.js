/**
 * StudyTracker — IndexedDB Schema Migrations
 */

import { STORES } from './schema.js';

/**
 * Handles database upgrade migrations based on oldVersion and newVersion.
 * @param {IDBDatabase} db
 * @param {IDBTransaction} transaction
 * @param {number} oldVersion
 * @param {number} newVersion
 */
export function runMigrations(db, transaction, oldVersion, newVersion) {
  // Version 1 Migration
  if (oldVersion < 1) {
    // 1. Subjects Store
    if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
      const subjectStore = db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
      subjectStore.createIndex('name', 'name', { unique: false });
      subjectStore.createIndex('archived', 'archived', { unique: false });
      subjectStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 2. Study Sessions Store
    if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
      const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
      sessionStore.createIndex('date', 'date', { unique: false });
      sessionStore.createIndex('subjectId', 'subjectId', { unique: false });
      sessionStore.createIndex('startTime', 'startTime', { unique: false });
      sessionStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 3. Settings Store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
    }

    // 4. Active Session Store (Persistent timer state across reloads/crashes)
    if (!db.objectStoreNames.contains(STORES.ACTIVE_SESSION)) {
      db.createObjectStore(STORES.ACTIVE_SESSION, { keyPath: 'id' });
    }
  }
}
