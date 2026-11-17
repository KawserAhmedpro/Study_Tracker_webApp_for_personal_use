/**
 * StudyTracker — Daily Study Planner & Target Tracker Page Controller
 */

import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import {
  getLocalDateString,
  offsetDateString,
  formatDisplayDate,
  formatFullDate,
  formatWeekday
} from '../utils/dateUtils.js';
import {
  getDailyTaskSummary,
  getHistoricalTaskSummary,
  completeTask,
  reopenTask,
  deleteTask
} from '../services/plannerService.js';
import { timerService } from '../services/timerService.js';
import {
  openTaskModal,
  openPlanAgainModal,
  openSelectSubjectModal
} from '../components/taskModal.js';

let selectedDate = getLocalDateString(new Date());
let activeTab = 'daily'; // 'daily' | 'history'
let activeFilter = 'all'; // 'all' | 'pending' | 'completed' | 'overdue'
let activeSort = 'priority'; // 'priority' | 'subject' | 'created'

export function renderPlanner() {
  const todayStr = getLocalDateString(new Date());
  const tomorrowStr = offsetDateString(todayStr, 1);

  return `
    <div class="planner-page">
      <!-- Top Header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Daily Study Planner</h1>
          <p class="page-subtitle">Plan your study targets in advance, track execution with the timer, and review progress.</p>
        </div>
        <div class="planner-header-actions">
          <div class="planner-tabs" role="tablist" aria-label="Planner Views">
            <button type="button" class="planner-tab-btn active" id="tab-btn-daily" role="tab" aria-selected="true">
              ${icon('calendar', { size: 16 })}
              <span>Daily Plan</span>
            </button>
            <button type="button" class="planner-tab-btn" id="tab-btn-history" role="tab" aria-selected="false">
              ${icon('history', { size: 16 })}
              <span>Planner History</span>
            </button>
          </div>
          <button type="button" class="btn btn-primary" id="btn-add-task-top">
            ${icon('plus', { size: 18 })}
            <span>Add Task</span>
          </button>
        </div>
      </div>

      <!-- VIEW 1: Daily Planner View -->
      <div id="planner-daily-view">
        <!-- Date Navigation Bar -->
        <section class="planner-date-nav" aria-label="Target Date Navigation">
          <div class="planner-date-left">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-planner-prev" title="Previous Day" aria-label="Previous Day">
              ${icon('chevronLeft', { size: 16 })}
              <span>Prev</span>
            </button>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-planner-next" title="Next Day" aria-label="Next Day">
              <span>Next</span>
              ${icon('chevronRight', { size: 16 })}
            </button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-planner-today">Today</button>
            <button type="button" class="btn btn-outline btn-sm" id="btn-planner-tomorrow">Tomorrow</button>
          </div>

          <div class="planner-date-heading-wrap" style="text-align: center;">
            <h2 class="planner-date-title" id="planner-heading-date">
              Loading date...
            </h2>
            <span class="planner-date-subtitle" id="planner-heading-relative"></span>
          </div>

          <div class="planner-date-controls">
            <div class="planner-date-input-wrap">
              <input type="date" id="planner-date-picker" class="planner-date-picker" value="${selectedDate}" aria-label="Select Target Date" />
            </div>
          </div>
        </section>

        <!-- Daily Progress Summary Card -->
        <section class="planner-progress-card" id="planner-progress-summary" aria-label="Daily Progress Summary">
          <div class="planner-progress-header">
            <h3 class="planner-progress-title">
              ${icon('target', { size: 18 })}
              <span>Daily Target Progress</span>
            </h3>
            <span class="chip chip-tag" id="planner-time-summary">0m actual / 0m target</span>
          </div>

          <div class="planner-progress-stats">
            <div class="planner-stat-item">
              <span class="planner-stat-label">Total Tasks</span>
              <span class="planner-stat-value" id="stat-total-tasks">0</span>
              <span class="planner-stat-sub">Planned today</span>
            </div>
            <div class="planner-stat-item">
              <span class="planner-stat-label">Completed</span>
              <span class="planner-stat-value" style="color: var(--success);" id="stat-completed-tasks">0</span>
              <span class="planner-stat-sub">Finished targets</span>
            </div>
            <div class="planner-stat-item">
              <span class="planner-stat-label">Pending</span>
              <span class="planner-stat-value" style="color: var(--warning);" id="stat-pending-tasks">0</span>
              <span class="planner-stat-sub">Remaining tasks</span>
            </div>
            <div class="planner-stat-item">
              <span class="planner-stat-label">Completion Rate</span>
              <span class="planner-stat-value highlight-rate" id="stat-completion-rate">0%</span>
              <span class="planner-stat-sub">Daily achievement</span>
            </div>
          </div>

          <div class="planner-progress-track" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
            <div class="planner-progress-fill" id="planner-progress-bar" style="width: 0%;"></div>
          </div>
        </section>

        <!-- Filters & Sort Toolbar -->
        <section class="planner-toolbar" aria-label="Task Filters and Sorting" style="margin-top: 1.25rem;">
          <div class="planner-filter-pills" role="radiogroup" aria-label="Filter tasks">
            <button type="button" class="filter-pill active" data-filter="all">All</button>
            <button type="button" class="filter-pill" data-filter="pending">Pending</button>
            <button type="button" class="filter-pill" data-filter="completed">Completed</button>
            <button type="button" class="filter-pill" data-filter="overdue">Overdue</button>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label for="planner-sort-select" style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">Sort By:</label>
            <select id="planner-sort-select" class="form-select planner-sort-select">
              <option value="priority">Priority (High to Low)</option>
              <option value="subject">Subject</option>
              <option value="created">Creation Time</option>
            </select>
          </div>
        </section>

        <!-- Task Cards Container -->
        <section id="planner-tasks-container" class="planner-task-list" style="margin-top: 1rem;" aria-label="Planned Tasks List">
          <div class="empty-state">
            <div class="empty-state-icon">${icon('calendar', { size: 36 })}</div>
            <p>Loading planned tasks...</p>
          </div>
        </section>
      </div>

      <!-- VIEW 2: Planner History View -->
      <div id="planner-history-view" style="display: none;">
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header">
            <h2 class="card-title">
              ${icon('history', { size: 18 })}
              <span>Planner History & Past Days</span>
            </h2>
            <span class="chip chip-tag">Past 30 Days</span>
          </div>
          <p class="text-secondary" style="font-size: 0.88rem; margin: 0 0 1rem 0;">
            Review your planned targets and achievements across previous days. Click any date to view and inspect its planned tasks.
          </p>
          <div id="planner-history-list">
            <div class="empty-state">
              <p>Loading history...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Loads data and renders the daily planner view for `selectedDate`.
 */
async function loadAndRenderDailyView() {
  const tasksContainer = document.getElementById('planner-tasks-container');
  if (!tasksContainer) return;

  try {
    const summary = await getDailyTaskSummary(selectedDate);
    const todayStr = getLocalDateString(new Date());
    const tomorrowStr = offsetDateString(todayStr, 1);

    // Update Date Header
    const headingDate = document.getElementById('planner-heading-date');
    const headingRelative = document.getElementById('planner-heading-relative');
    const datePicker = document.getElementById('planner-date-picker');

    if (datePicker) datePicker.value = selectedDate;

    if (headingDate) {
      headingDate.textContent = formatFullDate(selectedDate);
    }

    if (headingRelative) {
      if (selectedDate === todayStr) {
        headingRelative.innerHTML = '<span class="chip chip-primary" style="font-weight: 700;">Today</span>';
      } else if (selectedDate === tomorrowStr) {
        headingRelative.innerHTML = '<span class="chip chip-tag" style="font-weight: 700;">Tomorrow</span>';
      } else if (selectedDate < todayStr) {
        headingRelative.innerHTML = `<span class="chip chip-muted">Past Date (${formatDisplayDate(selectedDate)})</span>`;
      } else {
        headingRelative.innerHTML = `<span class="chip chip-tag">Planned Ahead (${formatDisplayDate(selectedDate)})</span>`;
      }
    }

    // Highlight shortcut buttons
    const todayBtn = document.getElementById('btn-planner-today');
    const tomorrowBtn = document.getElementById('btn-planner-tomorrow');
    if (todayBtn) todayBtn.classList.toggle('active', selectedDate === todayStr);
    if (tomorrowBtn) tomorrowBtn.classList.toggle('active', selectedDate === tomorrowStr);

    // Update Progress Summary Card
    const totalEl = document.getElementById('stat-total-tasks');
    const completedEl = document.getElementById('stat-completed-tasks');
    const pendingEl = document.getElementById('stat-pending-tasks');
    const rateEl = document.getElementById('stat-completion-rate');
    const barEl = document.getElementById('planner-progress-bar');
    const timeSummaryEl = document.getElementById('planner-time-summary');

    if (totalEl) totalEl.textContent = summary.total;
    if (completedEl) completedEl.textContent = summary.completed;
    if (pendingEl) pendingEl.textContent = summary.pending;
    if (rateEl) rateEl.textContent = `${summary.completionRate}%`;

    if (barEl) {
      barEl.style.width = `${Math.min(100, summary.completionRate)}%`;
      barEl.classList.toggle('all-complete', summary.total > 0 && summary.completed === summary.total);
    }

    if (timeSummaryEl) {
      const actStr = formatDuration(summary.totalActualSeconds);
      const tgtStr = summary.totalTargetSeconds > 0 ? formatDuration(summary.totalTargetSeconds) : 'No target';
      timeSummaryEl.textContent = `${actStr} actual / ${tgtStr}`;
    }

    // Filter tasks
    let filteredTasks = [...summary.tasks];
    if (activeFilter === 'pending') {
      filteredTasks = filteredTasks.filter((t) => t.status === 'pending');
    } else if (activeFilter === 'completed') {
      filteredTasks = filteredTasks.filter((t) => t.status === 'completed');
    } else if (activeFilter === 'overdue') {
      filteredTasks = filteredTasks.filter((t) => t.isOverdue);
    }

    // Sort tasks
    filteredTasks.sort((a, b) => {
      if (activeSort === 'priority') {
        const weight = { high: 3, medium: 2, low: 1 };
        const diff = (weight[b.priority] || 2) - (weight[a.priority] || 2);
        if (diff !== 0) return diff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (activeSort === 'subject') {
        const subA = (a.subject?.name || 'zz').toLowerCase();
        const subB = (b.subject?.name || 'zz').toLowerCase();
        return subA.localeCompare(subB);
      } else {
        // created time
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
    });

    // Render Empty State
    if (filteredTasks.length === 0) {
      if (summary.total === 0) {
        tasksContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('listTodo', { size: 40 })}</div>
            <h3 class="empty-state-title">No tasks planned for this day</h3>
            <p class="empty-state-text">Plan tomorrow's study tasks in advance or add tasks for this day.</p>
            <button type="button" class="btn btn-primary btn-sm" id="btn-empty-add-task">
              ${icon('plus', { size: 16 })}
              <span>Add First Task</span>
            </button>
          </div>
        `;
        const emptyAddBtn = document.getElementById('btn-empty-add-task');
        if (emptyAddBtn) {
          emptyAddBtn.addEventListener('click', () => {
            openTaskModal({
              defaultDate: selectedDate,
              onSaved: () => loadAndRenderDailyView()
            });
          });
        }
      } else {
        tasksContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${icon('search', { size: 36 })}</div>
            <h3 class="empty-state-title">No matching tasks</h3>
            <p class="empty-state-text">No tasks match the active filter "${activeFilter}".</p>
          </div>
        `;
      }
      return;
    }

    // Render Task Cards
    const tasksHtml = filteredTasks.map((task) => {
      const isCompleted = task.status === 'completed';
      const actualStr = formatDuration(task.actualDurationSeconds);
      const targetStr = task.hasTargetDuration ? formatDuration(task.targetDurationSeconds) : null;

      // Subject Badge
      let subjectBadgeHtml = '';
      if (task.subject) {
        subjectBadgeHtml = `
          <span class="badge-subject" style="background-color: ${escapeHtml(task.subject.color)}18; color: ${escapeHtml(task.subject.color)}; border: 1px solid ${escapeHtml(task.subject.color)}35;">
            <span class="subject-dot" style="background-color: ${escapeHtml(task.subject.color)};"></span>
            <span>${escapeHtml(task.subject.name)}</span>
          </span>
        `;
      } else {
        subjectBadgeHtml = `
          <span class="badge-subject" style="background-color: var(--bg-surface-active); color: var(--text-muted); border: 1px solid var(--border-subtle);">
            <span>No Subject</span>
          </span>
        `;
      }

      // Priority Badge
      const priorityBadgeHtml = `
        <span class="badge-priority ${task.priority}">${task.priority}</span>
      `;

      // Overdue Badge
      const overdueBadgeHtml = task.isOverdue ? `
        <span class="badge-overdue" title="Overdue: scheduled for ${task.targetDate}">Overdue</span>
      ` : '';

      // Target Reached chip
      const targetReachedHtml = task.isTargetReached ? `
        <span class="chip-target-met" title="Target study duration has been reached">
          ${icon('check', { size: 12 })}
          <span>Target Met</span>
        </span>
      ` : '';

      // Duration & Progress bar
      let durationHtml = '';
      if (task.hasTargetDuration) {
        const fillPercent = task.timeProgressPercent;
        durationHtml = `
          <div class="task-time-bar-wrap">
            <div class="task-time-label-row">
              <span><strong>${actualStr}</strong> / ${targetStr} (${fillPercent}%)</span>
              ${targetReachedHtml}
            </div>
            <div class="task-time-track" role="progressbar" aria-valuenow="${fillPercent}" aria-valuemin="0" aria-valuemax="100">
              <div class="task-time-fill ${task.isTargetReached ? 'target-reached' : ''}" style="width: ${fillPercent}%;"></div>
            </div>
          </div>
        `;
      } else if (task.actualDurationSeconds > 0) {
        durationHtml = `
          <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 0.25rem;">
            ${icon('clock', { size: 12 })}
            <span>Tracked: <strong>${actualStr}</strong></span>
          </div>
        `;
      }

      // Completion details
      const completionDetailsHtml = isCompleted && task.completedAt ? `
        <span style="font-size: 0.75rem; color: var(--success); display: inline-flex; align-items: center; gap: 0.25rem;">
          ${icon('check', { size: 12 })}
          <span>Completed</span>
        </span>
      ` : '';

      return `
        <article class="task-card ${isCompleted ? 'is-completed' : ''} ${task.isOverdue ? 'is-overdue' : ''}" data-task-id="${task.id}">
          <!-- Checkbox Toggle -->
          <button
            type="button"
            class="task-check-btn btn-toggle-complete"
            data-id="${task.id}"
            data-completed="${isCompleted}"
            title="${isCompleted ? 'Mark as Pending' : 'Mark as Completed'}"
            aria-label="${isCompleted ? 'Mark task as pending' : 'Mark task as completed'}"
          >
            ${icon(isCompleted ? 'checkSquare' : 'square', { size: 22 })}
          </button>

          <!-- Content Column -->
          <div class="task-content">
            <div class="task-top-meta">
              ${subjectBadgeHtml}
              ${priorityBadgeHtml}
              ${overdueBadgeHtml}
              ${completionDetailsHtml}
            </div>

            <h3 class="task-title">${escapeHtml(task.title)}</h3>

            ${task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : ''}

            ${durationHtml}
          </div>

          <!-- Actions Column -->
          <div class="task-actions">
            <!-- Start Timer Action -->
            <button
              type="button"
              class="btn-task-timer btn-start-task-timer"
              data-id="${task.id}"
              data-subject-id="${task.subjectId || ''}"
              data-title="${escapeHtml(task.title)}"
              title="Start Timer for this task"
            >
              ${icon('play', { size: 14 })}
              <span>Timer</span>
            </button>

            <!-- Plan Again Action -->
            <button
              type="button"
              class="btn-icon btn-plan-again"
              data-id="${task.id}"
              title="Plan for another day"
              aria-label="Plan for another day"
            >
              ${icon('copy', { size: 16 })}
            </button>

            <!-- Edit Action -->
            <button
              type="button"
              class="btn-icon btn-edit-task"
              data-id="${task.id}"
              title="Edit Task"
              aria-label="Edit Task"
            >
              ${icon('edit', { size: 16 })}
            </button>

            <!-- Delete Action -->
            <button
              type="button"
              class="btn-icon btn-delete-task"
              data-id="${task.id}"
              title="Delete Task"
              aria-label="Delete Task"
            >
              ${icon('trash', { size: 16 })}
            </button>
          </div>
        </article>
      `;
    }).join('');

    tasksContainer.innerHTML = tasksHtml;

    // Attach Task Event Handlers
    attachTaskHandlers(tasksContainer);

  } catch (err) {
    console.error('Failed to load planner data:', err);
    tasksContainer.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load planned tasks.</p></div>`;
  }
}

