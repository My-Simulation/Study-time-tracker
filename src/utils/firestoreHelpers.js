/**
 * firestoreHelpers.js
 * All Firestore & Storage helpers for Study Time Tracker.
 */

import {
  collection, doc, setDoc, getDoc, addDoc,
  getDocs, query, where, serverTimestamp, updateDoc,
  onSnapshot,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

// ─────────────────────────────────────────────
// USERNAME HELPERS
// ─────────────────────────────────────────────

/**
 * Validates username format — like Instagram:
 * 3-20 chars, only letters/numbers/underscores, no spaces.
 */
export function validateUsername(name) {
  if (!name || name.length < 3) return 'Username must be at least 3 characters.'
  if (name.length > 20) return 'Username must be 20 characters or less.'
  if (!/^[a-zA-Z0-9_]+$/.test(name))
    return 'Only letters, numbers, and underscores allowed (no spaces).'
  return null // null = valid
}

/**
 * Checks if a username is already taken in Firestore (case-insensitive).
 * @returns {Promise<boolean>}
 */
export async function isUsernameTaken(name) {
  const snap = await getDoc(doc(db, 'users', name.toLowerCase()))
  return snap.exists()
}

/**
 * Generates username suggestions when a name is taken.
 * @param {string} base
 * @returns {string[]}
 */
export function generateUsernameSuggestions(base) {
  const b = base.toLowerCase().replace(/[^a-z0-9_]/g, '')
  return [
    `${b}_${Math.floor(Math.random() * 99) + 1}`,
    `${b}_study`,
    `${b}${new Date().getFullYear()}`,
    `the_${b}`,
  ]
}

/**
 * Creates a user document in Firestore.
 * Stores everything lowercase for uniqueness.
 */
export async function ensureUserExists(name) {
  const lowerName = name.toLowerCase()
  const userRef = doc(db, 'users', lowerName)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      name: lowerName,
      displayName: name, // preserves original casing for display
      createdAt: serverTimestamp(),
      weeklyPlan: {},
    })
  }
  return lowerName
}

/**
 * Gets a user document by name.
 */
export async function getUserDoc(name) {
  const snap = await getDoc(doc(db, 'users', name.toLowerCase()))
  return snap.exists() ? snap.data() : null
}

// ─────────────────────────────────────────────
// WEEKLY PLAN HELPERS
// ─────────────────────────────────────────────

/**
 * Saves the weekly study plan to the user's Firestore doc.
 * @param {string} userName
 * @param {object} weeklyPlan - { "Mon": { targetMinutes, subjects }, ... }
 */
export async function saveWeeklyPlan(userName, weeklyPlan) {
  await updateDoc(doc(db, 'users', userName.toLowerCase()), { weeklyPlan })
}

/**
 * Gets the weekly plan for a user.
 * @returns {Promise<object>}
 */
export async function getWeeklyPlan(userName) {
  const data = await getUserDoc(userName)
  return data?.weeklyPlan || {}
}

// ─────────────────────────────────────────────
// LIVE STATUS HELPERS (real-time partner view)
// ─────────────────────────────────────────────

/**
 * Writes the user's live timer status to Firestore.
 * Called when timer starts/stops.
 */
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

/**
 * Subscribes to a partner's live status with real-time updates.
 * @param {string} partnerName
 * @param {function} callback - called with status object on change
 * @returns {function} unsubscribe function
 */
export function subscribeToPartnerStatus(partnerName, callback) {
  const statusRef = doc(db, 'liveStatus', partnerName.toLowerCase())
  return onSnapshot(statusRef, (snap) => {
    if (snap.exists()) {
      callback(snap.data())
    } else {
      callback(null)
    }
  })
}

// ─────────────────────────────────────────────
// SCREENSHOT HELPERS
// ─────────────────────────────────────────────

/**
 * Captures a DOM element as PNG and uploads to Firebase Storage.
 * Has a 6-second timeout — returns '' on failure/timeout so save always continues.
 */
export async function captureAndUploadScreenshot(element, userName, dateStr) {
  const TIMEOUT_MS = 6000

  const capturePromise = (async () => {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(element, {
      backgroundColor: '#1a1a1a',
      scale: 2,
      logging: false,
      useCORS: true,
      allowTaint: true,
      foreignObjectRendering: false,
    })
    return new Promise((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve(''); return }
        try {
          const filename = `${dateStr}_${Date.now()}.png`
          const storageRef = ref(storage, `screenshots/${userName}/${filename}`)
          await uploadBytes(storageRef, blob, { contentType: 'image/png' })
          const url = await getDownloadURL(storageRef)
          resolve(url)
        } catch (err) {
          console.warn('Storage upload failed:', err)
          resolve('')
        }
      }, 'image/png')
    })
  })()

  const timeoutPromise = new Promise((resolve) =>
    setTimeout(() => { console.warn('Screenshot timed out'); resolve('') }, TIMEOUT_MS)
  )

  return Promise.race([capturePromise, timeoutPromise])
}

// ─────────────────────────────────────────────
// SESSION HELPERS
// ─────────────────────────────────────────────

export async function saveSession({ userName, date, totalTime, totalSeconds, laps, screenshotUrl }) {
  const docRef = await addDoc(collection(db, 'sessions'), {
    userName: userName.toLowerCase(),
    date, totalTime, totalSeconds, laps, screenshotUrl,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

export async function getUserSessions(userName) {
  const q = query(
    collection(db, 'sessions'),
    where('userName', '==', userName.toLowerCase())
  )
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
  for (const session of sessions) {
    if (!map[session.date]) {
      map[session.date] = { date: session.date, totalSeconds: 0, sessions: [] }
    }
    map[session.date].totalSeconds += session.totalSeconds || 0
    map[session.date].sessions.push(session)
  }
  return Object.values(map).sort((a, b) => (a.date < b.date ? 1 : -1))
}

// ─────────────────────────────────────────────
// STREAK + GOAL HELPERS
// ─────────────────────────────────────────────

/**
 * Calculates current streak and longest streak from session date groups.
 */
export function calculateStreaks(dateGroups) {
  if (!dateGroups.length) return { currentStreak: 0, longestStreak: 0 }

  const studiedDates = new Set(dateGroups.map((g) => g.date))
  const today = new Date()

  // Current streak: count backwards from today
  let currentStreak = 0
  const d = new Date(today)
  for (let i = 0; i < 365; i++) {
    const str = toDateStr(d)
    if (studiedDates.has(str)) {
      currentStreak++
      d.setDate(d.getDate() - 1)
    } else if (i === 0) {
      // Skip today if not studied yet — check yesterday
      d.setDate(d.getDate() - 1)
      continue
    } else {
      break
    }
  }

  // Longest streak
  const sorted = [...studiedDates].sort()
  let longest = 0, streak = 0, prev = null
  for (const dateStr of sorted) {
    if (prev) {
      const diff = Math.round(
        (new Date(dateStr) - new Date(prev)) / 86400000
      )
      streak = diff === 1 ? streak + 1 : 1
    } else {
      streak = 1
    }
    longest = Math.max(longest, streak)
    prev = dateStr
  }

  return { currentStreak, longestStreak: longest }
}

function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const dy = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

/**
 * Given a date string and weekly plan, returns the target minutes for that day.
 * Day keys: "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
 */
export function getTargetForDate(dateStr, weeklyPlan) {
  if (!weeklyPlan || !dateStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayKey = days[date.getDay()]
  return weeklyPlan[dayKey] || null
}
