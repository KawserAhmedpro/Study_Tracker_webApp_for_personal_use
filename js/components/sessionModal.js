/**
 * StudyTracker — Edit Study Session Modal Component
 */

import { modal } from './modal.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { toSeconds, secondsToTimeComponents } from '../utils/timeUtils.js';
import { getAllSubjects } from '../services/subjectService.js';
import { updateSession } from '../services/studyService.js';

/**
 * Opens a modal dialog to edit an existing study session.
 * @param {Object} options
 * @param {Object} options.session - The session object to edit
 * @param {Function} [options.onSaved] - Callback when changes are saved
 */
export async function openSessionModal({ session, onSaved }) {
  if (!session) return;

  const subjects = await getAllSubjects({ includeArchived: true });
  const { hours, minutes } = secondsToTimeComponents(session.duration);

  const subjectOptions = subjects.map((s) => {
    const isSelected = s.id === session.subjectId;
    return `<option value="${s.id}" ${isSelected ? 'selected' : ''}>${escapeHtml(s.name)}${s.archived ? ' (Archived)' : ''}</option>`;
  }).join('');

  const contentHtml = `
    <form id="session-modal-form" novalidate>
      <div class="form-group">
        <label for="modal-session-subject" class="form-label">Subject <span class="text-danger">*</span></label>
        <select id="modal-session-subject" class="form-select" required>
          ${subjectOptions}
        </select>
      </div>

      <div class="form-group">
        <label for="modal-session-topic" class="form-label">Topic / Task</label>
        <input type="text" id="modal-session-topic" class="form-input" value="${escapeHtml(session.topic || '')}" placeholder="e.g. Chapter 5, Dynamic Programming" autocomplete="off" />
      </div>

      <div class="form-group">
        <label for="modal-session-date" class="form-label">Date <span class="text-danger">*</span></label>
        <input type="date" id="modal-session-date" class="form-input" value="${session.date || ''}" required />
      </div>

      <div class="form-group">
        <label class="form-label">Duration <span class="text-danger">*</span></label>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="flex: 1;">
            <input type="number" id="modal-session-hours" class="form-input" min="0" max="24" value="${hours}" placeholder="Hours" />
            <span style="font-size: 0.75rem; color: var(--text-muted);">Hours</span>
          </div>
          <div style="flex: 1;">
            <input type="number" id="modal-session-mins" class="form-input" min="0" max="59" value="${minutes}" placeholder="Minutes" />
            <span style="font-size: 0.75rem; color: var(--text-muted);">Minutes</span>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label for="modal-session-notes" class="form-label">Notes</label>
        <textarea id="modal-session-notes" class="form-textarea" rows="3" placeholder="Key takeaways or thoughts...">${escapeHtml(session.notes || '')}</textarea>
      </div>

      <div id="modal-session-error" class="form-error" style="display: none; color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="modal-btn-save-session" class="btn btn-primary">
      <span>Save Changes</span>
    </button>
  `;

  modal.open({
    title: 'Edit Study Session',
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const saveBtn = modalEl.querySelector('#modal-btn-save-session');
      const form = modalEl.querySelector('#session-modal-form');
      const errorEl = modalEl.querySelector('#modal-session-error');

      cancelBtn.addEventListener('click', () => modal.close());

      const handleSave = async () => {
        errorEl.style.display = 'none';
        errorEl.textContent = '';

        const subjectId = modalEl.querySelector('#modal-session-subject')?.value;
        const topic = modalEl.querySelector('#modal-session-topic')?.value || '';
        const date = modalEl.querySelector('#modal-session-date')?.value;
        const h = parseInt(modalEl.querySelector('#modal-session-hours')?.value, 10) || 0;
        const m = parseInt(modalEl.querySelector('#modal-session-mins')?.value, 10) || 0;
        const notes = modalEl.querySelector('#modal-session-notes')?.value || '';

        if (!subjectId) {
          errorEl.textContent = 'Subject is required.';
          errorEl.style.display = 'block';
          return;
        }

        if (!date) {
          errorEl.textContent = 'Date is required.';
          errorEl.style.display = 'block';
          return;
        }

        const duration = toSeconds(h, m);
        if (duration <= 0) {
          errorEl.textContent = 'Duration must be at least 1 minute.';
          errorEl.style.display = 'block';
          return;
        }

        saveBtn.disabled = true;
        try {
          const updated = await updateSession(session.id, {
            subjectId,
            topic,
            date,
            duration,
            notes
          });
          toast.success('Study session updated.');
          modal.close();
          if (typeof onSaved === 'function') {
            onSaved(updated);
          }
        } catch (err) {
          saveBtn.disabled = false;
          errorEl.textContent = err.message || 'Failed to update session.';
          errorEl.style.display = 'block';
        }
      };

      saveBtn.addEventListener('click', handleSave);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSave();
      });
    }
  });
}
