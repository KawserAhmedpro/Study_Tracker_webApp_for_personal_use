/**
 * Returns a 'YYYY-MM-DD' calendar date string using the client's local timezone.
 * Avoids UTC shifting issues from toISOString().
 * @param {Date|number|string} [dateInput=new Date()]
 * @returns {string}
 */
export function getLocalDateString(dateInput = new Date()) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a local date string (YYYY-MM-DD) into human-friendly format.
 * Examples: "Today", "Yesterday", "October 8, 2026"
 * @param {string} dateStr - 'YYYY-MM-DD'
 * @returns {string}
 */
export function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const todayStr = getLocalDateString(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateString(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return dateStr;

  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats full timestamp into local time string: "10:30 AM"
 * @param {string|number|Date} dateInput
 * @returns {string}
 */
export function formatDisplayTime(dateInput) {
  if (!dateInput) return '';
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a start and end time range: "10:30 AM – 11:54 AM"
 * @param {string|number|Date} startTime
 * @param {string|number|Date} endTime
 * @returns {string}
 */
export function formatTimeRange(startTime, endTime) {
  const startStr = formatDisplayTime(startTime);
  const endStr = formatDisplayTime(endTime);
  if (!startStr) return '';
  if (!endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

/**
 * Returns an ordered array of local date strings (YYYY-MM-DD) for the past N days up to today.
 * @param {number} n - Number of days (e.g. 7 or 30)
 * @param {string} [endDateStr] - Optional anchor date (defaults to today)
 * @returns {string[]} Array from oldest to newest
 */
export function getPastNDays(n, endDateStr) {
  const days = [];
  const anchor = endDateStr
    ? new Date(endDateStr + 'T12:00:00') // prevent DST jumps
    : new Date();

  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    days.push(getLocalDateString(d));
  }
  return days;
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string.
 * @param {string} dateStr
 * @param {number} daysOffset
 * @returns {string}
 */
export function offsetDateString(dateStr, daysOffset) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + daysOffset);
  return getLocalDateString(d);
}
