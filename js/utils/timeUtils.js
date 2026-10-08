/**
 * Formats canonical duration in seconds into human-readable string.
 * Example: 5040 -> "1h 24m", 120 -> "2m", 45 -> "45s", 0 -> "0m"
 * @param {number} seconds - Total duration in seconds
 * @param {Object} [options]
 * @param {boolean} [options.showSeconds=false] - Whether to show seconds when hours/minutes present
 * @param {boolean} [options.verbose=false] - "1 hour 24 mins" vs "1h 24m"
 * @returns {string}
 */
export function formatDuration(seconds, options = {}) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const { showSeconds = false, verbose = false } = options;

  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSec = sec % 60;

  if (hours === 0 && minutes === 0) {
    if (showSeconds || sec > 0) {
      return verbose ? `${remainingSec} secs` : `${remainingSec}s`;
    }
    return verbose ? '0 mins' : '0m';
  }

  const parts = [];
  if (hours > 0) {
    parts.push(verbose ? `${hours} hr${hours > 1 ? 's' : ''}` : `${hours}h`);
  }
  if (minutes > 0 || (hours > 0 && remainingSec > 0 && showSeconds)) {
    parts.push(verbose ? `${minutes} min${minutes > 1 ? 's' : ''}` : `${minutes}m`);
  }
  if (showSeconds && remainingSec > 0) {
    parts.push(verbose ? `${remainingSec}s` : `${remainingSec}s`);
  }

  return parts.join(' ');
}

/**
 * Formats duration in seconds as digital timer display: "HH:MM:SS"
 * @param {number} seconds
 * @returns {string}
 */
export function formatDigitalTimer(seconds) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const remainingSec = sec % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(remainingSec)}`;
}

/**
 * Converts hours and minutes into total canonical seconds.
 * @param {number} hours
 * @param {number} minutes
 * @returns {number}
 */
export function toSeconds(hours = 0, minutes = 0) {
  return (Math.max(0, Number(hours) || 0) * 3600) + (Math.max(0, Number(minutes) || 0) * 60);
}

/**
 * Breaks total seconds into hours and minutes.
 * @param {number} seconds
 * @returns {{ hours: number, minutes: number, seconds: number }}
 */
export function secondsToTimeComponents(seconds) {
  const sec = Math.max(0, Math.floor(Number(seconds) || 0));
  return {
    hours: Math.floor(sec / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
  };
}
