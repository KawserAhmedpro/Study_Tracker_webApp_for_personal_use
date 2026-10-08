import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { formatDigitalTimer, formatDuration } from '../utils/timeUtils.js';
import { formatTimeRange } from '../utils/dateUtils.js';
import { getAllSubjects } from '../services/subjectService.js';
import { openSubjectModal } from '../components/subjectModal.js';
import { timerService } from '../services/timerService.js';

let timerUnsubscribe = null;

export function renderTimer() {
  return `
    <div class="timer-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Study Timer</h1>
          <p class="page-subtitle">Focus on your studies with precise, timestamp-based local tracking.</p>
        </div>
      </div>

      <div class="timer-layout">
        <!-- Active / Idle Timer Card -->
        <div class="timer-card" id="timer-main-card">
          <div class="timer-state-badge" id="timer-badge">
            ${icon('clock', { size: 14 })}
            <span id="timer-badge-text">Ready to Focus</span>
          </div>

          <!-- Digital Timer Readout -->
          <div class="timer-display" id="timer-clock" aria-live="off">
            00:00:00
          </div>

          <div class="timer-subject-pill" id="timer-current-info" style="display: none;">
            <span class="subject-dot" id="timer-running-dot" style="background-color: var(--primary);"></span>
            <span id="timer-running-subject-name" style="font-weight: 600;">Subject</span>
            <span id="timer-running-topic-name" style="color: var(--text-muted); font-size: 0.85rem;"></span>
          </div>

          <!-- Pre-Start Setup Box -->
          <div class="timer-setup-box" id="timer-setup-form">
            <div class="form-group">
              <label for="timer-subject-select" class="form-label">Subject <span class="text-danger">*</span></label>
              <div class="subject-select-row">
                <select id="timer-subject-select" class="form-select">
                  <option value="">-- Select Subject --</option>
                </select>
                <button type="button" id="btn-quick-add-subject" class="btn btn-secondary" title="Add Subject" aria-label="Add new subject">
                  ${icon('plus', { size: 16 })}
                  <span>New</span>
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="timer-topic-input" class="form-label">Topic / Task (Optional)</label>
              <input type="text" id="timer-topic-input" class="form-input" placeholder="e.g. JWT Authentication, Chapter 4, Binary Search" autocomplete="off" />
            </div>
          </div>

          <!-- Controls -->
          <div class="timer-controls">
            <button type="button" id="btn-timer-start" class="btn btn-primary btn-timer-primary">
              ${icon('play', { size: 20 })}
              <span>Start</span>
            </button>
            <button type="button" id="btn-timer-stop" class="btn btn-timer-stop btn-timer-primary" style="display: none;">
              ${icon('square', { size: 20 })}
              <span>Stop</span>
            </button>
          </div>
        </div>

        <!-- Post-Session Review & Save Card -->
        <div class="session-complete-card" id="timer-complete-card" style="display: none;">
          <div class="complete-header">
            <div class="complete-icon">
              ${icon('check', { size: 28 })}
            </div>
            <h2 class="complete-title">Study Session Completed</h2>
            <p class="text-muted" style="font-size: 0.875rem;">Great work! Review your session details below and save.</p>
          </div>

          <div class="complete-summary">
            <div class="complete-summary-row">
              <span class="complete-summary-label">Subject:</span>
              <span class="complete-summary-val" id="review-subject">Subject</span>
            </div>
            <div class="complete-summary-row">
              <span class="complete-summary-label">Topic:</span>
              <span class="complete-summary-val" id="review-topic">General Study</span>
            </div>
            <div class="complete-summary-row">
              <span class="complete-summary-label">Duration:</span>
              <span class="complete-summary-val" id="review-duration" style="color: var(--primary);">0m</span>
            </div>
            <div class="complete-summary-row">
              <span class="complete-summary-label">Time:</span>
              <span class="complete-summary-val" id="review-timerange">10:00 AM – 11:00 AM</span>
            </div>
          </div>

          <div class="form-group" style="margin-top: 0.5rem;">
            <label for="review-notes" class="form-label">Session Notes (Optional)</label>
            <textarea id="review-notes" class="form-textarea" placeholder="Key takeaways, formulas reviewed, pages read, or thoughts..." rows="3"></textarea>
          </div>

          <div class="complete-actions">
            <button type="button" id="btn-review-discard" class="btn btn-ghost">Discard</button>
            <button type="button" id="btn-review-save" class="btn btn-primary btn-lg">
              ${icon('check', { size: 18 })}
              <span>Save Session</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Populates subject dropdown in the timer setup view.
 * @param {string} [selectedId]
 */
async function populateTimerSubjects(selectedId = '') {
  const select = document.getElementById('timer-subject-select');
  if (!select) return;

  const currentVal = selectedId || select.value;
  try {
    const subjects = await getAllSubjects({ includeArchived: false });
    if (!subjects || subjects.length === 0) {
      select.innerHTML = '<option value="">-- No subjects found (click "+ New") --</option>';
      return;
    }

    select.innerHTML = `
      <option value="">-- Select Subject --</option>
      ${subjects.map((s) => `
        <option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}>
          ${escapeHtml(s.name)}
        </option>
      `).join('')}
    `;
  } catch (err) {
    console.error('Failed to populate timer subjects:', err);
  }
}

/**
 * Updates UI view to match current timer state.
 * @param {Object} state
 */
function updateTimerUI(state) {
  const mainCard = document.getElementById('timer-main-card');
  const completeCard = document.getElementById('timer-complete-card');
  const clockEl = document.getElementById('timer-clock');
  const badgeEl = document.getElementById('timer-badge');
  const badgeText = document.getElementById('timer-badge-text');
  const setupForm = document.getElementById('timer-setup-form');
  const currentInfo = document.getElementById('timer-current-info');
  const runningDot = document.getElementById('timer-running-dot');
  const runningSub = document.getElementById('timer-running-subject-name');
  const runningTopic = document.getElementById('timer-running-topic-name');
  const startBtn = document.getElementById('btn-timer-start');
  const stopBtn = document.getElementById('btn-timer-stop');

  if (!mainCard || !completeCard) return;

  if (state.status === 'running') {
    mainCard.style.display = 'flex';
    completeCard.style.display = 'none';

    if (clockEl) clockEl.textContent = formatDigitalTimer(state.elapsedSeconds);
    if (badgeEl) badgeEl.classList.add('running');
    if (badgeText) badgeText.textContent = 'Focusing...';

    if (setupForm) setupForm.style.display = 'none';
    if (currentInfo) currentInfo.style.display = 'inline-flex';

    if (runningDot) runningDot.style.backgroundColor = state.subject?.color || 'var(--primary)';
    if (runningSub) runningSub.textContent = state.subject?.name || 'Subject';
    if (runningTopic) runningTopic.textContent = state.topic ? `• ${state.topic}` : '';

    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-flex';

  } else if (state.status === 'completed') {
    mainCard.style.display = 'none';
    completeCard.style.display = 'flex';

    // Populate review summary
    const revSubject = document.getElementById('review-subject');
    const revTopic = document.getElementById('review-topic');
    const revDuration = document.getElementById('review-duration');
    const revTimeRange = document.getElementById('review-timerange');

    if (revSubject) revSubject.textContent = state.subject?.name || 'Subject';
    if (revTopic) revTopic.textContent = state.topic || 'General Study';
    if (revDuration) revDuration.textContent = formatDuration(state.elapsedSeconds, { showSeconds: true, verbose: true });
    if (revTimeRange) revTimeRange.textContent = formatTimeRange(state.startTime, state.endTime);

  } else {
    // Idle state
    mainCard.style.display = 'flex';
    completeCard.style.display = 'none';

    if (clockEl) clockEl.textContent = '00:00:00';
    if (badgeEl) badgeEl.classList.remove('running');
    if (badgeText) badgeText.textContent = 'Ready to Focus';

    if (setupForm) setupForm.style.display = 'block';
    if (currentInfo) currentInfo.style.display = 'none';

    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
  }
}

export function initTimer() {
  populateTimerSubjects();

  // Clean previous subscription if any
  if (timerUnsubscribe) {
    timerUnsubscribe();
    timerUnsubscribe = null;
  }

  // Subscribe to timer ticks and state changes
  timerUnsubscribe = timerService.subscribe((state) => {
    updateTimerUI(state);
  });

  // Start button handler
  const startBtn = document.getElementById('btn-timer-start');
  if (startBtn) {
    startBtn.addEventListener('click', async () => {
      if (startBtn.disabled) return;

      const select = document.getElementById('timer-subject-select');
      const topicInput = document.getElementById('timer-topic-input');

      const subjectId = select?.value;
      if (!subjectId) {
        toast.error('Please select a subject to start studying.');
        if (select) select.focus();
        return;
      }

      const topic = topicInput?.value || '';
      startBtn.disabled = true;
      try {
        await timerService.start({ subjectId, topic });
        toast.info('Study session started. Stay focused!');
      } catch (err) {
        toast.error(err.message || 'Failed to start timer.');
      } finally {
        startBtn.disabled = false;
      }
    });
  }

  // Stop button handler
  const stopBtn = document.getElementById('btn-timer-stop');
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      if (stopBtn.disabled || timerService.status !== 'running') return;
      stopBtn.disabled = true;
      try {
        await timerService.stop();
      } catch (err) {
        console.error('Error stopping timer:', err);
      } finally {
        stopBtn.disabled = false;
      }
    });
  }

  // Quick add subject modal
  const quickAddBtn = document.getElementById('btn-quick-add-subject');
  if (quickAddBtn) {
    quickAddBtn.addEventListener('click', () => {
      openSubjectModal({
        onSaved: (newSubject) => {
          populateTimerSubjects(newSubject.id);
        }
      });
    });
  }

  // Save session handler
  const saveBtn = document.getElementById('btn-review-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const notes = document.getElementById('review-notes')?.value || '';
      saveBtn.disabled = true;
      try {
        const saved = await timerService.saveCompletedSession({ notes });
        if (saved.duration === 0) {
          toast.info('Study session saved (0s). Tip: Run the timer longer to track substantial study time.');
        } else {
          toast.success(`Study session saved! (${formatDuration(saved.duration)})`);
        }
        // Reset inputs
        const topicInput = document.getElementById('timer-topic-input');
        if (topicInput) topicInput.value = '';
        const notesInput = document.getElementById('review-notes');
        if (notesInput) notesInput.value = '';
      } catch (err) {
        toast.error(err.message || 'Failed to save session.');
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  // Discard session handler
  const discardBtn = document.getElementById('btn-review-discard');
  if (discardBtn) {
    discardBtn.addEventListener('click', async () => {
      const confirmed = await modal.confirm({
        title: 'Discard Session',
        message: 'Are you sure you want to discard this study session? This action cannot be undone.',
        confirmText: 'Discard',
        cancelText: 'Keep',
        confirmType: 'danger'
      });

      if (confirmed) {
        await timerService.discardCompletedSession();
        toast.info('Session discarded.');
      }
    });
  }

  // External subject changes
  const handleSubjectsChanged = () => populateTimerSubjects();
  window.addEventListener('studytracker:subjects-changed', handleSubjectsChanged);

  // Return unmount cleanup function
  return () => {
    if (timerUnsubscribe) {
      timerUnsubscribe();
      timerUnsubscribe = null;
    }
    window.removeEventListener('studytracker:subjects-changed', handleSubjectsChanged);
  };
}
