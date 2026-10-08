/**
 * Sanitizes an untrusted string to safe HTML to prevent XSS vulnerabilities.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Clamps a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Calculates percentage safely (0 - 100+).
 * @param {number} current
 * @param {number} total
 * @returns {number} Integer percentage
 */
export function calculatePercentage(current, total) {
  if (!total || total <= 0) return 0;
  return Math.round((current / total) * 100);
}
