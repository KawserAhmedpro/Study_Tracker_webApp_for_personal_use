import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { formatDuration } from '../utils/timeUtils.js';
import { formatDisplayDate, formatTimeRange } from '../utils/dateUtils.js';
import { getAllSubjects } from '../services/subjectService.js';
import { getAllSessions, getSessionById, deleteSession } from '../services/studyService.js';
import { openSessionModal } from '../components/sessionModal.js';

export function renderHistory() {
  return `
    <div class="history-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Study History</h1>
          <p class="page-subtitle">Review, search, and manage your past study sessions.</p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <section class="history-filter-bar" aria-label="Session Filters">
        <div class="search-input-wrap">
          <span class="search-icon">${icon('search', { size: 16 })}</span>
          <input type="text" id="history-search" class="form-input" placeholder="Search topic or notes..." autocomplete="off" />
        </div>

        <div>
          <select id="history-subject-filter" class="form-select" aria-label="Filter by subject">
            <option value="ALL">All Subjects</option>
          </select>
        </div>

        <div>
          <input type="date" id="history-date-filter" class="form-input" aria-label="Filter by date" />
        </div>

        <div>
          <button type="button" id="history-reset-filters" class="btn btn-secondary btn-sm" style="width: 100%;">
            ${icon('rotateCcw', { size: 14 })}
            <span>Reset</span>
          </button>
        </div>
      </section>

      <!-- Date-Grouped History Sessions -->
      <section id="history-groups-container" class="history-groups" aria-label="Grouped Sessions">
        <div class="empty-state">
          <div class="empty-state-icon">${icon('history', { size: 36 })}</div>
          <h2 class="empty-state-title">Loading history...</h2>
        </div>
      </section>
    </div>
  `;
}

/**
 * Populates subject filter select dropdown.
 * @param {Array<Object>} subjects
 */
function populateSubjectFilter(subjects) {
  const select = document.getElementById('history-subject-filter');
  if (!select) return;

  const currentVal = select.value || 'ALL';
  const options = [
    '<option value="ALL">All Subjects</option>',
    ...subjects.map((s) => `
      <option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}>
        ${escapeHtml(s.name)}${s.archived ? ' (Archived)' : ''}
      </option>
    `)
  ];

  select.innerHTML = options.join('');
}

/**
 * Loads, filters, groups, and renders study history cards.
 */
