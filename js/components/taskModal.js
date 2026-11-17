/**
 * StudyTracker — Task Modal & Plan Again Dialogs
 */

import { modal } from './modal.js';
import { toast } from './toast.js';
import { icon } from './icons.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { toSeconds, secondsToTimeComponents } from '../utils/timeUtils.js';
import { getLocalDateString, offsetDateString, formatDisplayDate } from '../utils/dateUtils.js';
import { getAllSubjects } from '../services/subjectService.js';
import { openSubjectModal } from './subjectModal.js';
import { createTask, updateTask, planTaskAgain } from '../services/plannerService.js';

/**
 * Opens a modal dialog to create or edit a planned task.
 * @param {Object} options
 * @param {Object} [options.task] - Existing task if editing
 * @param {string} [options.defaultDate] - Default date (YYYY-MM-DD) if creating
 * @param {Function} [options.onSaved] - Callback on save
 */
export async function openTaskModal({ task, defaultDate, onSaved } = {}) {
  const isEditing = Boolean(task && task.id);
  const subjects = await getAllSubjects({ includeArchived: false });
  const todayStr = getLocalDateString(new Date());
  const initialDate = task ? task.targetDate : (defaultDate || todayStr);

  const durationSec = task ? (task.targetDurationSeconds || 0) : 0;
  const { hours, minutes } = secondsToTimeComponents(durationSec);

  const renderSubjectOptions = (selectedId) => {
    return [
      '<option value="">-- No Subject (General / None) --</option>',
      ...subjects.map((s) => `
        <option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>
          ${escapeHtml(s.name)}
        </option>
      `)
    ].join('');
  };

  const contentHtml = `
    <form id="task-modal-form" novalidate>
      <div class="form-group">
        <label for="task-input-title" class="form-label">
          Task Title <span class="text-danger">*</span>
        </label>
        <input
          type="text"
          id="task-input-title"
          class="form-input"
          placeholder="e.g. Study KNN algorithm, Practice SQL JOIN"
          value="${task ? escapeHtml(task.title) : ''}"
          required
          autocomplete="off"
        />
      </div>

      <div class="form-group">
        <label for="task-select-subject" class="form-label">Subject (Optional)</label>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="task-select-subject" class="form-select" style="flex: 1;">
            ${renderSubjectOptions(task ? task.subjectId : '')}
          </select>
          <button type="button" id="btn-modal-add-subject" class="btn btn-secondary" title="Create new subject">
            ${icon('plus', { size: 14 })}
            <span>New</span>
          </button>
        </div>
      </div>

      <div class="form-group">
        <label for="task-input-date" class="form-label">
          Target Date <span class="text-danger">*</span>
        </label>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <input
            type="date"
            id="task-input-date"
            class="form-input"
            value="${initialDate}"
            style="flex: 1; min-width: 140px;"
            required
          />
          <button type="button" id="btn-quick-today" class="btn btn-ghost btn-sm">Today</button>
          <button type="button" id="btn-quick-tomorrow" class="btn btn-ghost btn-sm">Tomorrow</button>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">
          Target Duration (Optional)
        </label>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="flex: 1;">
            <input
              type="number"
              id="task-input-hours"
              class="form-input"
              min="0"
              max="24"
              value="${durationSec > 0 ? hours : ''}"
              placeholder="0"
            />
            <span style="font-size: 0.75rem; color: var(--text-muted);">Hours</span>
          </div>
          <div style="flex: 1;">
            <input
              type="number"
              id="task-input-minutes"
              class="form-input"
              min="0"
              max="59"
              step="5"
              value="${durationSec > 0 ? minutes : ''}"
              placeholder="0"
            />
            <span style="font-size: 0.75rem; color: var(--text-muted);">Minutes</span>
          </div>
        </div>
        <p style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.25rem;">
          Leave empty if this task does not require a specific duration goal.
        </p>
      </div>

      <div class="form-group">
        <label for="task-select-priority" class="form-label">Priority</label>
        <select id="task-select-priority" class="form-select">
          <option value="high" ${task && task.priority === 'high' ? 'selected' : ''}>High Priority</option>
          <option value="medium" ${!task || task.priority === 'medium' ? 'selected' : ''}>Medium Priority</option>
          <option value="low" ${task && task.priority === 'low' ? 'selected' : ''}>Low Priority</option>
        </select>
      </div>

      <div class="form-group">
        <label for="task-input-desc" class="form-label">Description / Notes (Optional)</label>
        <textarea
          id="task-input-desc"
          class="form-textarea"
          rows="3"
          placeholder="Specific sub-topics, exercise numbers, textbook chapters, or goals..."
        >${task ? escapeHtml(task.description || '') : ''}</textarea>
      </div>

      <div id="task-modal-error" class="form-error" style="display: none; color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem;"></div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="btn-save-task" class="btn btn-primary">
      ${icon(isEditing ? 'check' : 'plus', { size: 16 })}
      <span>${isEditing ? 'Save Changes' : 'Create Task'}</span>
    </button>
  `;

  modal.open({
    title: isEditing ? 'Edit Planned Task' : 'Add Planned Task',
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const form = modalEl.querySelector('#task-modal-form');
      const saveBtn = modalEl.querySelector('#btn-save-task');
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const errorEl = modalEl.querySelector('#task-modal-error');
      const subjectSelect = modalEl.querySelector('#task-select-subject');
      const addSubjectBtn = modalEl.querySelector('#btn-modal-add-subject');
      const dateInput = modalEl.querySelector('#task-input-date');
      const quickToday = modalEl.querySelector('#btn-quick-today');
      const quickTomorrow = modalEl.querySelector('#btn-quick-tomorrow');

      cancelBtn.addEventListener('click', () => modal.close());

      quickToday.addEventListener('click', () => {
        if (dateInput) dateInput.value = todayStr;
      });

      quickTomorrow.addEventListener('click', () => {
        if (dateInput) dateInput.value = offsetDateString(todayStr, 1);
      });

      if (addSubjectBtn) {
        addSubjectBtn.addEventListener('click', () => {
          openSubjectModal({
            onSaved: (newSub) => {
              subjects.push(newSub);
              if (subjectSelect) {
                subjectSelect.innerHTML = renderSubjectOptions(newSub.id);
              }
            }
          });
        });
      }

      const handleSave = async () => {
        errorEl.style.display = 'none';
        errorEl.textContent = '';

        const title = modalEl.querySelector('#task-input-title')?.value.trim();
        const subjectId = modalEl.querySelector('#task-select-subject')?.value || null;
        const targetDate = modalEl.querySelector('#task-input-date')?.value;
        const hoursVal = parseInt(modalEl.querySelector('#task-input-hours')?.value, 10) || 0;
        const minsVal = parseInt(modalEl.querySelector('#task-input-minutes')?.value, 10) || 0;
        const priority = modalEl.querySelector('#task-select-priority')?.value || 'medium';
        const description = modalEl.querySelector('#task-input-desc')?.value.trim() || '';

        if (!title) {
          errorEl.textContent = 'Please enter a task title.';
          errorEl.style.display = 'block';
          modalEl.querySelector('#task-input-title')?.focus();
          return;
        }

        if (!targetDate) {
          errorEl.textContent = 'Please select a target date.';
          errorEl.style.display = 'block';
          return;
        }

        const totalSec = toSeconds(hoursVal, minsVal);
        const targetDurationSeconds = totalSec > 0 ? totalSec : null;

        saveBtn.disabled = true;
        try {
          let savedTask;
          if (isEditing) {
            savedTask = await updateTask(task.id, {
              title,
              subjectId,
              targetDate,
              targetDurationSeconds,
              priority,
              description
            });
            toast.success('Planned task updated.');
          } else {
            savedTask = await createTask({
              title,
              subjectId,
              targetDate,
              targetDurationSeconds,
              priority,
              description
            });
            toast.success('Task added to plan.');
          }

          modal.close();
          if (typeof onSaved === 'function') {
            onSaved(savedTask);
          }
        } catch (err) {
          saveBtn.disabled = false;
          errorEl.textContent = err.message || 'Failed to save task.';
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

/**
 * Opens dialog to re-plan an existing task for a different date.
 * Preserves the original task and creates a new occurrence.
 * @param {Object} options
 * @param {Object} options.task
 * @param {Function} [options.onSaved]
 */
export function openPlanAgainModal({ task, onSaved } = {}) {
  if (!task) return;

  const todayStr = getLocalDateString(new Date());
  const tomorrowStr = offsetDateString(todayStr, 1);
  const defaultNextDate = task.targetDate < todayStr ? todayStr : tomorrowStr;

  const contentHtml = `
    <div class="plan-again-dialog">
      <div style="background-color: var(--bg-surface-hover); border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
        <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 700;">Original Task</span>
        <h3 style="font-size: 1.05rem; font-weight: 600; margin: 0.25rem 0 0.25rem 0; color: var(--text-primary);">${escapeHtml(task.title)}</h3>
        <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Planned for: ${formatDisplayDate(task.targetDate)}</p>
      </div>

      <div class="form-group">
        <label for="plan-again-date" class="form-label">Select New Target Date <span class="text-danger">*</span></label>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <input type="date" id="plan-again-date" class="form-input" value="${defaultNextDate}" style="flex: 1; min-width: 140px;" />
          <button type="button" id="btn-plan-again-today" class="btn btn-ghost btn-sm">Today</button>
          <button type="button" id="btn-plan-again-tomorrow" class="btn btn-ghost btn-sm">Tomorrow</button>
        </div>
      </div>

      <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.5rem; line-height: 1.4;">
        A new task occurrence will be created for the selected date. The original task record and its historical completion state will remain intact.
      </p>

      <div id="plan-again-error" class="form-error" style="display: none; color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem;"></div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="btn-confirm-plan-again" class="btn btn-primary">
      ${icon('copy', { size: 16 })}
      <span>Plan for Date</span>
    </button>
  `;

  modal.open({
    title: 'Plan Task Again',
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const confirmBtn = modalEl.querySelector('#btn-confirm-plan-again');
      const dateInput = modalEl.querySelector('#plan-again-date');
      const todayBtn = modalEl.querySelector('#btn-plan-again-today');
      const tomorrowBtn = modalEl.querySelector('#btn-plan-again-tomorrow');
      const errorEl = modalEl.querySelector('#plan-again-error');

      cancelBtn.addEventListener('click', () => modal.close());

      todayBtn.addEventListener('click', () => {
        if (dateInput) dateInput.value = todayStr;
      });

      tomorrowBtn.addEventListener('click', () => {
        if (dateInput) dateInput.value = tomorrowStr;
      });

      confirmBtn.addEventListener('click', async () => {
        errorEl.style.display = 'none';
        const newDate = dateInput?.value;
        if (!newDate) {
          errorEl.textContent = 'Please choose a target date.';
          errorEl.style.display = 'block';
          return;
        }

        confirmBtn.disabled = true;
        try {
          const newTask = await planTaskAgain(task.id, newDate);
          toast.success(`Task scheduled for ${formatDisplayDate(newDate)}!`);
          modal.close();
          if (typeof onSaved === 'function') {
            onSaved(newTask);
          }
        } catch (err) {
          confirmBtn.disabled = false;
          errorEl.textContent = err.message || 'Failed to plan task.';
          errorEl.style.display = 'block';
        }
      });
    }
  });
}

/**
 * Opens a modal to select a subject when starting the timer on a task that has no subject.
 * @param {Object} options
 * @param {Object} options.task
 * @param {Function} options.onSelected - Called with selected subjectId
 */
export async function openSelectSubjectModal({ task, onSelected } = {}) {
  const subjects = await getAllSubjects({ includeArchived: false });

  const renderSubjectOptions = () => {
    if (!subjects || subjects.length === 0) {
      return '<option value="">-- No subjects found (click "+ New") --</option>';
    }
    return [
      '<option value="">-- Select Subject --</option>',
      ...subjects.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    ].join('');
  };

  const contentHtml = `
    <div class="select-subject-dialog">
      <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem;">
        The task <strong>“${escapeHtml(task ? task.title : '')}”</strong> does not have an assigned subject. To start the study timer, please choose a subject to track this session under:
      </p>

      <div class="form-group">
        <label for="select-task-subject" class="form-label">Subject <span class="text-danger">*</span></label>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <select id="select-task-subject" class="form-select" style="flex: 1;">
            ${renderSubjectOptions()}
          </select>
          <button type="button" id="btn-quick-new-subject" class="btn btn-secondary" title="Add Subject">
            ${icon('plus', { size: 14 })}
            <span>New</span>
          </button>
        </div>
      </div>

      <div id="select-subject-error" class="form-error" style="display: none; color: var(--danger); font-size: 0.85rem; margin-top: 0.5rem;"></div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="btn-start-with-subject" class="btn btn-primary">
      ${icon('play', { size: 16 })}
      <span>Start Timer</span>
    </button>
  `;

  modal.open({
    title: 'Select Subject to Focus',
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const startBtn = modalEl.querySelector('#btn-start-with-subject');
      const select = modalEl.querySelector('#select-task-subject');
      const newSubBtn = modalEl.querySelector('#btn-quick-new-subject');
      const errorEl = modalEl.querySelector('#select-subject-error');

      cancelBtn.addEventListener('click', () => modal.close());

      if (newSubBtn) {
        newSubBtn.addEventListener('click', () => {
          openSubjectModal({
            onSaved: (newSub) => {
              subjects.push(newSub);
              if (select) {
                select.innerHTML = renderSubjectOptions();
                select.value = newSub.id;
              }
            }
          });
        });
      }

      startBtn.addEventListener('click', () => {
        errorEl.style.display = 'none';
        const subjectId = select?.value;
        if (!subjectId) {
          errorEl.textContent = 'Please select a subject to continue.';
          errorEl.style.display = 'block';
          return;
        }

        modal.close();
        if (typeof onSelected === 'function') {
          onSelected(subjectId);
        }
      });
    }
  });
}

