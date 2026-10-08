/**
 * StudyTracker — Subject Add/Edit Modal Component
 */

import { modal } from './modal.js';
import { toast } from './toast.js';
import { escapeHtml } from '../utils/formatUtils.js';
import { SUBJECT_PALETTE, createSubject, updateSubject } from '../services/subjectService.js';

/**
 * Opens a modal dialog to create or edit a subject.
 * @param {Object} [options]
 * @param {Object} [options.subject=null] - If provided, opens in edit mode
 * @param {Function} [options.onSaved] - Callback with saved subject
 */
export function openSubjectModal({ subject = null, onSaved } = {}) {
  const isEdit = Boolean(subject && subject.id);
  const title = isEdit ? 'Edit Subject' : 'Add New Subject';
  const initialName = isEdit ? subject.name : '';
  const initialColor = isEdit ? subject.color : SUBJECT_PALETTE[0];

  const paletteHtml = SUBJECT_PALETTE.map((color) => {
    const isSelected = color.toLowerCase() === initialColor.toLowerCase();
    return `
      <button type="button" class="color-swatch-btn ${isSelected ? 'selected' : ''}"
        data-color="${color}"
        style="background-color: ${color};"
        aria-label="Select color ${color}"
        title="${color}">
      </button>
    `;
  }).join('');

  const contentHtml = `
    <form id="subject-modal-form" class="subject-form" novalidate>
      <div class="form-group">
        <label for="modal-subject-name" class="form-label">Subject Name <span class="text-danger">*</span></label>
        <input type="text" id="modal-subject-name" class="form-input" placeholder="e.g. Mathematics, ASP.NET Core, Biology" value="${escapeHtml(initialName)}" maxlength="60" required autofocus autocomplete="off" />
        <div id="modal-subject-error" class="form-error" style="display: none; color: var(--danger); font-size: 0.8rem; margin-top: 0.35rem;"></div>
      </div>

      <div class="form-group">
        <label class="form-label">Subject Color</label>
        <div class="color-picker-grid" id="modal-color-palette">
          ${paletteHtml}
        </div>
        <div class="custom-color-row" style="margin-top: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <input type="color" id="modal-custom-color" value="${initialColor}" class="color-input-native" title="Custom color picker" />
          <span style="font-size: 0.85rem; color: var(--text-secondary);">Custom Hex:</span>
          <span id="modal-color-hex-preview" style="font-size: 0.85rem; font-family: monospace; font-weight: 600;">${initialColor}</span>
        </div>
      </div>
    </form>
  `;

  const footerHtml = `
    <button type="button" class="btn btn-secondary modal-cancel-btn">Cancel</button>
    <button type="button" id="modal-btn-save-subject" class="btn btn-primary">
      <span>${isEdit ? 'Save Changes' : 'Create Subject'}</span>
    </button>
  `;

  modal.open({
    title,
    contentHtml,
    footerHtml,
    onMount: (modalEl) => {
      const form = modalEl.querySelector('#subject-modal-form');
      const nameInput = modalEl.querySelector('#modal-subject-name');
      const errorEl = modalEl.querySelector('#modal-subject-error');
      const saveBtn = modalEl.querySelector('#modal-btn-save-subject');
      const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
      const customColorInput = modalEl.querySelector('#modal-custom-color');
      const hexPreview = modalEl.querySelector('#modal-color-hex-preview');
      const paletteContainer = modalEl.querySelector('#modal-color-palette');

      let selectedColor = initialColor;

      cancelBtn.addEventListener('click', () => modal.close());

      // Palette selection
      paletteContainer.addEventListener('click', (e) => {
        const swatch = e.target.closest('.color-swatch-btn');
        if (!swatch) return;
        paletteContainer.querySelectorAll('.color-swatch-btn').forEach((b) => b.classList.remove('selected'));
        swatch.classList.add('selected');
        selectedColor = swatch.getAttribute('data-color');
        customColorInput.value = selectedColor;
        hexPreview.textContent = selectedColor;
      });

      // Custom color picker input
      customColorInput.addEventListener('input', (e) => {
        selectedColor = e.target.value;
        hexPreview.textContent = selectedColor;
        paletteContainer.querySelectorAll('.color-swatch-btn').forEach((b) => {
          if (b.getAttribute('data-color').toLowerCase() === selectedColor.toLowerCase()) {
            b.classList.add('selected');
          } else {
            b.classList.remove('selected');
          }
        });
      });

      const handleSave = async () => {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
        const nameVal = nameInput.value.trim();

        if (!nameVal) {
          errorEl.textContent = 'Please enter a subject name.';
          errorEl.style.display = 'block';
          nameInput.focus();
          return;
        }

        saveBtn.disabled = true;
        try {
          let saved;
          if (isEdit) {
            saved = await updateSubject(subject.id, { name: nameVal, color: selectedColor });
            toast.success(`Subject "${saved.name}" updated successfully.`);
          } else {
            saved = await createSubject({ name: nameVal, color: selectedColor });
            toast.success(`Subject "${saved.name}" created.`);
          }

          modal.close();
          if (typeof onSaved === 'function') {
            onSaved(saved);
          }
        } catch (err) {
          saveBtn.disabled = false;
          errorEl.textContent = err.message || 'Failed to save subject.';
          errorEl.style.display = 'block';
        }
      };

      saveBtn.addEventListener('click', handleSave);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSave();
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSave();
        }
      });
    }
  });
}