/**
 * Attaches event handlers to task cards.
 * @param {HTMLElement} container
 */
function attachTaskHandlers(container) {
  // 1. Complete / Reopen Toggle
  container.querySelectorAll('.btn-toggle-complete').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const isCompleted = btn.getAttribute('data-completed') === 'true';

      try {
        if (isCompleted) {
          await reopenTask(id);
          toast.info('Task moved back to Pending.');
        } else {
          await completeTask(id);
          toast.success('Task marked as Completed! Great job.');
        }
        loadAndRenderDailyView();
      } catch (err) {
        toast.error(err.message || 'Failed to update task status.');
      }
    });
  });

  // 2. Start Timer Directly from Task
  container.querySelectorAll('.btn-start-task-timer').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const subjectId = btn.getAttribute('data-subject-id');
      const title = btn.getAttribute('data-title');

      if (timerService.status === 'running') {
        const confirmed = await modal.confirm({
          title: 'Timer Already Running',
          message: `A study session is currently running for "${timerService.subject?.name || 'Subject'}". Would you like to switch to timer view to finish or review it first?`,
          confirmText: 'Go to Timer',
          cancelText: 'Stay Here',
          confirmType: 'primary'
        });
        if (confirmed) {
          window.location.hash = '#/timer';
        }
        return;
      }

      if (subjectId) {
        try {
          await timerService.start({
            subjectId,
            topic: title,
            taskId: id
          });
          toast.info(`Study timer started for "${title}"!`);
          window.location.hash = '#/timer';
        } catch (err) {
          toast.error(err.message || 'Failed to start timer.');
        }
      } else {
        // Task has no subject -> prompt user to pick or create one
        openSelectSubjectModal({
          task: { id, title },
          onSelected: async (selectedSubId) => {
            try {
              await timerService.start({
                subjectId: selectedSubId,
                topic: title,
                taskId: id
              });
              toast.info(`Study timer started for "${title}"!`);
              window.location.hash = '#/timer';
            } catch (err) {
              toast.error(err.message || 'Failed to start timer.');
            }
          }
        });
      }
    });
  });

  // 3. Plan Again
  container.querySelectorAll('.btn-plan-again').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const summary = await getDailyTaskSummary(selectedDate);
      const task = summary.tasks.find((t) => t.id === id);
      if (task) {
        openPlanAgainModal({
          task,
          onSaved: () => loadAndRenderDailyView()
        });
      }
    });
  });

  // 4. Edit Task
  container.querySelectorAll('.btn-edit-task').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const summary = await getDailyTaskSummary(selectedDate);
      const task = summary.tasks.find((t) => t.id === id);
      if (task) {
        openTaskModal({
          task,
          defaultDate: selectedDate,
          onSaved: () => loadAndRenderDailyView()
        });
      }
    });
  });

  // 5. Delete Task
  container.querySelectorAll('.btn-delete-task').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const confirmed = await modal.confirm({
        title: 'Delete Planned Task',
        message: 'Are you sure you want to delete this planned task? Any study sessions you previously logged will remain safe.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        confirmType: 'danger'
      });

      if (confirmed) {
        try {
          await deleteTask(id);
          toast.success('Planned task deleted.');
          loadAndRenderDailyView();
        } catch (err) {
          toast.error(err.message || 'Failed to delete task.');
        }
      }
    });
  });
}

