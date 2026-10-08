import { icon } from '../components/icons.js';
import { toast } from '../components/toast.js';
import { modal } from '../components/modal.js';
import { openSubjectModal } from '../components/subjectModal.js';
import { openImportModal } from '../components/importModal.js';
import { exportBackup, validateBackupData } from '../services/backupService.js';
import {
  getAllSubjects,
  getSubjectById,
  deleteSubject,
  restoreSubject
} from '../services/subjectService.js';
import { get, put, STORES, DEFAULT_SETTINGS } from '../db/database.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { toSeconds, secondsToTimeComponents } from '../utils/timeUtils.js';

export function renderSettings() {
  return `
    <div class="settings-page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Settings</h1>
          <p class="page-subtitle">Configure your preferences, manage subjects, and safeguard your data.</p>
        </div>
      </div>

      <!-- Local Safety Banner -->
      <aside class="local-safety-banner" role="status">
        <span class="icon">${icon('shieldCheck', { size: 24 })}</span>
        <div>
          <h2 class="local-safety-title">Local-First Storage</h2>
          <p class="local-safety-text">Your study data is stored locally on this device/browser. Clearing browser/site data may remove your study history. Export a backup regularly to safeguard your records.</p>
        </div>
      </aside>

      <div class="settings-grid">
        <!-- Daily Goal Setting -->
        <section class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">
              ${icon('target', { size: 20 })}
              <span>Daily Study Goal</span>
            </h2>
            <p class="settings-section-desc">Set your daily target to monitor progress on the dashboard.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; align-items: flex-end; max-width: 320px;">
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label for="setting-goal-hours" class="form-label">Hours</label>
              <input type="number" id="setting-goal-hours" class="form-input" min="0" max="24" value="4" />
            </div>
            <div class="form-group" style="flex: 1; margin-bottom: 0;">
              <label for="setting-goal-minutes" class="form-label">Minutes</label>
              <input type="number" id="setting-goal-minutes" class="form-input" min="0" max="59" step="5" value="0" />
            </div>
            <button type="button" id="btn-save-goal" class="btn btn-primary" style="height: 42px;">Save</button>
          </div>
        </section>

        <!-- Manage Subjects Section -->
        <section class="settings-section">
          <div class="settings-section-header" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 class="settings-section-title">
                ${icon('bookOpen', { size: 20 })}
                <span>Subject Management</span>
              </h2>
              <p class="settings-section-desc">Create subjects, assign distinct colors, or archive subjects.</p>
            </div>
            <button type="button" id="btn-add-subject-modal" class="btn btn-secondary btn-sm">
              ${icon('plus', { size: 14 })}
              <span>Add Subject</span>
            </button>
          </div>
          <div id="settings-subjects-container" class="subject-manage-list">
            <div class="empty-state" style="padding: 1.5rem;">
              <p class="text-muted">Loading subjects...</p>
            </div>
          </div>
        </section>

        <!-- Theme Preference -->
        <section class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">
              ${icon('sun', { size: 20 })}
              <span>Appearance</span>
            </h2>
            <p class="settings-section-desc">Choose your preferred application color theme.</p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary theme-select-btn" data-theme="light" id="theme-btn-light">
              ${icon('sun', { size: 16 })}
              <span>Light Mode</span>
            </button>
            <button type="button" class="btn btn-secondary theme-select-btn" data-theme="dark" id="theme-btn-dark">
              ${icon('moon', { size: 16 })}
              <span>Dark Mode</span>
            </button>
            <button type="button" class="btn btn-secondary theme-select-btn" data-theme="system" id="theme-btn-system">
              ${icon('settings', { size: 16 })}
              <span>System (Auto)</span>
            </button>
          </div>
        </section>

        <!-- Data Backup & Restore -->
        <section class="settings-section">
          <div class="settings-section-header">
            <h2 class="settings-section-title">
              ${icon('download', { size: 20 })}
              <span>Backup & Restore</span>
            </h2>
            <p class="settings-section-desc">Safeguard your data with portable JSON backups. Restore or merge anytime.</p>
          </div>

          <div class="backup-actions-row">
            <button type="button" id="btn-export-backup" class="btn btn-primary">
              ${icon('download', { size: 16 })}
              <span>Export Data (JSON)</span>
            </button>

            <label class="btn btn-secondary" style="cursor: pointer; margin-bottom: 0;">
              ${icon('upload', { size: 16 })}
              <span>Import Data</span>
              <input type="file" id="input-import-file" accept=".json,application/json" style="display: none;" />
            </label>
          </div>
        </section>
      </div>
    </div>
  `;
}

