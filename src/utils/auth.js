/**
 * auth.js
 * Client-side auth helpers — password hashing, session management.
 * Uses Web Crypto API (SHA-256 + salt) — no external library needed.
 */

const SALT = 'study_tracker_v2_secure_salt_2026'
const SESSION_KEY = 'stt_session_v2'
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ── Password hashing ──────────────────────────────────────────────────────────

/**
 * Hashes a password using SHA-256 + salt.
 * @param {string} password
 * @returns {Promise<string>} hex hash
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder()
  const data = encoder.encode(password + SALT)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Verifies a plain password against a stored hash.
 */
export async function verifyPassword(plain, storedHash) {
  const hash = await hashPassword(plain)
  return hash === storedHash
}

// ── Session management ────────────────────────────────────────────────────────

/**
 * Saves a session to localStorage after successful login/signup.
 * @param {string} username
 * @param {object} userDoc - The full user doc from Firestore
 */
export function saveSession(username, userDoc) {
  const session = {
    username: username.toLowerCase(),
    displayName: userDoc.displayName || username,
    avatarColor: userDoc.avatarColor || '#7c3aed',
    photoUrl: userDoc.photoUrl || '',
    savedAt: Date.now(),
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  // Also keep old key for backward compat with RequireAuth checks
  localStorage.setItem('studyTrackerUser', username.toLowerCase())
}

/**
 * Updates the current session with new profile attributes.
 */
export function updateCurrentSession(fields) {
  try {
    const current = getSession()
    if (!current) return null
    const updated = { ...current, ...fields }
    if (fields.username) {
      updated.username = fields.username.toLowerCase()
      localStorage.setItem('studyTrackerUser', fields.username.toLowerCase())
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(updated))
    window.dispatchEvent(new Event('storage'))
    return updated
  } catch {
    return null
  }
}

/**
 * Returns the current session or null if expired/missing.
 */
export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) {
      // Fallback: check old key
      const old = localStorage.getItem('studyTrackerUser')
      if (old) return { username: old, displayName: old, avatarColor: '#7c3aed' }
      return null
    }
    const session = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      clearSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

/**
 * Clears the session (logout).
 */
export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  localStorage.removeItem('studyTrackerUser')
}

/**
 * Returns the current logged-in username or null.
 */
export function getCurrentUser() {
  return getSession()?.username || null
}
