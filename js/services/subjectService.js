/**
 * StudyTracker — Subject Management Service
 */

import { get, getAll, getAllByIndex, put, remove, STORES } from '../db/database.js';
import { validateSubject } from '../db/schema.js';
import { generateId } from '../utils/idUtils.js';

export const SUBJECT_PALETTE = Object.freeze([
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#64748b'  // Slate
]);

/**
 * Triggers a global event when subjects are modified.
 */
function notifySubjectsChanged() {
  window.dispatchEvent(new CustomEvent('studytracker:subjects-changed'));
}

/**
 * Returns all subjects.
 * @param {Object} [options]
 * @param {boolean} [options.includeArchived=false]
 * @returns {Promise<Array<Object>>}
 */
export async function getAllSubjects({ includeArchived = false } = {}) {
  const all = await getAll(STORES.SUBJECTS);
  all.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));

  if (includeArchived) {
    return all;
  }
  return all.filter((s) => !s.archived);
}

/**
 * Returns a single subject by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSubjectById(id) {
  if (!id) return null;
  return await get(STORES.SUBJECTS, id);
}

/**
 * Creates a new subject.
 * @param {Object} data
 * @param {string} data.name
 * @param {string} [data.color]
 * @returns {Promise<Object>}
 */
export async function createSubject({ name, color }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Subject name cannot be empty.');
  }

  // Check for duplicate active subject name
  const existing = await getAllSubjects({ includeArchived: true });
  const isDuplicate = existing.some(
    (s) => !s.archived && s.name.toLowerCase() === trimmedName.toLowerCase()
  );

  if (isDuplicate) {
    throw new Error(`A subject named "${trimmedName}" already exists.`);
  }

  const selectedColor = color || SUBJECT_PALETTE[Math.floor(Math.random() * SUBJECT_PALETTE.length)];
  const now = new Date().toISOString();

  const subject = {
    id: generateId(),
    name: trimmedName,
    color: selectedColor,
    archived: false,
    createdAt: now,
    updatedAt: now
  };

  const validation = validateSubject(subject);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.SUBJECTS, subject);
  notifySubjectsChanged();
  return subject;
}

/**
 * Updates an existing subject.
 * @param {string} id
 * @param {Object} updates
 * @param {string} [updates.name]
 * @param {string} [updates.color]
 * @returns {Promise<Object>}
 */
export async function updateSubject(id, { name, color }) {
  const subject = await get(STORES.SUBJECTS, id);
  if (!subject) {
    throw new Error('Subject not found.');
  }

  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new Error('Subject name cannot be empty.');
  }

  // Check duplicate with different ID
  const all = await getAllSubjects({ includeArchived: true });
  const isDuplicate = all.some(
    (s) => s.id !== id && !s.archived && s.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) {
    throw new Error(`Another subject named "${trimmedName}" already exists.`);
  }

  subject.name = trimmedName;
  if (color) subject.color = color;
  subject.updatedAt = new Date().toISOString();

  const validation = validateSubject(subject);
  if (!validation.valid) {
    throw new Error(validation.errors.join(', '));
  }

  await put(STORES.SUBJECTS, subject);
  notifySubjectsChanged();
  return subject;
}

/**
 * Safely deletes or archives a subject.
 * If sessions exist, it archives the subject to safeguard historical data.
 * If no sessions exist, it permanently deletes the subject.
 * @param {string} id
 * @returns {Promise<{ action: 'deleted'|'archived', message: string, subject: Object }>}
 */
export async function deleteSubject(id) {
  const subject = await get(STORES.SUBJECTS, id);
  if (!subject) {
    throw new Error('Subject not found.');
  }

  // Check if subject has any associated sessions
  let sessions = [];
  try {
    sessions = await getAllByIndex(STORES.SESSIONS, 'subjectId', id);
  } catch (_) {
    // In case index lookup fails, fallback to getAll
    const all = await getAll(STORES.SESSIONS);
    sessions = all.filter((s) => s.subjectId === id);
  }

  if (sessions.length > 0) {
    // Preserve history: Archive the subject
    subject.archived = true;
    subject.updatedAt = new Date().toISOString();
    await put(STORES.SUBJECTS, subject);
    notifySubjectsChanged();
    return {
      action: 'archived',
      message: `Subject archived because it has ${sessions.length} study session${sessions.length > 1 ? 's' : ''}.`,
      subject
    };
  } else {
    // Safe to permanently delete
    await remove(STORES.SUBJECTS, id);
    notifySubjectsChanged();
    return {
      action: 'deleted',
      message: 'Subject permanently removed.',
      subject
    };
  }
}

/**
 * Restores an archived subject.
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function restoreSubject(id) {
  const subject = await get(STORES.SUBJECTS, id);
  if (!subject) {
    throw new Error('Subject not found.');
  }

  // Check if another active subject took this name while archived
  const active = await getAllSubjects({ includeArchived: false });
  if (active.some((s) => s.name.toLowerCase() === subject.name.toLowerCase())) {
    throw new Error(`An active subject named "${subject.name}" already exists.`);
  }

  subject.archived = false;
  subject.updatedAt = new Date().toISOString();
  await put(STORES.SUBJECTS, subject);
  notifySubjectsChanged();
  return subject;
}
