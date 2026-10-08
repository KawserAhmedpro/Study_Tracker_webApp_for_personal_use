import { icon } from './icons.js';
import { escapeHtml } from '../utils/formatUtils.js';

class ToastManager {
  constructor() {
    this.container = null;
  }

  _ensureContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      this.container = document.getElementById('toast-container');
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        this.container.setAttribute('aria-live', 'polite');
        this.container.setAttribute('aria-atomic', 'true');
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  show(message, type = 'info', duration = 3500) {
    const container = this._ensureContainer();

    const toastEl = document.createElement('div');
    toastEl.className = `toast toast-${type}`;
    toastEl.setAttribute('role', 'alert');

    let iconName = 'info';
    if (type === 'success') iconName = 'check';
    if (type === 'error') iconName = 'alertTriangle';

    toastEl.innerHTML = `
      <span class="toast-icon">${icon(iconName, { size: 18 })}</span>
      <span class="toast-message">${escapeHtml(message)}</span>
      <button type="button" class="toast-close" aria-label="Close notification">
        ${icon('x', { size: 14 })}
      </button>
    `;

    const closeBtn = toastEl.querySelector('.toast-close');
    const dismiss = () => {
      if (toastEl.classList.contains('toast-closing')) return;
      toastEl.classList.add('toast-closing');
      setTimeout(() => {
        if (toastEl.parentElement) {
          toastEl.remove();
        }
      }, 200);
    };

    closeBtn.addEventListener('click', dismiss);

    container.appendChild(toastEl);

    // Auto dismiss
    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  success(message, duration) {
    this.show(message, 'success', duration);
  }

  error(message, duration) {
    this.show(message, 'error', duration || 4500);
  }

  info(message, duration) {
    this.show(message, 'info', duration);
  }
}

export const toast = new ToastManager();
export default toast;