/**
 * Loads data and renders the historical planner view.
 */
async function loadAndRenderHistoryView() {
  const container = document.getElementById('planner-history-list');
  if (!container) return;

  try {
    const historicalSummaries = await getHistoricalTaskSummary(30);

    // Filter to days that have planned tasks or study time
    const activeDays = historicalSummaries.filter((d) => d.total > 0 || d.actualDurationSeconds > 0);

    if (activeDays.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('history', { size: 36 })}</div>
          <h3 class="empty-state-title">No historical planned tasks yet</h3>
          <p class="empty-state-text">Start planning your daily study tasks, and your historical records will be recorded here.</p>
        </div>
      `;
      return;
    }

    const html = activeDays.map((d) => {
      const completionPercent = d.total > 0 ? d.completionRate : 0;
      const actualStr = formatDuration(d.actualDurationSeconds);

      return `
        <div class="history-day-card" data-date="${d.date}">
          <div class="history-day-info">
            <h3 class="history-day-date">
              ${icon('calendar', { size: 16 })}
              <span>${d.displayDate}</span>
              <span class="chip chip-tag" style="font-size: 0.75rem;">${d.weekday}</span>
            </h3>
            <span class="history-day-sub">Actual study tracked: <strong>${actualStr}</strong></span>
          </div>

          <div class="history-day-stats">
            <div class="history-stat-group">
              <span class="history-stat-num">${d.total}</span>
              <span class="history-stat-lbl">Planned</span>
            </div>
            <div class="history-stat-group">
              <span class="history-stat-num" style="color: var(--success);">${d.completed}</span>
              <span class="history-stat-lbl">Completed</span>
            </div>
            <div class="history-stat-group">
              <span class="history-stat-num" style="color: var(--warning);">${d.pending}</span>
              <span class="history-stat-lbl">Pending</span>
            </div>
            <div class="history-stat-group">
              <span class="history-stat-num" style="color: var(--primary);">${completionPercent}%</span>
              <span class="history-stat-lbl">Rate</span>
            </div>
            <div>
              <button type="button" class="btn btn-secondary btn-sm btn-inspect-day-tasks" data-date="${d.date}">
                <span>View Tasks</span>
                ${icon('chevronRight', { size: 14 })}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;

    container.querySelectorAll('.btn-inspect-day-tasks').forEach((btn) => {
      btn.addEventListener('click', () => {
        const date = btn.getAttribute('data-date');
        if (date) {
          selectedDate = date;
          switchTab('daily');
          loadAndRenderDailyView();
        }
      });
    });

  } catch (err) {
    console.error('Failed to load planner history:', err);
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load planner history.</p></div>`;
  }
}

/**
 * Switches between Daily Plan and Planner History tabs.
 * @param {'daily'|'history'} tab
 */
function switchTab(tab) {
  activeTab = tab;
  const dailyTabBtn = document.getElementById('tab-btn-daily');
  const historyTabBtn = document.getElementById('tab-btn-history');
  const dailyView = document.getElementById('planner-daily-view');
  const historyView = document.getElementById('planner-history-view');

  if (dailyTabBtn) {
    dailyTabBtn.classList.toggle('active', tab === 'daily');
    dailyTabBtn.setAttribute('aria-selected', tab === 'daily');
  }
  if (historyTabBtn) {
    historyTabBtn.classList.toggle('active', tab === 'history');
    historyTabBtn.setAttribute('aria-selected', tab === 'history');
  }

  if (dailyView) dailyView.style.display = tab === 'daily' ? 'block' : 'none';
  if (historyView) historyView.style.display = tab === 'history' ? 'block' : 'none';

  if (tab === 'daily') {
    loadAndRenderDailyView();
  } else {
    loadAndRenderHistoryView();
  }
}

export function initPlanner() {
  const todayStr = getLocalDateString(new Date());

  // Top Add Task Button
  const topAddBtn = document.getElementById('btn-add-task-top');
  if (topAddBtn) {
    topAddBtn.addEventListener('click', () => {
      openTaskModal({
        defaultDate: selectedDate,
        onSaved: () => loadAndRenderDailyView()
      });
    });
  }

  // Tabs
  const dailyTabBtn = document.getElementById('tab-btn-daily');
  const historyTabBtn = document.getElementById('tab-btn-history');
  if (dailyTabBtn) dailyTabBtn.addEventListener('click', () => switchTab('daily'));
  if (historyTabBtn) historyTabBtn.addEventListener('click', () => switchTab('history'));

  // Date Navigation Controls
  const prevBtn = document.getElementById('btn-planner-prev');
  const nextBtn = document.getElementById('btn-planner-next');
  const todayBtn = document.getElementById('btn-planner-today');
  const tomorrowBtn = document.getElementById('btn-planner-tomorrow');
  const datePicker = document.getElementById('planner-date-picker');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      selectedDate = offsetDateString(selectedDate, -1);
      loadAndRenderDailyView();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      selectedDate = offsetDateString(selectedDate, 1);
      loadAndRenderDailyView();
    });
  }

  if (todayBtn) {
    todayBtn.addEventListener('click', () => {
      selectedDate = todayStr;
      loadAndRenderDailyView();
    });
  }

  if (tomorrowBtn) {
    tomorrowBtn.addEventListener('click', () => {
      selectedDate = offsetDateString(todayStr, 1);
      loadAndRenderDailyView();
    });
  }

  if (datePicker) {
    datePicker.addEventListener('change', () => {
      if (datePicker.value) {
        selectedDate = datePicker.value;
        loadAndRenderDailyView();
      }
    });
  }

  // Filter Pills
  document.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      activeFilter = pill.getAttribute('data-filter') || 'all';
      loadAndRenderDailyView();
    });
  });

  // Sort Select
  const sortSelect = document.getElementById('planner-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      activeSort = sortSelect.value;
      loadAndRenderDailyView();
    });
  }

  // Initial render
  switchTab(activeTab);

  // Background update listeners
  const handleUpdate = () => {
    if (activeTab === 'daily') {
      loadAndRenderDailyView();
    } else {
      loadAndRenderHistoryView();
    }
  };

  window.addEventListener('studytracker:tasks-changed', handleUpdate);
  window.addEventListener('studytracker:sessions-changed', handleUpdate);
  window.addEventListener('studytracker:subjects-changed', handleUpdate);

  // Return teardown cleanup
  return () => {
    window.removeEventListener('studytracker:tasks-changed', handleUpdate);
    window.removeEventListener('studytracker:sessions-changed', handleUpdate);
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
  };
}