/**
 * Loads and renders the list of subjects.
 */
async function loadAndRenderSubjects() {
  const container = document.getElementById('settings-subjects-container');
  if (!container) return;

  try {
    const subjects = await getAllSubjects({ includeArchived: true });

    if (!subjects || subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem;">
          <p class="text-muted">No subjects created yet. Click "Add Subject" to create your first subject.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = subjects.map((s) => {
      const isArchived = Boolean(s.archived);
      return `
        <div class="subject-manage-item ${isArchived ? 'is-archived' : ''}" data-id="${s.id}">
          <div class="subject-info-col">
            <span class="subject-color-chip" style="background-color: ${escapeHtml(s.color || '#3b82f6')};"></span>
            <span>${escapeHtml(s.name)}</span>
            ${isArchived ? `<span class="subject-archived-badge">Archived</span>` : ''}
          </div>
          <div class="subject-actions">
            ${!isArchived ? `
              <button type="button" class="btn-icon btn-edit-subject" data-id="${s.id}" title="Edit Subject" aria-label="Edit ${escapeHtml(s.name)}">
                ${icon('edit', { size: 16 })}
              </button>
              <button type="button" class="btn-icon btn-delete-subject" data-id="${s.id}" title="Delete or Archive Subject" aria-label="Delete ${escapeHtml(s.name)}">
                ${icon('trash', { size: 16 })}
              </button>
            ` : `
              <button type="button" class="btn btn-secondary btn-xs btn-restore-subject" data-id="${s.id}" title="Restore Subject">
                ${icon('rotateCcw', { size: 14 })}
                <span>Restore</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Attach Action Listeners
    container.querySelectorAll('.btn-edit-subject').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const subject = await getSubjectById(id);
        if (subject) {
          openSubjectModal({
            subject,
            onSaved: () => loadAndRenderSubjects()
          });
        }
      });
    });

    container.querySelectorAll('.btn-delete-subject').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const subject = await getSubjectById(id);
        if (!subject) return;

        const confirmed = await modal.confirm({
          title: 'Delete Subject',
          message: `Are you sure you want to remove "${subject.name}"? If there are any recorded study sessions for this subject, it will be safely archived to protect your historical records.`,
          confirmText: 'Remove',
          cancelText: 'Cancel',
          confirmType: 'danger'
        });

        if (confirmed) {
          try {
            const res = await deleteSubject(id);
            if (res.action === 'archived') {
              toast.info(res.message);
            } else {
              toast.success(res.message);
            }
            loadAndRenderSubjects();
          } catch (err) {
            toast.error(err.message || 'Failed to remove subject.');
          }
        }
      });
    });

    container.querySelectorAll('.btn-restore-subject').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        try {
          const restored = await restoreSubject(id);
          toast.success(`Subject "${restored.name}" restored.`);
          loadAndRenderSubjects();
        } catch (err) {
          toast.error(err.message || 'Failed to restore subject.');
        }
      });
    });

  } catch (err) {
    console.error('Failed to load subjects:', err);
    container.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load subjects.</p></div>`;
  }
}

/**
 * Loads current daily goal into the input fields.
 */
async function loadAndRenderGoal() {
  const hoursInput = document.getElementById('setting-goal-hours');
  const minutesInput = document.getElementById('setting-goal-minutes');
  if (!hoursInput || !minutesInput) return;

  try {
    const settings = await get(STORES.SETTINGS, 'app_settings') || DEFAULT_SETTINGS;
    const { hours, minutes } = secondsToTimeComponents(settings.dailyGoalSeconds || 14400);
    hoursInput.value = hours;
    minutesInput.value = minutes;
  } catch (err) {
    console.error('Failed to load daily goal setting:', err);
  }
}

/**
 * Initializes goal save button.
 */
function initGoalSaveButton() {
  const btn = document.getElementById('btn-save-goal');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const hours = parseInt(document.getElementById('setting-goal-hours')?.value, 10) || 0;
    const minutes = parseInt(document.getElementById('setting-goal-minutes')?.value, 10) || 0;
    const totalSec = toSeconds(hours, minutes);

    if (totalSec <= 0) {
      toast.error('Daily goal must be at least 1 minute.');
      return;
    }

    try {
      const current = await get(STORES.SETTINGS, 'app_settings') || { ...DEFAULT_SETTINGS };
      current.dailyGoalSeconds = totalSec;
      current.updatedAt = new Date().toISOString();
      await put(STORES.SETTINGS, current);
      window.dispatchEvent(new CustomEvent('studytracker:settings-changed'));
      toast.success('Daily study goal updated.');
    } catch (err) {
      console.error('Failed to save goal:', err);
      toast.error('Failed to update daily goal.');
    }
  });
}

/**
 * Initializes Appearance buttons in settings.
 */
function initThemeButtons() {
  const lightBtn = document.getElementById('theme-btn-light');
  const darkBtn = document.getElementById('theme-btn-dark');
  const systemBtn = document.getElementById('theme-btn-system');

  const updateActive = (pref) => {
    if (lightBtn) lightBtn.classList.toggle('active', pref === 'light');
    if (darkBtn) darkBtn.classList.toggle('active', pref === 'dark');
    if (systemBtn) systemBtn.classList.toggle('active', pref === 'system');
  };

  const app = window.__studyTrackerApp;
  const currentPref = app ? (app.themePreference || app.theme) : (localStorage.getItem('studytracker_theme_pref') || 'system');
  updateActive(currentPref);

  if (lightBtn) {
    lightBtn.addEventListener('click', () => {
      if (app) {
        app._applyTheme('light');
        updateActive('light');
        toast.info('Theme set to Light Mode.');
      }
    });
  }

  if (darkBtn) {
    darkBtn.addEventListener('click', () => {
      if (app) {
        app._applyTheme('dark');
        updateActive('dark');
        toast.info('Theme set to Dark Mode.');
      }
    });
  }

  if (systemBtn) {
    systemBtn.addEventListener('click', () => {
      if (app) {
        app._applyTheme('system');
        updateActive('system');
        toast.info('Theme set to System (Auto).');
      }
    });
  }
}

export function initSettings() {
  loadAndRenderGoal();
  loadAndRenderSubjects();
  initThemeButtons();
  initGoalSaveButton();

  const addBtn = document.getElementById('btn-add-subject-modal');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openSubjectModal({
        onSaved: () => loadAndRenderSubjects()
      });
    });
  }

  // Backup Export Handler
  const exportBtn = document.getElementById('btn-export-backup');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      try {
        const res = await exportBackup();
        toast.success(`Backup downloaded: ${res.filename}`);
      } catch (err) {
        console.error('Export failed:', err);
        toast.error('Failed to export backup data.');
      }
    });
  }

  // Backup Import Handler
  const importInput = document.getElementById('input-import-file');
  if (importInput) {
    importInput.addEventListener('change', () => {
      if (!importInput.files || importInput.files.length === 0) return;
      const file = importInput.files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const validation = validateBackupData(parsed);

          if (!validation.valid) {
            toast.error(`Invalid backup: ${validation.errors.slice(0, 2).join(' ')}`);
            importInput.value = '';
            return;
          }

          openImportModal({
            validationResult: validation,
            onSuccess: () => {
              loadAndRenderSubjects();
              loadAndRenderGoal();
            }
          });
        } catch (err) {
          toast.error('The selected file is not valid JSON.');
        }
        importInput.value = '';
      };

      reader.onerror = () => {
        toast.error('Failed to read backup file.');
        importInput.value = '';
      };

      reader.readAsText(file);
    });
  }

  // Handle external subject updates
  const handleUpdate = () => loadAndRenderSubjects();
  window.addEventListener('studytracker:subjects-changed', handleUpdate);

  return () => {
    window.removeEventListener('studytracker:subjects-changed', handleUpdate);
  };
}