async function loadAndRenderHistory() {
  const container = document.getElementById('history-groups-container');
  if (!container) return;

  try {
    const [allSessions, subjects] = await Promise.all([
      getAllSessions(),
      getAllSubjects({ includeArchived: true })
    ]);

    populateSubjectFilter(subjects);

    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    if (!allSessions || allSessions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('history', { size: 36 })}</div>
          <h2 class="empty-state-title">No study sessions recorded yet</h2>
          <p class="empty-state-text">Once you complete and save sessions with the study timer, your log will appear here grouped by date.</p>
          <a href="#/timer" class="btn btn-primary btn-sm">
            ${icon('play', { size: 14 })}
            <span>Start a Session</span>
          </a>
        </div>
      `;
      return;
    }

    // Read filter values
    const searchVal = (document.getElementById('history-search')?.value || '').trim().toLowerCase();
    const selectedSubject = document.getElementById('history-subject-filter')?.value || 'ALL';
    const selectedDate = document.getElementById('history-date-filter')?.value || '';

    // Apply filtering
    const filtered = allSessions.filter((session) => {
      // Subject filter
      if (selectedSubject !== 'ALL' && session.subjectId !== selectedSubject) {
        return false;
      }

      // Date filter
      if (selectedDate && session.date !== selectedDate) {
        return false;
      }

      // Search filter
      if (searchVal) {
        const sub = subjectMap.get(session.subjectId);
        const matchTopic = (session.topic || '').toLowerCase().includes(searchVal);
        const matchNotes = (session.notes || '').toLowerCase().includes(searchVal);
        const matchSubject = sub && sub.name.toLowerCase().includes(searchVal);
        if (!matchTopic && !matchNotes && !matchSubject) {
          return false;
        }
      }

      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon('search', { size: 36 })}</div>
          <h2 class="empty-state-title">No matching study sessions</h2>
          <p class="empty-state-text">No sessions found matching your current filters.</p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-empty-reset-filters">
            ${icon('rotateCcw', { size: 14 })}
            <span>Reset Filters</span>
          </button>
        </div>
      `;

      const resetBtn = document.getElementById('btn-empty-reset-filters');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          resetAllFilters();
          loadAndRenderHistory();
        });
      }
      return;
    }

    // Group sessions by date string (YYYY-MM-DD)
    const groupedByDate = new Map();
    for (const session of filtered) {
      const d = session.date || 'Unknown Date';
      if (!groupedByDate.has(d)) {
        groupedByDate.set(d, []);
      }
      groupedByDate.get(d).push(session);
    }

    // Build HTML for each date group
    let html = '';
    for (const [dateStr, sessions] of groupedByDate.entries()) {
      const dayTotalSec = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
      const displayDate = formatDisplayDate(dateStr);
      const totalFormatted = formatDuration(dayTotalSec);

      const cardsHtml = sessions.map((session) => {
        const sub = subjectMap.get(session.subjectId) || { name: 'Unknown Subject', color: '#64748b' };
        const timeRangeStr = formatTimeRange(session.startTime, session.endTime);
        const durStr = formatDuration(session.duration || 0);

        return `
          <div class="history-card" data-id="${session.id}">
            <div class="history-card-main">
              <div class="history-card-header">
                <span class="subject-color-chip" style="background-color: ${escapeHtml(sub.color)};"></span>
                <span style="font-weight: 700; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(sub.name)}</span>
                <span class="history-card-topic">• ${escapeHtml(session.topic || 'General Study')}</span>
              </div>
              ${timeRangeStr ? `<div class="history-card-meta">${escapeHtml(timeRangeStr)}</div>` : ''}
              ${session.notes ? `<div class="history-card-notes">“${escapeHtml(session.notes)}”</div>` : ''}
            </div>

            <div class="history-card-side">
              <div class="history-card-duration">${durStr}</div>
              <div class="history-card-actions">
                <button type="button" class="btn-icon btn-edit-session" data-id="${session.id}" title="Edit Session" aria-label="Edit session">
                  ${icon('edit', { size: 16 })}
                </button>
                <button type="button" class="btn-icon btn-delete-session" data-id="${session.id}" title="Delete Session" aria-label="Delete session">
                  ${icon('trash', { size: 16 })}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      html += `
        <div class="date-group">
          <div class="date-group-header">
            <h2 class="date-group-title">
              ${icon('calendar', { size: 16 })}
              <span>${escapeHtml(displayDate)}</span>
            </h2>
            <span class="date-group-total">Total: ${totalFormatted}</span>
          </div>
          <div class="history-cards">
            ${cardsHtml}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Attach Edit and Delete listeners
    container.querySelectorAll('.btn-edit-session').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const session = await getSessionById(id);
        if (session) {
          openSessionModal({
            session,
            onSaved: () => loadAndRenderHistory()
          });
        }
      });
    });

    container.querySelectorAll('.btn-delete-session').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const confirmed = await modal.confirm({
          title: 'Delete Study Session',
          message: 'Are you sure you want to delete this study session? This action cannot be undone.',
          confirmText: 'Delete',
          cancelText: 'Cancel',
          confirmType: 'danger'
        });

        if (confirmed) {
          try {
            await deleteSession(id);
            toast.success('Study session deleted.');
            loadAndRenderHistory();
          } catch (err) {
            toast.error(err.message || 'Failed to delete session.');
          }
        }
      });
    });

  } catch (err) {
    console.error('Failed to render history:', err);
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load history.</p></div>`;
  }
}

/**
 * Resets all filter inputs to default.
 */
function resetAllFilters() {
  const searchInput = document.getElementById('history-search');
  const subjectSelect = document.getElementById('history-subject-filter');
  const dateInput = document.getElementById('history-date-filter');

  if (searchInput) searchInput.value = '';
  if (subjectSelect) subjectSelect.value = 'ALL';
  if (dateInput) dateInput.value = '';
}

export function initHistory() {
  loadAndRenderHistory();

  // Filter input listeners
  const searchInput = document.getElementById('history-search');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadAndRenderHistory(), 150);
    });
  }

  const subjectSelect = document.getElementById('history-subject-filter');
  if (subjectSelect) {
    subjectSelect.addEventListener('change', () => loadAndRenderHistory());
  }

  const dateInput = document.getElementById('history-date-filter');
  if (dateInput) {
    dateInput.addEventListener('change', () => loadAndRenderHistory());
  }

  const resetBtn = document.getElementById('history-reset-filters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetAllFilters();
      loadAndRenderHistory();
    });
  }

  // React to background session changes
  const handleUpdate = () => loadAndRenderHistory();
  window.addEventListener('studytracker:sessions-changed', handleUpdate);
  window.addEventListener('studytracker:subjects-changed', handleUpdate);

  return () => {
    window.removeEventListener('studytracker:sessions-changed', handleUpdate);
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
  };
}
