import { icon } from './icons.js';
import { escapeHtml } from '../utils/formatUtils.js';

class ModalManager {
  constructor() {
    this.activeModal = null;
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  _handleKeyDown(e) {
    if (e.key === 'Escape' && this.activeModal) {
      this.close();
    }
  }

  /**
   * Opens a custom modal
   * @param {Object} options
   * @param {string} options.title - Modal title
   * @param {string} options.contentHtml - HTML body
   * @param {string} [options.footerHtml] - Optional footer buttons
   * @param {Function} [options.onMount] - Callback once DOM is rendered
   * @param {Function} [options.onClose] - Callback when modal closes
   */
  open({ title, contentHtml, footerHtml = '', onMount, onClose }) {
    this.close(); // Close any previously open modal
    this.previousActiveElement = document.activeElement;

    let container = document.getElementById('modal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'modal-container';
      document.body.appendChild(container);
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
          <h2 id="modal-title" class="modal-title">${escapeHtml(title)}</h2>
          <button type="button" class="btn-icon modal-close-btn" aria-label="Close modal">
            ${icon('x', { size: 18 })}
          </button>
        </div>
        <div class="modal-body">
          ${contentHtml}
        </div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;

    container.appendChild(backdrop);
    this.activeModal = { backdrop, onClose };

    document.addEventListener('keydown', this._handleKeyDown);
    document.body.classList.add('modal-open');

    // Close handlers
    const closeBtn = backdrop.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => this.close());

    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        this.close();
      }
    });

    if (typeof onMount === 'function') {
      onMount(backdrop);
    }

    // Auto-focus first input or primary button
    setTimeout(() => {
      const focusable = backdrop.querySelector('input, select, textarea, button.btn-primary');
      if (focusable) focusable.focus();
    }, 50);
  }

  close() {
    if (!this.activeModal) return;
    const { backdrop, onClose } = this.activeModal;
    document.removeEventListener('keydown', this._handleKeyDown);
    document.body.classList.remove('modal-open');

    if (backdrop && backdrop.parentElement) {
      backdrop.classList.add('modal-closing');
      setTimeout(() => {
        if (backdrop.parentElement) {
          backdrop.parentElement.removeChild(backdrop);
        }
      }, 150);
    }

    this.activeModal = null;
    if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
      try {
        this.previousActiveElement.focus();
      } catch (_) {}
      this.previousActiveElement = null;
    }

    if (typeof onClose === 'function') {
      onClose();
    }
  }

  /**
   * Shows a confirmation dialog.
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmText='Confirm']
   * @param {string} [options.cancelText='Cancel']
   * @param {string} [options.confirmType='danger'|'primary']
   * @returns {Promise<boolean>}
   */
  confirm({
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmType = 'danger'
  }) {
    return new Promise((resolve) => {
      let resolved = false;

      const contentHtml = `
        <div class="confirm-modal-content">
          <p>${escapeHtml(message)}</p>
        </div>
      `;

      const footerHtml = `
        <button type="button" class="btn btn-secondary modal-cancel-btn">${escapeHtml(cancelText)}</button>
        <button type="button" class="btn btn-${confirmType} modal-confirm-btn">${escapeHtml(confirmText)}</button>
      `;

      this.open({
        title,
        contentHtml,
        footerHtml,
        onMount: (modalEl) => {
          const cancelBtn = modalEl.querySelector('.modal-cancel-btn');
          const confirmBtn = modalEl.querySelector('.modal-confirm-btn');

          cancelBtn.addEventListener('click', () => {
            resolved = true;
            this.close();
            resolve(false);
          });

          confirmBtn.addEventListener('click', () => {
            resolved = true;
            this.close();
            resolve(true);
          });
        },
        onClose: () => {
          if (!resolved) {
            resolve(false);
          }
        }
      });
    });
  }
}

export const modal = new ModalManager();
export default modal;
