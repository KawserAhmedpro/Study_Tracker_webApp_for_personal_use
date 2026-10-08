/**
 * StudyTracker — Backup & Restore (Export / Import) Service
 * Safe JSON backup export and validated Merge/Replace import.
 */

import { getAll, putMany, put, clear, STORES, DEFAULT_SETTINGS } from '../db/database.js';
import { validateSubject, validateSession, validateSettings, DB_VERSION } from '../db/schema.js';
import { getLocalDateString } from '../utils/dateUtils.js';

/**
 * Triggers a global notification when backup alters data.
 */
function notifyDataRestored() {
  window.dispatchEvent(new CustomEvent('studytracker:sessions-changed'));
  window.dispatchEvent(new CustomEvent('studytracker:subjects-changed'));
  window.dispatchEvent(new CustomEvent('studytracker:settings-changed'));
}

/**
 * Exports all user data to a downloadable JSON backup file.
 * @returns {Promise<{ filename: string, subjectsCount: number, sessionsCount: number }>}
 */
export async function exportBackup() {
  const [subjects, studySessions, settingsList] = await Promise.all([
    getAll(STORES.SUBJECTS),
    getAll(STORES.SESSIONS),
    getAll(STORES.SETTINGS)
  ]);

  const settings = (settingsList && settingsList.length > 0)
    ? settingsList[0]
    : { ...DEFAULT_SETTINGS };

  const backupData = {
    appName: 'StudyTracker',
    schemaVersion: DB_VERSION,
    exportedAt: new Date().toISOString(),
    subjects: subjects || [],
    studySessions: studySessions || [],
    settings
  };

  const jsonStr = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const todayStr = getLocalDateString(new Date()) || 'backup';
  const filename = `study-tracker-backup-${todayStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 250);

  return {
    filename,
    subjectsCount: backupData.subjects.length,
    sessionsCount: backupData.studySessions.length
  };
}

/**
 * Validates a parsed backup object.
 * Protects IndexedDB against malformed or corrupt files.
 * @param {any} data
 * @returns {{ valid: boolean, errors: string[], summary?: Object, cleanData?: Object }}
 */
export function validateBackupData(data) {
  const errors = [];

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, errors: ['File content is not a valid JSON object.'] };
  }

  // 1. Schema version check
  if (typeof data.schemaVersion !== 'number' || data.schemaVersion <= 0) {
    errors.push('Missing or invalid schemaVersion in backup file.');
  }

  // 2. Arrays check
  if (!Array.isArray(data.subjects)) {
    errors.push('Backup must contain a "subjects" array.');
  }

  if (!Array.isArray(data.studySessions)) {
    errors.push('Backup must contain a "studySessions" array.');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 3. Entity-level validation
  const validSubjects = [];
  for (let i = 0; i < data.subjects.length; i++) {
    const s = data.subjects[i];
    const res = validateSubject(s);
    if (!res.valid) {
      errors.push(`Subject at index ${i} is invalid: ${res.errors.join(', ')}`);
    } else {
      validSubjects.push({
        id: s.id,
        name: s.name.trim(),
        color: s.color || '#3b82f6',
        archived: Boolean(s.archived),
        createdAt: s.createdAt || new Date().toISOString(),
        updatedAt: s.updatedAt || new Date().toISOString()
      });
    }
  }

  const validSessions = [];
  for (let i = 0; i < data.studySessions.length; i++) {
    const sess = data.studySessions[i];
    const res = validateSession(sess);
    if (!res.valid) {
      errors.push(`Study session at index ${i} is invalid: ${res.errors.join(', ')}`);
    } else {
      validSessions.push({
        id: sess.id,
        subjectId: sess.subjectId,
        topic: (sess.topic || '').trim(),
        startTime: new Date(sess.startTime).toISOString(),
        endTime: new Date(sess.endTime).toISOString(),
        duration: Math.max(1, Math.round(Number(sess.duration))),
        date: sess.date,
        notes: (sess.notes || '').trim(),
        createdAt: sess.createdAt || new Date().toISOString(),
        updatedAt: sess.updatedAt || new Date().toISOString()
      });
    }
  }

  // 4. Settings validation
  let validSettings = { ...DEFAULT_SETTINGS };
  if (data.settings && typeof data.settings === 'object') {
    const sRes = validateSettings(data.settings);
    if (sRes.valid) {
      validSettings = {
        ...DEFAULT_SETTINGS,
        ...data.settings,
        id: 'app_settings'
      };
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    summary: {
      schemaVersion: data.schemaVersion,
      exportedAt: data.exportedAt || 'Unknown',
      subjectsCount: validSubjects.length,
      sessionsCount: validSessions.length
    },
    cleanData: {
      subjects: validSubjects,
      studySessions: validSessions,
      settings: validSettings
    }
  };
}

/**
 * Executes the data import into IndexedDB.
 * @param {Object} options
 * @param {Object} options.cleanData - Validated backup data
 * @param {'merge'|'replace'} [options.mode='merge']
 * @returns {Promise<{ importedSubjects: number, importedSessions: number, mode: string }>}
 */
export async function importBackup({ cleanData, mode = 'merge' }) {
  if (!cleanData) {
    throw new Error('No validated backup data provided.');
  }

  const { subjects, studySessions, settings } = cleanData;

  if (mode === 'replace') {
    // 1. Full Replace Mode: Clear existing records safely and write new data
    await clear(STORES.SUBJECTS);
    await clear(STORES.SESSIONS);
    await clear(STORES.ACTIVE_SESSION);

    await putMany(STORES.SUBJECTS, subjects);
    await putMany(STORES.SESSIONS, studySessions);
    if (settings) {
      await put(STORES.SETTINGS, settings);
    }

  } else {
    // 2. Merge Mode: Deterministic ID-based upsert without duplicate creation
    const existingSubjects = await getAll(STORES.SUBJECTS);
    const existingSessions = await getAll(STORES.SESSIONS);

    const subjectIdMap = new Map(); // Old ID -> Effective ID
    const existingSubByName = new Map(existingSubjects.map((s) => [s.name.toLowerCase(), s]));
    const existingSubById = new Map(existingSubjects.map((s) => [s.id, s]));

    const subjectsToSave = [];
    const seenSubjectNames = new Set(existingSubjects.map((s) => s.name.toLowerCase()));
    const seenSubjectIds = new Set(existingSubjects.map((s) => s.id));

    for (const sub of subjects) {
      if (existingSubById.has(sub.id)) {
        // Exists by ID: Update if incoming is newer or preserve
        subjectIdMap.set(sub.id, sub.id);
        const existing = existingSubById.get(sub.id);
        const incomingUpdated = new Date(sub.updatedAt || 0).getTime();
        const existingUpdated = new Date(existing.updatedAt || 0).getTime();
        if (incomingUpdated > existingUpdated) {
          subjectsToSave.push(sub);
        }
      } else if (existingSubByName.has(sub.name.toLowerCase())) {
        // Exists with same name: Map to existing ID to prevent duplicate subject
        const existing = existingSubByName.get(sub.name.toLowerCase());
        subjectIdMap.set(sub.id, existing.id);
      } else if (!seenSubjectNames.has(sub.name.toLowerCase()) && !seenSubjectIds.has(sub.id)) {
        // Brand new subject
        subjectIdMap.set(sub.id, sub.id);
        seenSubjectNames.add(sub.name.toLowerCase());
        seenSubjectIds.add(sub.id);
        subjectsToSave.push(sub);
      }
    }

    const existingSessionById = new Map(existingSessions.map((s) => [s.id, s]));
    const sessionsToSave = [];
    const processedSessionIds = new Set();

    for (const sess of studySessions) {
      if (processedSessionIds.has(sess.id)) continue;
      processedSessionIds.add(sess.id);

      const effectiveSubjectId = subjectIdMap.get(sess.subjectId) || sess.subjectId;
      const preparedSession = {
        ...sess,
        subjectId: effectiveSubjectId
      };

      if (existingSessionById.has(sess.id)) {
        // Existing ID: update if newer, otherwise preserve existing local session
        const existing = existingSessionById.get(sess.id);
        const incomingUpdated = new Date(sess.updatedAt || 0).getTime();
        const existingUpdated = new Date(existing.updatedAt || 0).getTime();
        if (incomingUpdated > existingUpdated) {
          sessionsToSave.push(preparedSession);
        }
      } else {
        // New ID: insert
        sessionsToSave.push(preparedSession);
      }
    }

    if (subjectsToSave.length > 0) {
      await putMany(STORES.SUBJECTS, subjectsToSave);
    }
    if (sessionsToSave.length > 0) {
      await putMany(STORES.SESSIONS, sessionsToSave);
    }

    // Merge settings if not currently configured
    if (settings) {
      const existingSettings = await getAll(STORES.SETTINGS);
      if (!existingSettings || existingSettings.length === 0) {
        await put(STORES.SETTINGS, settings);
      }
    }
  }

  notifyDataRestored();

  return {
    importedSubjects: subjects.length,
    importedSessions: studySessions.length,
    mode
  };
}
