/**
 * StudyTracker — Import Backup Summary & Options Modal Component
 */

import { modal } from './modal.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { importBackup } from '../services/backupService.js';

/**
 * Opens import confirmation dialog after backup validation.
 * @param {Object} options
 * @param {Object} options.validationResult - Result from validateBackupData
 * @param {Function} [options.onSuccess] - Callback when import finishes
 */
export function openImportModal({ validationResult, onSuccess }) {
  const { summary, cleanData } = validationResult;

  const contentHtml = `
    <div class="import-summary-wrap" style="display: flex; flex-direction: column; gap: 1.15rem;">
      <div style="background-color: var(--bg-surface-hover); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem 1.15rem;">
        <h3 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-primary);">Backup Content Summary</h3>
        <div style="display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.875rem;">
          <div><strong style="color: var(--text-secondary);">Subjects:</strong> <span style="font-weight: 600;">${summary.subjectsCount}</span></div>
          <div><strong style="color: var(--text-secondary);">Study Sessions:</strong> <span style="font-weight: 600;">${summary.sessionsCount}</span></div>
          <div><strong style="color: var(--text-secondary);">Exported At:</strong> <span>${escapeHtml(summary.exportedAt)}</span></div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <label class="form-label" style="font-weight: 700;">Select Import Mode</label>

        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 1rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer; background: var(--bg-surface);">
          <input type="radio" name="import-mode" value="merge" checked style="margin-top: 3px;" />
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary);">Merge with existing data (Recommended)</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Adds new subjects and sessions without deleting current records.</div>
          </div>
        </label>

        <label style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 1rem; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); cursor: pointer; background: var(--bg-surface);">
          <input type="radio" name="import-mode" value="replace" style="margin-top: 3px;" />
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: var(--danger);">Replace existing data</div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">Completely erases all current subjects and sessions and replaces them with this backup.</div>
          </div>
        </label>
      </div>
    </div>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="btn-execute-import" class="btn btn-primary">
      <span>Import Data</span>
    </button>
  `;

  modal.open({
    title: 'Restore Study Backup',
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const importBtn = modalEl.querySelector('#btn-execute-import');

      cancelBtn.addEventListener('click', () => modal.close());

      importBtn.addEventListener('click', async () => {
        const selectedMode = modalEl.querySelector('input[name="import-mode"]:checked')?.value || 'merge';

        if (selectedMode === 'replace') {
          const confirmed = await modal.confirm({
            title: 'Confirm Replace Entire Database',
            message: 'WARNING: Are you sure you want to REPLACE all current data? All existing subjects and study history on this device will be permanently overwritten.',
            confirmText: 'Yes, Overwrite Everything',
            cancelText: 'Cancel',
            confirmType: 'danger'
          });

          if (!confirmed) {
            openImportModal({ validationResult, onSuccess });
            return;
          }
        }

        importBtn.disabled = true;
        try {
          const res = await importBackup({ cleanData, mode: selectedMode });
          modal.close();
          toast.success(`Data restored! (${res.importedSubjects} subjects, ${res.importedSessions} sessions)`);
          if (typeof onSuccess === 'function') {
            onSuccess(res);
          }
        } catch (err) {
          importBtn.disabled = false;
          toast.error(err.message || 'Failed to import backup.');
        }
      });
    }
  });
}
