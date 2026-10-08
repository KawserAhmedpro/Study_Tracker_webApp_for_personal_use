/**
 * StudyTracker — IndexedDB Schema & Data Model Definitions
 */

export const DB_NAME = 'studytracker_db';
export const DB_VERSION = 1;

export const STORES = Object.freeze({
  SUBJECTS: 'subjects',
  SESSIONS: 'studySessions',
  SETTINGS: 'settings',
  ACTIVE_SESSION: 'activeSession'
});

export const DEFAULT_SETTINGS = Object.freeze({
  id: 'app_settings',
  dailyGoalSeconds: 14400, // 4 hours in canonical seconds
  theme: 'system',
  schemaVersion: 1
});

/**
 * Validates a subject entity.
 * @param {Object} subject
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSubject(subject) {
  const errors = [];
  if (!subject || typeof subject !== 'object') {
    return { valid: false, errors: ['Subject must be a valid object'] };
  }
  if (!subject.id || typeof subject.id !== 'string') {
    errors.push('Subject id is required and must be a string');
  }
  if (!subject.name || typeof subject.name !== 'string' || !subject.name.trim()) {
    errors.push('Subject name is required');
  }
  if (subject.color && typeof subject.color !== 'string') {
    errors.push('Subject color must be a valid color string');
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Validates a study session entity.
 * Duration must be canonical non-negative integer seconds consistent with timestamps.
 * Date must be valid local YYYY-MM-DD string.
 * @param {Object} session
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSession(session) {
  const errors = [];
  if (!session || typeof session !== 'object') {
    return { valid: false, errors: ['Session must be a valid object'] };
  }
  if (!session.id || typeof session.id !== 'string') {
    errors.push('Session id is required and must be a string');
  }
  if (!session.subjectId || typeof session.subjectId !== 'string') {
    errors.push('Session subjectId is required');
  }
  if (session.topic !== undefined && typeof session.topic !== 'string') {
    errors.push('Session topic must be a string');
  }
  if (typeof session.duration !== 'number' || isNaN(session.duration) || session.duration < 0) {
    errors.push('Session duration must be a non-negative number of seconds');
  }
  if (!session.date || typeof session.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
    errors.push('Session date must be in YYYY-MM-DD format');
  } else {
    const [y, m, d] = session.date.split('-').map(Number);
    const testDate = new Date(y, m - 1, d);
    if (testDate.getFullYear() !== y || testDate.getMonth() + 1 !== m || testDate.getDate() !== d) {
      errors.push('Session date must be a valid calendar date');
    }
  }

  let startMs = NaN;
  let endMs = NaN;

  if (!session.startTime) {
    errors.push('Session startTime is required');
  } else {
    startMs = new Date(session.startTime).getTime();
    if (isNaN(startMs)) {
      errors.push('Session startTime must be a valid timestamp');
    }
  }

  if (!session.endTime) {
    errors.push('Session endTime is required');
  } else {
    endMs = new Date(session.endTime).getTime();
    if (isNaN(endMs)) {
      errors.push('Session endTime must be a valid timestamp');
    }
  }

  if (!isNaN(startMs) && !isNaN(endMs)) {
    if (endMs < startMs) {
      errors.push('Session endTime cannot be earlier than startTime');
    } else if (typeof session.duration === 'number' && !isNaN(session.duration)) {
      const calculatedSec = Math.floor((endMs - startMs) / 1000);
      if (Math.abs(session.duration - calculatedSec) > 5) {
        errors.push('Session duration must be consistent with startTime and endTime');
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates settings object.
 * @param {Object} settings
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSettings(settings) {
  const errors = [];
  if (!settings || typeof settings !== 'object') {
    return { valid: false, errors: ['Settings must be a valid object'] };
  }
  if (typeof settings.dailyGoalSeconds !== 'number' || settings.dailyGoalSeconds < 0) {
    errors.push('dailyGoalSeconds must be a non-negative number');
  }
  if (settings.theme && settings.theme !== 'light' && settings.theme !== 'dark' && settings.theme !== 'system') {
    errors.push('theme must be "light", "dark", or "system"');
  }
  return { valid: errors.length === 0, errors };
}
