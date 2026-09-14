/**
 * formatTime.js
 * Converts milliseconds to display strings.
 */

/**
 * Formats milliseconds into "H:MM:SS.CC" string (H = hours, CC = centiseconds).
 * @param {number} ms - Elapsed milliseconds
 * @returns {string} Formatted time string, e.g. "1:04:32.07"
 */
export function formatTime(ms) {
  if (ms < 0) ms = 0
  const totalCentiseconds = Math.floor(ms / 10)
  const centiseconds = totalCentiseconds % 100
  const totalSeconds = Math.floor(ms / 1000)
  const seconds = totalSeconds % 60
  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60
  const hours = Math.floor(totalMinutes / 60)

  const pad2 = (n) => String(n).padStart(2, '0')

  return `${hours}:${pad2(minutes)}:${pad2(seconds)}.${pad2(centiseconds)}`
}

/**
 * Parses a "H:MM:SS.CC" string back to milliseconds.
 * @param {string} timeStr
 * @returns {number} Milliseconds
 */
export function parseTimeToMs(timeStr) {
  if (!timeStr) return 0
  const parts = timeStr.split(':')
  if (parts.length !== 3) return 0
  const hours = parseInt(parts[0], 10) || 0
  const minutes = parseInt(parts[1], 10) || 0
  const secParts = parts[2].split('.')
  const seconds = parseInt(secParts[0], 10) || 0
  const centiseconds = parseInt(secParts[1], 10) || 0
  return (hours * 3600 + minutes * 60 + seconds) * 1000 + centiseconds * 10
}

/**
 * Formats a date string "YYYY-MM-DD" to a friendly display string.
 * e.g. "Mon, 15 Sep 2026"
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Returns today's date as "YYYY-MM-DD".
 * @returns {string}
 */
export function todayString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Converts totalSeconds to "Xh Ym" format for display.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatHoursMinutes(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
