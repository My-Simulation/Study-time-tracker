/**
 * firestoreHelpers.js — Complete version with password auth.
 */

import {
  collection, doc, setDoc, getDoc, addDoc,
  getDocs, query, where, serverTimestamp, updateDoc,
  onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'
import { hashPassword, verifyPassword } from './auth'

// ─────────────────────────────────────────────
// USERNAME VALIDATION
// ─────────────────────────────────────────────

export function validateUsername(name) {
  if (!name || name.trim().length < 3) return 'Username must be at least 3 characters.'
  if (name.trim().length > 20) return 'Username must be 20 characters or less.'
  if (!/^[a-zA-Z0-9_]+$/.test(name.trim()))
    return 'Only letters, numbers, and underscores — no spaces.'
  return null
}

export function validatePassword(password) {
  if (!password || password.length < 6) return 'Password must be at least 6 characters.'
  return null
}

export async function isUsernameTaken(name) {
  const snap = await getDoc(doc(db, 'users', name.trim().toLowerCase()))
  return snap.exists()
}

export function generateUsernameSuggestions(base) {
  const b = base.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const n = Math.floor(Math.random() * 99) + 1
  return [`${b}_${n}`, `${b}_study`, `${b}${new Date().getFullYear()}`, `the_${b}`]
}

// ─────────────────────────────────────────────
// USER CREATION & AUTH
// ─────────────────────────────────────────────

/**
 * Creates a new user with hashed password.
 * @returns {Promise<object>} The created user doc data
 */
export async function createUser({ username, password, displayName, avatarColor }) {
  const lowerUsername = username.trim().toLowerCase()
  const passwordHash = await hashPassword(password)

  const userData = {
    username: lowerUsername,
    displayName: displayName || username.trim(),
    passwordHash,
    avatarColor: avatarColor || '#7c3aed',
    createdAt: serverTimestamp(),
    weeklyPlan: {},
  }

  await setDoc(doc(db, 'users', lowerUsername), userData)
  return userData
}

/**
 * Verifies login credentials.
 * @returns {Promise<{ok: boolean, userDoc?: object, error?: string}>}
 */
export async function loginUser(username, password) {
  const lowerUsername = username.trim().toLowerCase()
  const snap = await getDoc(doc(db, 'users', lowerUsername))

  if (!snap.exists()) {
    return { ok: false, error: `No account found for @${lowerUsername}. Did you mean to sign up?` }
  }

  const data = snap.data()

  // Legacy accounts (no passwordHash) — prompt to reset
  if (!data.passwordHash) {
    return { ok: false, error: 'This account needs a password reset. Please create a new account.' }
  }

  const valid = await verifyPassword(password, data.passwordHash)
  if (!valid) {
    return { ok: false, error: 'Incorrect password. Please try again.' }
  }

  return { ok: true, userDoc: data }
}

/**
 * Gets a user document by username.
 */
export async function getUserDoc(username) {
  const snap = await getDoc(doc(db, 'users', username.toLowerCase()))
  return snap.exists() ? snap.data() : null
}

// ─────────────────────────────────────────────
// WEEKLY PLAN
// ─────────────────────────────────────────────

export async function saveWeeklyPlan(userName, weeklyPlan) {
  await updateDoc(doc(db, 'users', userName.toLowerCase()), { weeklyPlan })
}

export async function getWeeklyPlan(userName) {
  const data = await getUserDoc(userName)
  return data?.weeklyPlan || {}
}

// ─────────────────────────────────────────────
// LIVE STATUS (real-time partner view)
// ─────────────────────────────────────────────

export async function updateLiveStatus(userName, { isRunning, baseElapsed }) {
  if (!userName) return
  const statusRef = doc(db, 'liveStatus', userName.toLowerCase())
  await setDoc(statusRef, {
    userName: userName.toLowerCase(),
    isRunning,
    baseElapsed: baseElapsed || 0,
    startedAt: isRunning ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  }, { merge: true })
}

export function subscribeToPartnerStatus(partnerName, callback) {
  const statusRef = doc(db, 'liveStatus', partnerName.toLowerCase())
  return onSnapshot(statusRef, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

// ─────────────────────────────────────────────
// SCREENSHOT
// ─────────────────────────────────────────────

export async function captureAndUploadScreenshot(element, userName, dateStr) {
  const TIMEOUT_MS = 6000
  const capturePromise = (async () => {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a1a', scale: 2, logging: false,
      useCORS: true, allowTaint: true, foreignObjectRendering: false,
    })
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(''); return }
        try {
          const filename = `${dateStr}_${Date.now()}.png`
          const storageRef = ref(storage, `screenshots/${userName}/${filename}`)
          await uploadBytes(storageRef, blob, { contentType: 'image/png' })
          resolve(await getDownloadURL(storageRef))
        } catch { resolve('') }
      }, 'image/png')
    })
  })()
  return Promise.race([
    capturePromise,
    new Promise((resolve) => setTimeout(() => resolve(''), TIMEOUT_MS)),
  ])
}

// ─────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────

export async function saveSession({ userName, date, totalTime, totalSeconds, laps, screenshotUrl }) {
  const ref2 = await addDoc(collection(db, 'sessions'), {
    userName: userName.toLowerCase(),
    date, totalTime, totalSeconds, laps, screenshotUrl,
    createdAt: serverTimestamp(),
  })
  return ref2.id
}

export async function getUserSessions(userName) {
  const q = query(collection(db, 'sessions'), where('userName', '==', userName.toLowerCase()))
  const snap = await getDocs(q)
  const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return sessions.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export async function getSessionsByDate(userName, dateStr) {
  const q = query(
    collection(db, 'sessions'),
    where('userName', '==', userName.toLowerCase()),
    where('date', '==', dateStr)
  )
  const snap = await getDocs(q)
  const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return sessions.sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
}

export function groupSessionsByDate(sessions) {
  const map = {}
  for (const s of sessions) {
    if (!map[s.date]) map[s.date] = { date: s.date, totalSeconds: 0, sessions: [] }
    map[s.date].totalSeconds += s.totalSeconds || 0
    map[s.date].sessions.push(s)
  }
  return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ─────────────────────────────────────────────
// STREAKS + GOALS
// ─────────────────────────────────────────────

export function calculateStreaks(dateGroups) {
  if (!dateGroups.length) return { currentStreak: 0, longestStreak: 0 }
  const studiedDates = new Set(dateGroups.map((g) => g.date))

  let currentStreak = 0
  const d = new Date()
  for (let i = 0; i < 365; i++) {
    const str = toDateStr(d)
    if (studiedDates.has(str)) { currentStreak++; d.setDate(d.getDate() - 1) }
    else if (i === 0) { d.setDate(d.getDate() - 1); continue }
    else break
  }

  const sorted = [...studiedDates].sort()
  let longest = 0, streak = 0, prev = null
  for (const s of sorted) {
    if (prev) {
      const diff = Math.round((new Date(s) - new Date(prev)) / 86400000)
      streak = diff === 1 ? streak + 1 : 1
    } else { streak = 1 }
    longest = Math.max(longest, streak)
    prev = s
  }

  return { currentStreak, longestStreak: longest }
}

function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

export function getTargetForDate(dateStr, weeklyPlan) {
  if (!weeklyPlan || !dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weeklyPlan[days[date.getDay()]] || null
}
