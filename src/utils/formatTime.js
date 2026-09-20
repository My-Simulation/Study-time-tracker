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

export const WEEKDAY_IDS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Safely converts any Date or 'YYYY-MM-DD' string into a local 'YYYY-MM-DD' string without UTC skew.
 */
export function toLocalDateStr(dateInput) {
  if (!dateInput) return todayString()
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      return dateInput.trim()
    }
    const d = new Date(dateInput)
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${day}`
    }
    return todayString()
  }
  if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
    const y = dateInput.getFullYear()
    const m = String(dateInput.getMonth() + 1).padStart(2, '0')
    const day = String(dateInput.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return todayString()
}

/**
 * Returns the 3-letter weekday ID ('Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat')
 * strictly using the local time of the user's device.
 */
export function getLocalWeekdayId(dateInput) {
  if (!dateInput) return WEEKDAY_IDS[new Date().getDay()]
  if (typeof dateInput === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.trim())) {
      const [y, m, d] = dateInput.trim().split('-').map(Number)
      const dt = new Date(y, m - 1, d)
      return WEEKDAY_IDS[dt.getDay()]
    }
    const d = new Date(dateInput)
    return WEEKDAY_IDS[d.getDay()]
  }
  if (dateInput instanceof Date) {
    return WEEKDAY_IDS[dateInput.getDay()]
  }
  return WEEKDAY_IDS[new Date().getDay()]
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

/**
 * Converts totalSeconds to a readable duration string.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0m'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h === 0 && m === 0) return `${s}s`
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Formats a decimal hour number (e.g. 5.5) into a readable string like "5h 30m (5:30)" or "5h 30m".
 * @param {number|string} hours
 * @param {boolean} includeClock - if true, appends "(H:MM)"
 * @returns {string}
 */
export function formatTargetHoursText(hours, includeClock = false) {
  const num = Number(hours) || 0
  if (num === 0) return includeClock ? '0h · Rest Day (0:00)' : '0h (Rest Day)'
  const h = Math.floor(num)
  const m = Math.round((num - h) * 60)
  const clock = `${h}:${String(m).padStart(2, '0')}`
  let base = '0h'
  if (h === 0 && m > 0) base = `${m}m`
  else if (m === 0) base = `${h}h`
  else base = `${h}h ${m}m`
  return includeClock ? `${base} (${clock})` : base
}

/**
 * Parses user input into a decimal hours number.
 * Supports:
 * - "0" or "0h" -> 0
 * - "5:30" or "05:30" -> 5.5
 * - "5.5" or "5,5" -> 5.5
 * - "5h 30m" or "30m" or "5h" -> 5.5 or 0.5
 * - 5.5 (number) -> 5.5
 * @param {string|number} input
 * @returns {number}
 */
export function parseHoursInput(input) {
  if (typeof input === 'number') {
    if (isNaN(input) || input < 0) return 6
    return Number(input.toFixed(2))
  }
  const str = String(input || '').trim().replace(',', '.')
  if (str === '0' || str === '0h' || str === '0:00' || str === '0m') return 0
  if (!str) return 6

  // Check H:MM pattern (e.g. "5:30", "0:45", "0:00")
  if (str.includes(':')) {
    const parts = str.split(':').map(Number)
    const h = parts[0] || 0
    const m = parts[1] || 0
    if (!isNaN(h) && !isNaN(m)) {
      return Number((h + m / 60).toFixed(2))
    }
  }

  // Check "Xh Ym" pattern (e.g. "5h 30m", "5h", "30m", "30min")
  const hMatch = str.match(/(\d+(?:\.\d+)?)\s*h/i)
  const mMatch = str.match(/(\d+(?:\.\d+)?)\s*m/i)
  if (hMatch || mMatch) {
    const h = hMatch ? parseFloat(hMatch[1]) : 0
    const m = mMatch ? parseFloat(mMatch[1]) : 0
    return Number((h + m / 60).toFixed(2))
  }

  // Float number (e.g. "5.5", "6", "0")
  const num = parseFloat(str)
  if (!isNaN(num) && num >= 0) {
    return Number(num.toFixed(2))
  }
  return 6
}


