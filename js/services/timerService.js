/**
 * StudyTracker — Study Timer & Active Session Engine
 * Timestamp-based precision tracking with persistent recovery across reloads.
 */

import { get, put, remove, STORES } from '../db/database.js';
import { getSubjectById } from './subjectService.js';
import { saveSession } from './studyService.js';
import { formatDigitalTimer } from '../utils/timeUtils.js';

class TimerService {
  constructor() {
    this.status = 'idle'; // 'idle' | 'running' | 'completed'
    this.subjectId = null;
    this.subject = null;
    this.topic = '';
    this.startTime = null; // Timestamp ms
    this.endTime = null;   // Timestamp ms
    this.intervalId = null;
    this.listeners = new Set();
    this.originalDocTitle = document.title || 'StudyTracker — Local-First Study Time Tracker';
    this.isInitialized = false;
  }

  /**
   * Initializes timer service and restores any running or completed session from IndexedDB.
   * @returns {Promise<boolean>} True if active session was restored
   */
  async init() {
    if (this.isInitialized) return this.status === 'running' || this.status === 'completed';
    this.isInitialized = true;
    this.recoveredStatus = null;

    try {
      const activeRecord = await get(STORES.ACTIVE_SESSION, 'current');
      if (activeRecord && activeRecord.startTime) {
        if (activeRecord.status === 'running') {
          this.status = 'running';
          this.subjectId = activeRecord.subjectId;
          this.topic = activeRecord.topic || '';
          this.startTime = Number(activeRecord.startTime);
          this.endTime = null;
          this.subject = await getSubjectById(this.subjectId);
          this.recoveredStatus = 'running';

          this._startTicker();
          this._updateGlobalPill();
          this._notifyListeners();
          return true;
        } else if (activeRecord.status === 'completed' && activeRecord.endTime) {
          this.status = 'completed';
          this.subjectId = activeRecord.subjectId;
          this.topic = activeRecord.topic || '';
          this.startTime = Number(activeRecord.startTime);
          this.endTime = Number(activeRecord.endTime);
          this.subject = await getSubjectById(this.subjectId);
          this.recoveredStatus = 'completed';

          this._stopTicker();
          this._updateGlobalPill();
          this._notifyListeners();
          return true;
        }
      }
    } catch (err) {
      console.warn('StudyTracker: Could not restore active timer:', err);
    }
    return false;
  }

  /**
   * Starts a new study session.
   * @param {Object} options
   * @param {string} options.subjectId
   * @param {string} [options.topic]
   * @returns {Promise<void>}
   */
  async start({ subjectId, topic = '' }) {
    if (this.status === 'running') {
      console.warn('Timer is already running.');
      return;
    }

    if (!subjectId) {
      throw new Error('Please select a subject before starting the timer.');
    }

    const subject = await getSubjectById(subjectId);
    if (!subject) {
      throw new Error('Selected subject not found.');
    }

    this.subjectId = subjectId;
    this.subject = subject;
    this.topic = (topic || '').trim();
    this.startTime = Date.now();
    this.endTime = null;
    this.status = 'running';

    // Persist active session immediately to IndexedDB
    try {
      await put(STORES.ACTIVE_SESSION, {
        id: 'current',
        subjectId: this.subjectId,
        topic: this.topic,
        startTime: this.startTime,
        status: 'running',
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to persist active session to IndexedDB:', err);
    }

    this._startTicker();
    this._updateGlobalPill();
    this._notifyListeners();
  }

  /**
   * Stops the active study timer and transitions to 'completed' review state.
   */
  async stop() {
    if (this.status !== 'running') return;

    this.endTime = Date.now();
    this.status = 'completed';
    this._stopTicker();

    // Persist completed state so review is preserved across tab refresh/close
    try {
      await put(STORES.ACTIVE_SESSION, {
        id: 'current',
        subjectId: this.subjectId,
        topic: this.topic,
        startTime: this.startTime,
        endTime: this.endTime,
        status: 'completed',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to persist stopped session state:', err);
    }

    this._updateGlobalPill();
    this._notifyListeners();
  }

  /**
   * Saves the completed study session and resets timer to idle.
   * @param {Object} [options]
   * @param {string} [options.notes]
   * @returns {Promise<Object>}
   */
  async saveCompletedSession({ notes = '' } = {}) {
    if (!this.startTime || !this.endTime) {
      throw new Error('No completed session to save.');
    }

    // Canonical duration in floor seconds
    const durationSec = Math.max(0, Math.floor((this.endTime - this.startTime) / 1000));

    const saved = await saveSession({
      subjectId: this.subjectId,
      topic: this.topic,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: durationSec,
      notes: notes.trim()
    });

    // Clear active session record from IndexedDB
    await remove(STORES.ACTIVE_SESSION, 'current');

    this._resetState();
    return saved;
  }

  /**
   * Discards the completed session without saving.
   */
  async discardCompletedSession() {
    await remove(STORES.ACTIVE_SESSION, 'current');
    this._resetState();
  }

  /**
   * Returns current elapsed seconds.
   * @returns {number}
   */
  getElapsedSeconds() {
    if (this.status === 'running' && this.startTime) {
      return Math.max(0, Math.floor((Date.now() - this.startTime) / 1000));
    }
    if (this.status === 'completed' && this.startTime && this.endTime) {
      return Math.max(0, Math.floor((this.endTime - this.startTime) / 1000));
    }
    return 0;
  }

  /**
   * Returns a snapshot of current timer state.
   * @returns {Object}
   */
  getState() {
    return {
      status: this.status,
      elapsedSeconds: this.getElapsedSeconds(),
      subjectId: this.subjectId,
      subject: this.subject,
      topic: this.topic,
      startTime: this.startTime,
      endTime: this.endTime
    };
  }

  /**
   * Subscribes to timer state changes and ticks.
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this.listeners.add(listener);
    // Immediately fire with current state
    try {
      listener(this.getState());
    } catch (e) {
      console.error(e);
    }

    return () => {
      this.listeners.delete(listener);
    };
  }

  _startTicker() {
    this._stopTicker();
    this.intervalId = setInterval(() => {
      this._updateGlobalPill();
      this._notifyListeners();
    }, 1000);
  }

  _stopTicker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  _updateGlobalPill() {
    const pill = document.getElementById('global-active-pill');
    const timeEl = document.getElementById('global-active-time');

    if (this.status === 'running') {
      const elapsed = this.getElapsedSeconds();
      const formatted = formatDigitalTimer(elapsed);
      if (pill) pill.classList.add('is-active');
      if (timeEl) timeEl.textContent = formatted;
      document.title = `(${formatted}) StudyTracker`;
    } else {
      if (pill) pill.classList.remove('is-active');
      document.title = this.originalDocTitle;
    }
  }

  _notifyListeners() {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in timer listener:', err);
      }
    }
  }

  _resetState() {
    this._stopTicker();
    this.status = 'idle';
    this.subjectId = null;
    this.subject = null;
    this.topic = '';
    this.startTime = null;
    this.endTime = null;
    this._updateGlobalPill();
    this._notifyListeners();
  }
}

export const timerService = new TimerService();
export default timerService;
