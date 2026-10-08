/**
 * StudyTracker — Study Sessions Service
 */

import { get, getAll, getAllByIndex, put, remove, STORES } from '../db/database.js';
import { validateSession } from '../db/schema.js';
import { generateId } from '../utils/idUtils.js';
import { getLocalDateString } from '../utils/dateUtils.js';

/**
 * Triggers a global event when sessions are created, updated, or removed.
 */
function notifySessionsChanged() {
  window.dispatchEvent(new CustomEvent('studytracker:sessions-changed'));
}

/**
 * Saves a new study session to IndexedDB.
 * @param {Object} data
 * @param {string} data.subjectId
 * @param {string} [data.topic]
 * @param {number|string|Date} data.startTime
 * @param {number|string|Date} data.endTime
 * @param {number} [data.duration] - Canonical duration in seconds
 * @param {string} [data.date] - 'YYYY-MM-DD'
 * @param {string} [data.notes]
 * @returns {Promise<Object>}
 */
export async function saveSession(data) {
  const startObj = new Date(data.startTime);
  const endObj = new Date(data.endTime);
  const now = new Date().toISOString();

  // Canonical duration calculation in integer seconds
  let durationSec = data.duration;
  if (typeof durationSec !== 'number' || isNaN(durationSec)) {
    durationSec = Math.max(0, Math.floor((endObj.getTime() - startObj.getTime()) / 1000));
  } else {
    durationSec = Math.max(0, Math.floor(durationSec));
  }

  // Canonical local calendar date string
  const sessionDate = data.date || getLocalDateString(startObj);

  const session = {
    id: data.id || generateId(),
    subjectId: data.subjectId,
    topic: (data.topic || '').trim(),
    startTime: startObj.toISOString(),
    endTime: endObj.toISOString(),
    duration: durationSec,
    date: sessionDate,
    notes: (data.notes || '').trim(),
    createdAt: data.createdAt || now,
    updatedAt: now
  };

  const validation = validateSession(session);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.SESSIONS, session);
  notifySessionsChanged();
  return session;
}

/**
 * Retrieves all study sessions, sorted by startTime descending (newest first).
 * @returns {Promise<Array<Object>>}
 */
export async function getAllSessions() {
  const all = await getAll(STORES.SESSIONS);
  all.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  return all;
}

/**
 * Retrieves a single session by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSessionById(id) {
  if (!id) return null;
  return await get(STORES.SESSIONS, id);
}

/**
 * Updates an existing study session.
 * Keeps timestamps, duration, and calendar dates synchronized.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateSession(id, updates) {
  const session = await get(STORES.SESSIONS, id);
  if (!session) {
    throw new Error('Study session not found.');
  }

  if (updates.subjectId) session.subjectId = updates.subjectId;
  if (updates.topic !== undefined) session.topic = (updates.topic || '').trim();
  if (updates.notes !== undefined) session.notes = (updates.notes || '').trim();

  if (updates.startTime) session.startTime = new Date(updates.startTime).toISOString();
  if (updates.endTime) session.endTime = new Date(updates.endTime).toISOString();

  if (updates.duration !== undefined) {
    session.duration = Math.max(0, Math.floor(Number(updates.duration) || 0));
    // If endTime wasn't explicitly supplied, synchronize endTime with updated duration
    if (!updates.endTime) {
      session.endTime = new Date(new Date(session.startTime).getTime() + session.duration * 1000).toISOString();
    }
  }

  if (updates.date && updates.date !== session.date) {
    session.date = updates.date;
    const [newY, newM, newD] = updates.date.split('-').map(Number);
    const currStart = new Date(session.startTime);
    const currEnd = new Date(session.endTime);
    currStart.setFullYear(newY, newM - 1, newD);
    currEnd.setFullYear(newY, newM - 1, newD);
    session.startTime = currStart.toISOString();
    session.endTime = currEnd.toISOString();
  }

  session.updatedAt = new Date().toISOString();

  const validation = validateSession(session);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.SESSIONS, session);
  notifySessionsChanged();
  return session;
}

/**
 * Deletes a study session by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSession(id) {
  if (!id) return;
  await remove(STORES.SESSIONS, id);
  notifySessionsChanged();
}

/**
 * Retrieves sessions for a specific calendar date (YYYY-MM-DD).
 * @param {string} dateStr
 * @returns {Promise<Array<Object>>}
 */
export async function getSessionsByDate(dateStr) {
  if (!dateStr) return [];
  try {
    const list = await getAllByIndex(STORES.SESSIONS, 'date', dateStr);
    list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return list;
  } catch (_) {
    const all = await getAllSessions();
    return all.filter((s) => s.date === dateStr);
  }
}

/**
 * Retrieves sessions for a specific subject ID.
 * @param {string} subjectId
 * @returns {Promise<Array<Object>>}
 */
export async function getSessionsBySubject(subjectId) {
  if (!subjectId) return [];
  try {
    const list = await getAllByIndex(STORES.SESSIONS, 'subjectId', subjectId);
    list.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return list;
  } catch (_) {
    const all = await getAllSessions();
    return all.filter((s) => s.subjectId === subjectId);
  }
}
