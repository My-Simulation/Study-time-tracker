/**
 * firestoreHelpers.js — Complete version with password auth.
 */

import {
  collection, doc, setDoc, getDoc, addDoc,
  getDocs, query, where, serverTimestamp, updateDoc,
  deleteDoc, onSnapshot, limit,
} from 'firebase/firestore'
import { signInWithPopup } from 'firebase/auth'
import { db, getStorageInstance, auth, googleProvider } from '../firebase'
import { hashPassword, verifyPassword } from './auth'
import { toLocalDateStr, getLocalWeekdayId, todayString } from './formatTime'

// ─────────────────────────────────────────────
// USERNAME VALIDATION
// ─────────────────────────────────────────────

export function validateUsername(name) {
  if (!name || name.trim().length < 4) return 'Username must be at least 4 characters long.'
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

// ─────────────────────────────────────────────
// HIGH-PERFORMANCE MULTI-TIER CACHING & DEDUPLICATION
// ─────────────────────────────────────────────
const CACHE_TTL_MS = 60000 // 60 seconds memory cache

const memoryCache = {
  userDocs: new Map(), // key: lowerUsername -> { data, ts }
  userSessions: new Map(), // key: lowerUsername -> { data, ts }
}

const inFlightUserDoc = new Map() // key: lowerUsername -> Promise
const inFlightSessions = new Map() // key: lowerUsername -> Promise

/**
 * Timeout helper to prevent network calls from hanging indefinitely
 */
function withTimeout(promise, ms = 3500, fallbackVal = null) {
  let timerId
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => resolve(fallbackVal), ms)
  })
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timerId)
      return res
    }).catch((err) => {
      clearTimeout(timerId)
      throw err
    }),
    timeoutPromise,
  ])
}

export function invalidateUserCache(userName) {
  if (!userName) return
  const u = userName.toLowerCase()
  memoryCache.userDocs.delete(u)
  memoryCache.userSessions.delete(u)
  inFlightUserDoc.delete(u)
  inFlightSessions.delete(u)
}

/**
 * Gets a user document by username with instant 0ms localStorage fallback,
 * in-flight request deduplication, and background revalidation.
 */
export async function getUserDoc(username, force = false) {
  if (!username) return null
  const uKey = username.toLowerCase()

  // 1. In-memory cache check (0ms)
  const memCached = memoryCache.userDocs.get(uKey)
  if (!force && memCached && Date.now() - memCached.ts < CACHE_TTL_MS) {
    return memCached.data
  }

  // 2. Persistent localStorage cache check (0ms on page refresh!)
  let localData = null
  if (!force) {
    try {
      const raw = localStorage.getItem(`stt_user_doc_${uKey}`)
      if (raw) {
        localData = JSON.parse(raw)
        memoryCache.userDocs.set(uKey, { data: localData, ts: Date.now() })
      }
    } catch {}
  }

  // Stale-While-Revalidate: return cached data immediately, revalidate in background
  if (localData && !force) {
    if (!inFlightUserDoc.has(uKey)) {
      const bgPromise = (async () => {
        try {
          const snap = await withTimeout(getDoc(doc(db, 'users', uKey)), 3500, null)
          if (snap && snap.exists && snap.exists()) {
            const freshData = snap.data()
            memoryCache.userDocs.set(uKey, { data: freshData, ts: Date.now() })
            try {
              localStorage.setItem(`stt_user_doc_${uKey}`, JSON.stringify(freshData))
            } catch {}
          }
        } catch {} finally {
          inFlightUserDoc.delete(uKey)
        }
      })()
      inFlightUserDoc.set(uKey, bgPromise)
    }
    return localData
  }

  // 3. Deduplicate in-flight requests (reuse ongoing network call)
  if (inFlightUserDoc.has(uKey)) {
    return inFlightUserDoc.get(uKey)
  }

  // 4. Fetch from Firestore with timeout guard
  const fetchPromise = (async () => {
    try {
      const snap = await withTimeout(getDoc(doc(db, 'users', uKey)), 3500, null)
      const data = snap && snap.exists ? (snap.exists() ? snap.data() : null) : localData
      if (data) {
        memoryCache.userDocs.set(uKey, { data, ts: Date.now() })
        try {
          localStorage.setItem(`stt_user_doc_${uKey}`, JSON.stringify(data))
        } catch {}
      }
      return data
    } catch (err) {
      if (localData) return localData
      if (memCached) return memCached.data
      console.warn('getUserDoc error:', err)
      return null
    } finally {
      inFlightUserDoc.delete(uKey)
    }
  })()

  inFlightUserDoc.set(uKey, fetchPromise)
  return fetchPromise
}

/**
 * Resets a user's password with a new one.
 */
export async function resetUserPassword(username, newPassword) {
  const lowerUsername = username.trim().toLowerCase()
  const snap = await getDoc(doc(db, 'users', lowerUsername))
  if (!snap.exists()) {
    return { ok: false, error: `No account found for @${lowerUsername}.` }
  }
  const pwErr = validatePassword(newPassword)
  if (pwErr) return { ok: false, error: pwErr }

  const passwordHash = await hashPassword(newPassword)
  await updateDoc(doc(db, 'users', lowerUsername), { passwordHash })
  const updatedDoc = (await getDoc(doc(db, 'users', lowerUsername))).data()
  return { ok: true, userDoc: updatedDoc }
}

/**
 * Updates editable profile fields (displayName, avatarColor, photoUrl).
 */
export async function updateUserProfile(username, { displayName, avatarColor, photoUrl }) {
  const lowerUsername = username.trim().toLowerCase()
  const payload = {}
  if (displayName !== undefined) payload.displayName = displayName.trim()
  if (avatarColor !== undefined) payload.avatarColor = avatarColor
  if (photoUrl !== undefined) payload.photoUrl = photoUrl

  await updateDoc(doc(db, 'users', lowerUsername), payload)
  return await getUserDoc(lowerUsername)
}

/**
 * Changes username with complete migration of sessions, dayPlanners, syllabus, and liveStatus.
 */
export async function changeUsername(oldUsername, newUsername) {
  const oldLower = oldUsername.trim().toLowerCase()
  const newLower = newUsername.trim().toLowerCase()

  if (oldLower === newLower) {
    return { ok: true, username: newLower }
  }

  const valErr = validateUsername(newLower)
  if (valErr) return { ok: false, error: valErr }

  const taken = await isUsernameTaken(newLower)
  if (taken) {
    return { ok: false, error: `@${newLower} is already taken. Please pick another username.` }
  }

  // 1. Fetch current user doc
  const userDocSnap = await getDoc(doc(db, 'users', oldLower))
  if (!userDocSnap.exists()) {
    return { ok: false, error: 'Account not found.' }
  }

  const userData = userDocSnap.data()
  const newUserData = {
    ...userData,
    username: newLower,
    displayName: userData.displayName === oldLower ? newLower : userData.displayName,
    updatedAt: serverTimestamp(),
  }

  // 2. Create new user doc with migrated state
  await setDoc(doc(db, 'users', newLower), newUserData)

  // 3. Migrate all historical sessions
  try {
    const q = query(collection(db, 'sessions'), where('userName', '==', oldLower))
    const snap = await getDocs(q)
    const updatePromises = snap.docs.map((d) =>
      updateDoc(doc(db, 'sessions', d.id), { userName: newLower })
    )
    await Promise.all(updatePromises)
  } catch (sessErr) {
    console.warn('Error migrating sessions to new username:', sessErr)
  }

  // 4. Migrate liveStatus
  try {
    const liveSnap = await getDoc(doc(db, 'liveStatus', oldLower))
    if (liveSnap.exists()) {
      await setDoc(doc(db, 'liveStatus', newLower), {
        ...liveSnap.data(),
        userName: newLower,
      })
      await deleteDoc(doc(db, 'liveStatus', oldLower))
    }
  } catch (liveErr) {
    console.warn('Error migrating liveStatus:', liveErr)
  }

  // 5. Delete old user doc
  try {
    await deleteDoc(doc(db, 'users', oldLower))
  } catch (delErr) {
    console.warn('Error deleting old user doc:', delErr)
  }

  // 6. Migrate local storage state keys
  try {
    const oldKeys = [
      `stt_stopwatch_state_${oldLower}`,
      `stt_syllabus_${oldLower}`,
    ]
    oldKeys.forEach((oldK) => {
      const val = localStorage.getItem(oldK)
      if (val) {
        const newK = oldK.replace(oldLower, newLower)
        localStorage.setItem(newK, val)
        localStorage.removeItem(oldK)
      }
    })
  } catch {}

  return { ok: true, username: newLower, userDoc: newUserData }
}

// ─────────────────────────────────────────────
// USER SETTINGS (Single Source of Truth)
// ─────────────────────────────────────────────

export async function getUserSettings(userName, force = false) {
  if (!userName) return { sundayRestDay: false, effectiveFrom: null }
  const uKey = userName.toLowerCase()
  try {
    const cached = localStorage.getItem(`stt_settings_${uKey}`)
    if (cached && !force) {
      const parsed = JSON.parse(cached)
      return {
        sundayRestDay: Boolean(parsed.sundayRestDay),
        effectiveFrom: parsed.effectiveFrom || null,
      }
    }
  } catch {}

  try {
    const docData = await getUserDoc(uKey, force)
    const settings = {
      sundayRestDay: Boolean(docData?.settings?.sundayRestDay),
      effectiveFrom: docData?.settings?.effectiveFrom || null,
    }
    try {
      localStorage.setItem(`stt_settings_${uKey}`, JSON.stringify(settings))
    } catch {}
    return settings
  } catch {
    return { sundayRestDay: false, effectiveFrom: null }
  }
}

export async function saveUserSettings(userName, newSettings) {
  if (!userName) return { sundayRestDay: false, effectiveFrom: null }
  const uKey = userName.toLowerCase()
  invalidateUserCache(uKey)
  const isEnabled = Boolean(newSettings?.sundayRestDay)
  const settings = {
    sundayRestDay: isEnabled,
    effectiveFrom: isEnabled
      ? (newSettings?.effectiveFrom || todayString())
      : null,
  }
  try {
    localStorage.setItem(`stt_settings_${uKey}`, JSON.stringify(settings))
  } catch {}

  try {
    await setDoc(
      doc(db, 'users', uKey),
      { settings },
      { merge: true }
    )
  } catch (err) {
    console.warn('Error saving settings to Firestore:', err)
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('study_settings_updated', { detail: { userName, settings } })
    )
  }
  return settings
}

/**
 * Single source of truth helper to check if a given date is an active rest day.
 * Never checks "is it Sunday" independently.
 * Uses getLocalWeekdayId to avoid raw array indexing and timezone skews.
 */
export function isRestDay(dateInput, rawSettings) {
  const settings = normalizeSettings(rawSettings)
  if (!settings || !settings.sundayRestDay || !settings.effectiveFrom) return false
  const dateStr = toLocalDateStr(dateInput)
  if (!dateStr || dateStr < settings.effectiveFrom) return false
  return getLocalWeekdayId(dateInput) === 'Sun'
}

// ─────────────────────────────────────────────
// WEEKLY PLAN
// ─────────────────────────────────────────────

export async function saveWeeklyPlan(userName, weeklyPlan) {
  invalidateUserCache(userName)
  await updateDoc(doc(db, 'users', userName.toLowerCase()), { weeklyPlan })
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('study_plan_updated', { detail: { userName, weeklyPlan } }))
  }
}

export async function getWeeklyPlan(userName) {
  const data = await getUserDoc(userName)
  return data?.weeklyPlan || {}
}

// ─────────────────────────────────────────────
// LIVE STATUS (real-time cross-device & partner view)
// ─────────────────────────────────────────────

export async function updateLiveStatus(userName, { isRunning, baseElapsed, startTimestamp, deviceId, laps, subject, topic }) {
  if (!userName) return
  const statusRef = doc(db, 'liveStatus', userName.toLowerCase())
  const now = Date.now()
  const payload = {
    userName: userName.toLowerCase(),
    isRunning: Boolean(isRunning),
    baseElapsed: Number(baseElapsed) || 0,
    startedAtMs: isRunning && startTimestamp ? Number(startTimestamp) : null,
    updatedAtMs: now,
    updatedAt: serverTimestamp(),
  }
  if (deviceId) payload.deviceId = deviceId
  if (laps) payload.laps = laps
  if (subject !== undefined) payload.subject = subject
  if (topic !== undefined) payload.topic = topic

  await setDoc(statusRef, payload, { merge: true })
}

export function subscribeToLiveStatus(userName, callback) {
  if (!userName) return () => {}
  const statusRef = doc(db, 'liveStatus', userName.toLowerCase())
  return onSnapshot(statusRef, (snap) => {
    callback(snap.exists() ? snap.data() : null)
  })
}

export function subscribeToPartnerStatus(partnerName, callback) {
  return subscribeToLiveStatus(partnerName, callback)
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
          const [{ ref, uploadBytes, getDownloadURL }, storage] = await Promise.all([
            import('firebase/storage'),
            getStorageInstance(),
          ])
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

export async function saveSession({
  userName,
  date,
  totalTime,
  totalSeconds,
  laps,
  screenshotUrl,
  focusScore = 0,
  outputCount = null,
  outputUnit = '',
  notes = '',
  subject = '',
  topic = '',
  reflectionTag = '',
}) {
  const localDate = toLocalDateStr(date)
  const settings = await getUserSettings(userName)
  if (isRestDay(localDate, settings)) {
    throw new Error('Rest Day Active: No study sessions can be recorded on a Rest Day (Streak Shield Active).')
  }

  const sessionData = {
    userName: userName.toLowerCase(),
    date: localDate,
    totalTime,
    totalSeconds,
    laps,
    screenshotUrl,
    createdAt: serverTimestamp(),
  }

  // Add optional outcome & target tracking fields if provided
  if (focusScore) sessionData.focusScore = Number(focusScore)
  if (outputCount !== null && outputCount !== '' && !isNaN(outputCount)) {
    sessionData.outputCount = Number(outputCount)
  }
  if (outputUnit) sessionData.outputUnit = String(outputUnit).trim()
  if (notes) sessionData.notes = String(notes).trim()
  if (subject) sessionData.subject = String(subject).trim()
  if (topic) sessionData.topic = String(topic).trim()
  if (reflectionTag) sessionData.reflectionTag = String(reflectionTag).trim()

  // Deduplication check: prevent inserting duplicate sessions with identical or near-identical time
  try {
    const existingQ = query(
      collection(db, 'sessions'),
      where('userName', '==', userName.toLowerCase()),
      where('date', '==', date)
    )
    const existingSnap = await getDocs(existingQ)
    const duplicate = existingSnap.docs.find((d) => {
      const data = d.data()
      return Math.abs((data.totalSeconds || 0) - totalSeconds) <= 3
    })
    if (duplicate) {
      console.warn('Duplicate session detected, updating existing session instead of inserting duplicate:', duplicate.id)
      await updateDoc(doc(db, 'sessions', duplicate.id), sessionData)
      invalidateUserCache(userName)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('study_sessions_updated', { detail: { userName, date } }))
      }
      return duplicate.id
    }
  } catch (dupErr) {
    console.warn('Deduplication check error:', dupErr)
  }

  const ref2 = await addDoc(collection(db, 'sessions'), sessionData)
  invalidateUserCache(userName)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('study_sessions_updated', { detail: { userName, date } }))
  }
  return ref2.id
}

/**
 * Gets all user sessions with instant 0ms localStorage fallback,
 * in-flight request deduplication, and background revalidation.
 */
export async function getUserSessions(userName, force = false) {
  if (!userName) return []
  const uKey = userName.toLowerCase()

  // 1. In-memory cache check (0ms)
  const memCached = memoryCache.userSessions.get(uKey)
  if (!force && memCached && Date.now() - memCached.ts < CACHE_TTL_MS) {
    return memCached.data
  }

  // 2. Persistent localStorage cache check (0ms on page refresh!)
  let localSessions = null
  if (!force) {
    try {
      const raw = localStorage.getItem(`stt_user_sessions_${uKey}`)
      if (raw) {
        localSessions = JSON.parse(raw)
        memoryCache.userSessions.set(uKey, { data: localSessions, ts: Date.now() })
      }
    } catch {}
  }

  // Stale-While-Revalidate: return cached sessions immediately, revalidate in background
  if (localSessions && !force) {
    if (!inFlightSessions.has(uKey)) {
      const bgPromise = (async () => {
        try {
          const q = query(collection(db, 'sessions'), where('userName', '==', uKey))
          const snap = await withTimeout(getDocs(q), 4500, null)
          if (snap && snap.docs) {
            const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            const sorted = sessions.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
            memoryCache.userSessions.set(uKey, { data: sorted, ts: Date.now() })
            try {
              localStorage.setItem(`stt_user_sessions_${uKey}`, JSON.stringify(sorted))
            } catch {}
          }
        } catch {} finally {
          inFlightSessions.delete(uKey)
        }
      })()
      inFlightSessions.set(uKey, bgPromise)
    }
    return localSessions
  }

  // 3. Deduplicate in-flight requests
  if (inFlightSessions.has(uKey)) {
    return inFlightSessions.get(uKey)
  }

  // 4. Fetch from Firestore with timeout guard
  const fetchPromise = (async () => {
    try {
      const q = query(collection(db, 'sessions'), where('userName', '==', uKey))
      const snap = await withTimeout(getDocs(q), 4500, null)
      let sorted = localSessions || []
      if (snap && snap.docs) {
        const sessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        sorted = sessions.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
      }
      memoryCache.userSessions.set(uKey, { data: sorted, ts: Date.now() })
      try {
        localStorage.setItem(`stt_user_sessions_${uKey}`, JSON.stringify(sorted))
      } catch {}
      return sorted
    } catch (err) {
      if (localSessions) return localSessions
      if (memCached) return memCached.data
      console.warn('getUserSessions error:', err)
      return []
    } finally {
      inFlightSessions.delete(uKey)
    }
  })()

  inFlightSessions.set(uKey, fetchPromise)
  return fetchPromise
}

/**
 * Gets sessions for a date — derives from cached getUserSessions with 0 extra Firestore reads!
 */
export async function getSessionsByDate(userName, dateStr) {
  if (!userName || !dateStr) return []
  const allSessions = await getUserSessions(userName)
  return allSessions
    .filter((s) => s.date === dateStr)
    .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0))
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

function addDaysToDateStr(dateStr, days) {
  if (!dateStr || typeof dateStr !== 'string') return todayString()
  const parts = dateStr.trim().split('-').map(Number)
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return todayString()
  }
  const [y, m, d] = parts
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  const ny = date.getFullYear()
  const nm = String(date.getMonth() + 1).padStart(2, '0')
  const nd = String(date.getDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

function normalizeSettings(settingsOrPlan) {
  if (!settingsOrPlan) return { sundayRestDay: false, effectiveFrom: null }
  if (typeof settingsOrPlan.sundayRestDay === 'boolean') {
    return {
      sundayRestDay: settingsOrPlan.sundayRestDay,
      effectiveFrom: settingsOrPlan.effectiveFrom || (settingsOrPlan.sundayRestDay ? '1970-01-01' : null),
    }
  }
  if (settingsOrPlan.settings && typeof settingsOrPlan.settings.sundayRestDay === 'boolean') {
    return {
      sundayRestDay: settingsOrPlan.settings.sundayRestDay,
      effectiveFrom: settingsOrPlan.settings.effectiveFrom || (settingsOrPlan.settings.sundayRestDay ? '1970-01-01' : null),
    }
  }
  if (typeof settingsOrPlan.sundayRest === 'boolean') {
    return {
      sundayRestDay: settingsOrPlan.sundayRest,
      effectiveFrom: settingsOrPlan.sundayRest ? '1970-01-01' : null,
    }
  }
  return { sundayRestDay: false, effectiveFrom: null }
}

/**
 * Pure Derived Streak Calculation Engine
 * ──────────────────────────────────────
 * isStreakDay(d) =
 *     hasStudySession(d)
 *     OR ( isRestDay(d) AND d <= today AND isStreakDay(d - 1) )
 *
 * streak = number of consecutive streak days ending today (or yesterday, if today's normal day is still in progress).
 */
export function calculateStreaks(dateGroups, arg2 = null, arg3 = null, arg4 = null) {
  if (!dateGroups || !Array.isArray(dateGroups) || dateGroups.length === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // Flexibly handle various caller signatures:
  // - calculateStreaks(groups, settings)
  // - calculateStreaks(groups, weeklyPlan, settings)
  // - calculateStreaks(groups, settings, todayDateStr)
  // - calculateStreaks(groups, weeklyPlan, settings, todayDateStr)
  let rawSettings = null
  let rawDateStr = null

  const extraArgs = [arg2, arg3, arg4]
  for (const arg of extraArgs) {
    if (!arg) continue
    if (typeof arg === 'string') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(arg.trim())) {
        rawDateStr = arg.trim()
      }
    } else if (typeof arg === 'object') {
      if (arg.sundayRestDay !== undefined) {
        rawSettings = arg
      } else if (!rawSettings) {
        rawSettings = arg
      }
    }
  }

  const settings = normalizeSettings(rawSettings)
  const todayStr = rawDateStr || todayString()

  // 1. Build set of dates with positive study time
  const studiedDates = new Set()
  for (const g of dateGroups) {
    if (!g) continue
    const dStr = typeof g === 'string' ? g : g.date
    const totalSec = typeof g.totalSeconds === 'number'
      ? g.totalSeconds
      : (g.sessions ? g.sessions.reduce((s, x) => s + (x.totalSeconds || 0), 0) : 1)
    if (dStr && totalSec > 0) {
      const parsed = toLocalDateStr(dStr)
      if (parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
        studiedDates.add(parsed)
      }
    }
  }

  if (studiedDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0 }
  }

  // 2. Evaluate streak days chronologically from earliest study date up to todayStr
  const sortedStudied = Array.from(studiedDates).sort()
  const minDate = sortedStudied[0]
  const streakDaysSet = new Set()

  let curDate = minDate
  let maxLoop1 = 3650 // Max 10 years safety break to guarantee NO infinite loop ever
  while (curDate <= todayStr && maxLoop1-- > 0) {
    const hasStudy = studiedDates.has(curDate)
    const prevDate = addDaysToDateStr(curDate, -1)
    const prevIsStreak = streakDaysSet.has(prevDate)
    const isRest = isRestDay(curDate, settings)

    const isStreak = hasStudy || (isRest && prevIsStreak)
    if (isStreak) {
      streakDaysSet.add(curDate)
    }
    const nextDate = addDaysToDateStr(curDate, 1)
    if (nextDate <= curDate) break
    curDate = nextDate
  }

  // 3. Compute Current Streak
  let currentStreak = 0
  if (streakDaysSet.has(todayStr)) {
    // Today is an active streak day (studied or rest day with Sat studied)
    let c = todayStr
    let maxStreakLoop = 3650
    while (streakDaysSet.has(c) && maxStreakLoop-- > 0) {
      currentStreak++
      const prevC = addDaysToDateStr(c, -1)
      if (prevC >= c) break
      c = prevC
    }
  } else if (!isRestDay(todayStr, settings)) {
    // Today is an ordinary study day still in progress (not ended/missed yet)
    const yesterday = addDaysToDateStr(todayStr, -1)
    if (streakDaysSet.has(yesterday)) {
      let c = yesterday
      let maxStreakLoop = 3650
      while (streakDaysSet.has(c) && maxStreakLoop-- > 0) {
        currentStreak++
        const prevC = addDaysToDateStr(c, -1)
        if (prevC >= c) break
        c = prevC
      }
    }
  }

  // 4. Compute Longest Streak
  let longestStreak = 0
  let runningStreak = 0
  let walkDate = minDate
  let maxLoop2 = 3650
  while (walkDate <= todayStr && maxLoop2-- > 0) {
    if (streakDaysSet.has(walkDate)) {
      runningStreak++
      if (runningStreak > longestStreak) longestStreak = runningStreak
    } else {
      runningStreak = 0
    }
    const nextWalk = addDaysToDateStr(walkDate, 1)
    if (nextWalk <= walkDate) break
    walkDate = nextWalk
  }
  longestStreak = Math.max(longestStreak, currentStreak)

  return { currentStreak, longestStreak }
}

export function getTargetForDate(dateStr, weeklyPlan, dayPlanners = null, settings = null) {
  if (!dateStr) return null
  const localDateStr = toLocalDateStr(dateStr)
  const normSettings = normalizeSettings(settings || weeklyPlan)
  const isRest = isRestDay(localDateStr, normSettings)

  // 1. If configured rest day
  if (isRest) {
    const dp = dayPlanners?.[localDateStr]
    return {
      targetMinutes: 0,
      targetHours: 0,
      isRestDay: true,
      restType: 'rest',
      subjects: dp?.notes || '🛋️ Sunday Rest Day (Streak Shield Active)',
      source: 'restDay',
    }
  }

  // 2. Specific Day Planner sheet targetHours for this date
  const dp = dayPlanners?.[localDateStr]
  const dpHours = Number(dp?.targetHours)
  if (dp && !isNaN(dpHours) && dpHours > 0) {
    return {
      targetMinutes: Math.round(dpHours * 60),
      targetHours: dpHours,
      subjects: dp.goals?.[0] || '',
      source: 'dayPlanner',
    }
  }

  // 3. Fallback to weeklyPlan template
  if (!weeklyPlan) return null
  const dayKey = getLocalWeekdayId(localDateStr)
  const wp = weeklyPlan[dayKey]
  const wpMin = Number(wp?.targetMinutes)

  if (wp && !isNaN(wpMin) && wpMin > 0) {
    return {
      ...wp,
      targetMinutes: wpMin,
      targetHours: Number((wpMin / 60).toFixed(2)),
      isRestDay: false,
      source: 'weeklyPlan',
    }
  }

  return null
}

// ─────────────────────────────────────────────
// SYLLABUS & TOPICS
// ─────────────────────────────────────────────

export async function saveSyllabus(userName, syllabus) {
  if (!userName) return
  invalidateUserCache(userName)
  const uKey = userName.toLowerCase()
  try {
    localStorage.setItem(`stt_syllabus_${uKey}`, JSON.stringify(syllabus))
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent('study_syllabus_updated', { detail: syllabus }))
  } catch {}
  try {
    await updateDoc(doc(db, 'users', uKey), { syllabus })
  } catch (err) {
    console.warn('Failed to save syllabus to Firestore:', err)
  }
}

export async function getSyllabus(userName, force = false) {
  if (!userName) return []
  const uKey = userName.toLowerCase()
  // 1. Fetch fresh from Firestore / memoryCache (respects 30s TTL unless force=true)
  try {
    const docData = await getUserDoc(uKey, force)
    if (docData && docData.syllabus !== undefined) {
      const syl = Array.isArray(docData.syllabus) ? docData.syllabus : []
      try {
        localStorage.setItem(`stt_syllabus_${uKey}`, JSON.stringify(syl))
      } catch {}
      return syl
    }
  } catch {}
  // 2. Fallback to localStorage if offline/network failure
  try {
    const cached = localStorage.getItem(`stt_syllabus_${uKey}`)
    if (cached) return JSON.parse(cached)
  } catch {}
  return []
}

/**
 * Real-time subscription to syllabus changes across all devices.
 * Fires instantly with local cache, then live updates whenever changed on any device.
 */
export function subscribeToSyllabus(userName, onUpdate) {
  if (!userName || typeof onUpdate !== 'function') return () => {}
  const uKey = userName.toLowerCase()
  const userRef = doc(db, 'users', uKey)

  // 1. Immediate local cache emission for 0ms initial render
  try {
    const cached = localStorage.getItem(`stt_syllabus_${uKey}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) {
        onUpdate(parsed)
      }
    }
  } catch {}

  // 2. Real-time Firestore snapshot listener
  return onSnapshot(
    userRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const syl = Array.isArray(data?.syllabus) ? data.syllabus : []
        try {
          localStorage.setItem(`stt_syllabus_${uKey}`, JSON.stringify(syl))
        } catch {}
        const existing = memoryCache.userDocs.get(uKey)
        if (existing) {
          existing.data = { ...(existing.data || {}), syllabus: syl }
        }
        onUpdate(syl)
      }
    },
    (err) => {
      console.warn('Syllabus snapshot listener error:', err)
    }
  )
}

// ─────────────────────────────────────────────
// EXAM COUNTDOWN & TARGET
// ─────────────────────────────────────────────

export async function saveExamGoal(userName, examGoal) {
  if (!userName) return
  invalidateUserCache(userName)
  const uKey = userName.toLowerCase()
  try {
    localStorage.setItem(`stt_exam_goal_${uKey}`, JSON.stringify(examGoal))
  } catch {}
  try {
    await updateDoc(doc(db, 'users', uKey), { examGoal })
  } catch (err) {
    console.warn('Failed to save exam goal to Firestore:', err)
  }
}

export async function getExamGoal(userName) {
  if (!userName) return null
  const uKey = userName.toLowerCase()
  try {
    const cached = localStorage.getItem(`stt_exam_goal_${uKey}`)
    if (cached) return JSON.parse(cached)
  } catch {}
  try {
    const docData = await getUserDoc(uKey)
    if (docData?.examGoal) {
      localStorage.setItem(`stt_exam_goal_${uKey}`, JSON.stringify(docData.examGoal))
      return docData.examGoal
    }
  } catch {}
  return null
}

// ─────────────────────────────────────────────
// DAILY MISSIONS
// ─────────────────────────────────────────────

export async function saveDailyMissions(userName, dateStr, missions) {
  if (!userName || !dateStr) return
  const uKey = userName.toLowerCase()
  try {
    localStorage.setItem(`stt_missions_${uKey}_${dateStr}`, JSON.stringify(missions))
  } catch {}
  try {
    await updateDoc(doc(db, 'users', uKey), {
      [`missions.${dateStr}`]: missions,
    })
  } catch (err) {
    console.warn('Failed to save daily missions to Firestore:', err)
  }
}

export async function getDailyMissions(userName, dateStr) {
  if (!userName || !dateStr) return []
  const uKey = userName.toLowerCase()
  try {
    const cached = localStorage.getItem(`stt_missions_${uKey}_${dateStr}`)
    if (cached) return JSON.parse(cached)
  } catch {}
  try {
    const docData = await getUserDoc(uKey)
    if (docData?.missions?.[dateStr]) {
      localStorage.setItem(`stt_missions_${uKey}_${dateStr}`, JSON.stringify(docData.missions[dateStr]))
      return docData.missions[dateStr]
    }
  } catch {}
  return []
}

// ─────────────────────────────────────────────
// SPACED REPETITION REVISION ALERTS
// ─────────────────────────────────────────────

/**
 * Calculates topics due for spaced repetition revision.
 * Intervals: 1 day ago (yesterday), 3 days ago, and 7 days ago.
 * @param {Array} sessions
 * @returns {{ day1: Array, day3: Array, day7: Array }}
 */
export function getSpacedRepetitionDue(sessions) {
  if (!sessions || !sessions.length) return { day1: [], day3: [], day7: [] }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const calcDateStr = (daysAgo) => {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    return toDateStr(d)
  }

  const d1Str = calcDateStr(1)
  const d3Str = calcDateStr(3)
  const d7Str = calcDateStr(7)

  const getTopicsForDate = (targetDateStr) => {
    const matches = sessions.filter((s) => s.date === targetDateStr)
    const set = new Map()
    for (const m of matches) {
      const label = m.topic ? (m.subject ? `${m.subject}: ${m.topic}` : m.topic) : m.subject || m.notes || 'Study Session'
      if (!set.has(label)) {
        set.set(label, {
          label,
          subject: m.subject || '',
          topic: m.topic || '',
          totalSeconds: m.totalSeconds || 0,
          date: targetDateStr,
          id: m.id,
        })
      } else {
        set.get(label).totalSeconds += m.totalSeconds || 0
      }
    }
    return Array.from(set.values())
  }

  return {
    day1: getTopicsForDate(d1Str),
    day3: getTopicsForDate(d3Str),
    day7: getTopicsForDate(d7Str),
  }
}

// ─────────────────────────────────────────────
// DAILY STUDY PLANNER SHEET ("My Plan. My Time. My Success.")
// ─────────────────────────────────────────────

export async function saveDayPlanner(userName, dateStr, planData) {
  if (!userName || !dateStr) return
  invalidateUserCache(userName)
  const uKey = userName.toLowerCase()
  try {
    localStorage.setItem(`stt_day_plan_${uKey}_${dateStr}`, JSON.stringify(planData))
  } catch {}
  try {
    await updateDoc(doc(db, 'users', uKey), {
      [`dayPlanners.${dateStr}`]: planData,
    })
  } catch (err) {
    console.warn('Failed to save day planner to Firestore:', err)
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('study_plan_updated', { detail: { userName, dateStr, planData } }))
  }
}

/**
 * Bidirectionally syncs target hours between DayPlanner and WeeklyPlan:
 * - Updates dayPlanners[dateStr].targetHours
 * - Maps dateStr to day-of-week (Mon..Sun) and updates weeklyPlan[dayKey].targetMinutes
 * - Writes to Firestore and updates localStorage caches
 * - Dispatches 'study_plan_updated' event for instant real-time sync across all components
 */
export async function syncTargetHours(userName, dateStr, targetHours) {
  if (!userName || !dateStr) return
  invalidateUserCache(userName)
  const uKey = userName.toLowerCase()
  const numHours = Number(targetHours) || 0
  const targetMinutes = Math.round(numHours * 60)
  const dayKey = getLocalWeekdayId(dateStr)

  // 1. Update local cache for dayPlanner
  try {
    const raw = localStorage.getItem(`stt_day_plan_${uKey}_${dateStr}`)
    const existing = raw ? JSON.parse(raw) : { date: dateStr }
    existing.targetHours = numHours
    existing.isRestDay = numHours === 0 ? true : (existing.isRestDay && numHours > 0 ? false : existing.isRestDay)
    existing.updatedAt = Date.now()
    localStorage.setItem(`stt_day_plan_${uKey}_${dateStr}`, JSON.stringify(existing))
  } catch {}

  // 2. Update Firestore document atomically with merge
  try {
    const userDoc = await getUserDoc(uKey)
    const existingDayPlan = userDoc?.dayPlanners?.[dateStr] || { date: dateStr }
    const updatedDayPlan = {
      ...existingDayPlan,
      targetHours: numHours,
      isRestDay: numHours === 0 ? true : (existingDayPlan.isRestDay && numHours > 0 ? false : existingDayPlan.isRestDay),
      updatedAt: Date.now(),
    }

    const existingWeeklyPlan = userDoc?.weeklyPlan || {}
    const existingDayWeekly = existingWeeklyPlan[dayKey] || {}
    const updatedWeeklyPlan = {
      ...existingWeeklyPlan,
      [dayKey]: {
        ...existingDayWeekly,
        targetMinutes,
      },
    }

    await setDoc(
      doc(db, 'users', uKey),
      {
        [`dayPlanners.${dateStr}`]: updatedDayPlan,
        weeklyPlan: updatedWeeklyPlan,
      },
      { merge: true }
    )
  } catch (err) {
    console.warn('Failed to sync target hours to Firestore:', err)
  }

  // 3. Dispatch broadcast event for 0ms reactivity on all views
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('study_plan_updated', {
        detail: { userName, dateStr, dayKey, targetHours: numHours, targetMinutes },
      })
    )
  }
}

export async function getDayPlanner(userName, dateStr) {
  if (!userName || !dateStr) return null
  const uKey = userName.toLowerCase()
  try {
    const cached = localStorage.getItem(`stt_day_plan_${uKey}_${dateStr}`)
    if (cached) return JSON.parse(cached)
  } catch {}
  try {
    const docData = await getUserDoc(uKey)
    if (docData?.dayPlanners?.[dateStr]) {
      localStorage.setItem(`stt_day_plan_${uKey}_${dateStr}`, JSON.stringify(docData.dayPlanners[dateStr]))
      return docData.dayPlanners[dateStr]
    }
  } catch {}
  return null
}

export async function getAllDayPlanners(userName) {
  if (!userName) return {}
  const uKey = userName.toLowerCase()
  try {
    const docData = await getUserDoc(uKey)
    return docData?.dayPlanners || {}
  } catch {
    return {}
  }
}

/**
 * Calculates a sequential Day Number (Day 1, Day 2, Day 3...)
 * based on user's first planned or studied date.
 */
export async function calculateDayNumber(userName, targetDateStr, existingSessions = null, existingUserDoc = null) {
  if (!userName || !targetDateStr) return 1
  try {
    const [sessions, userDoc] = await Promise.all([
      existingSessions ? Promise.resolve(existingSessions) : getUserSessions(userName),
      existingUserDoc ? Promise.resolve(existingUserDoc) : getUserDoc(userName),
    ])
    const allDates = new Set()
    if (sessions) {
      sessions.forEach((s) => s.date && allDates.add(s.date))
    }
    if (userDoc?.dayPlanners) {
      Object.keys(userDoc.dayPlanners).forEach((d) => allDates.add(d))
    }
    allDates.add(targetDateStr)
    const sorted = Array.from(allDates).sort()
    const idx = sorted.indexOf(targetDateStr)
    return idx >= 0 ? idx + 1 : 1
  } catch {
    return 1
  }
}

/**
 * Finalizes and locks the current day, and automatically rolls over
 * uncompleted tasks and goals into the next day's planner sheet.
 */
export async function finalizeAndRolloverDay(userName, currentDateStr, nextDateStr, currentPlanData) {
  if (!userName || !currentDateStr || !nextDateStr) return

  // 1. Lock and finalize current day
  const finalizedCurrent = {
    ...currentPlanData,
    isLocked: true,
    finalizedAt: Date.now(),
  }
  await saveDayPlanner(userName, currentDateStr, finalizedCurrent)

  // 2. Check if nextDate is a Rest Day; if so, push study rollover to Monday!
  const settings = await getUserSettings(userName)
  let targetDate = nextDateStr
  if (isRestDay(targetDate, settings)) {
    targetDate = addDaysToDateStr(targetDate, 1)
  }

  // 3. Extract uncompleted tasks & goals from current day
  const isCurRest = isRestDay(currentDateStr, settings)
  const uncompletedRows = isCurRest ? [] : (currentPlanData.rows || []).filter(
    (r) => !r.done && (r.topic || r.plan || (r.subject && r.subject !== 'New Subject'))
  )

  const uncompletedGoals = isCurRest ? [] : (currentPlanData.goals || []).filter(
    (g) => g && g.trim().length > 0
  )

  // 4. Load or initialize next active study day's planner
  const existingNextPlan = await getDayPlanner(userName, targetDate)

  // Create rollover rows with clear backlog marking
  const rolloverRows = uncompletedRows.map((r, i) => ({
    id: `rollover_${Date.now()}_${i}`,
    time: r.time || '',
    subject: r.subject || 'Backlog',
    topic: r.topic || '',
    plan: r.plan || '',
    done: false,
    isRollover: true,
    rolloverFromDate: currentDateStr,
    rolloverFromDay: currentPlanData.dayNumber || 1,
  }))

  const existingNextRows = existingNextPlan?.rows || []
  // Combine: put rollover items at the top of the next day's schedule!
  const combinedRows = [
    ...rolloverRows,
    ...existingNextRows.filter(
      (r) => !rolloverRows.some((rr) => rr.topic === r.topic && rr.subject === r.subject)
    ),
  ]

  // Prepare next goals (if next day has empty goals, fill with rolled-over goals)
  const nextGoals = existingNextPlan?.goals ? [...existingNextPlan.goals] : ['', '', '']
  let gIdx = 0
  for (const ug of uncompletedGoals) {
    while (gIdx < 3 && nextGoals[gIdx] && nextGoals[gIdx].trim().length > 0) {
      gIdx++
    }
    if (gIdx < 3) {
      nextGoals[gIdx] = `[From Day ${currentPlanData.dayNumber || 1}] ${ug}`
      gIdx++
    }
  }

  // If nextDateStr is Sunday Rest Day, pre-fill Sunday as completed rest day
  if (targetDate !== nextDateStr) {
    const sunDayNum = (currentPlanData.dayNumber || 1) + 1
    await saveDayPlanner(userName, nextDateStr, {
      date: nextDateStr,
      dayNumber: sunDayNum,
      targetHours: 0,
      isRestDay: true,
      restType: 'rest',
      isLocked: true,
      goals: ['🛋️ Full Rest & Recovery 🔋', '☕ Self-Care & Relaxation', '🌟 Mindset Recharge for Next Week'],
      rows: [],
      notes: 'Sunday Rest & Buffer Day — Streak Shield Active 🛡️',
      progressRating: 'excellent',
      updatedAt: Date.now(),
    })
  }

  const nextDayNumber = targetDate !== nextDateStr
    ? (currentPlanData.dayNumber || 1) + 2
    : (currentPlanData.dayNumber || 1) + 1

  const nextPlanData = {
    ...(existingNextPlan || {}),
    date: targetDate,
    dayNumber: nextDayNumber,
    targetHours: existingNextPlan?.targetHours || currentPlanData.targetHours || 6,
    goals: nextGoals,
    rows:
      combinedRows.length > 0
        ? combinedRows
        : (currentPlanData.rows || []).map((r) => ({
            ...r,
            id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            done: false,
          })),
    notes: existingNextPlan?.notes || '',
    progressRating: existingNextPlan?.progressRating || 'good',
    isLocked: false,
    updatedAt: Date.now(),
  }

  await saveDayPlanner(userName, targetDate, nextPlanData)
  return { finalizedCurrent, nextPlanData }
}

// ─────────────────────────────────────────────
// PRIVACY & LIVE ACTIVITY VISIBILITY
// ─────────────────────────────────────────────

/**
 * Updates privacy settings for a user:
 * - visibility: 'public' | 'selected' | 'private'
 * - allowedUsers: array of string usernames permitted to view live timer & history
 */
export async function updatePrivacySettings(userName, { visibility = 'public', allowedUsers = [] }) {
  if (!userName) return null
  const uKey = userName.trim().toLowerCase()
  const cleanAllowed = Array.isArray(allowedUsers)
    ? Array.from(new Set(allowedUsers.map((u) => String(u).trim().toLowerCase()).filter(Boolean)))
    : []

  const privacyData = {
    visibility, // 'public' | 'selected' | 'private'
    allowedUsers: cleanAllowed,
    updatedAt: Date.now(),
  }

  // 1. Update user document
  try {
    invalidateUserCache(uKey)
    await setDoc(doc(db, 'users', uKey), { privacy: privacyData }, { merge: true })
  } catch (err) {
    console.error('Failed to update privacy in users collection:', err)
  }

  // 2. Sync to liveStatus for instantaneous check on watch page
  try {
    await setDoc(
      doc(db, 'liveStatus', uKey),
      {
        visibility: privacyData.visibility,
        allowedUsers: privacyData.allowedUsers,
      },
      { merge: true }
    )
  } catch (err) {
    console.warn('Failed to sync privacy to liveStatus:', err)
  }

  // 3. Update localStorage cache if any
  try {
    const cached = localStorage.getItem(`stt_user_doc_${uKey}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      parsed.privacy = privacyData
      localStorage.setItem(`stt_user_doc_${uKey}`, JSON.stringify(parsed))
    }
  } catch {}

  // 4. Dispatch event for instant UI reactivity
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('study_privacy_updated', {
        detail: { userName: uKey, privacy: privacyData },
      })
    )
  }

  return privacyData
}

/**
 * Evaluates whether viewerUserName is permitted to view targetUserDocOrLiveStatus
 * Returns { allowed: boolean, reason?: 'private' | 'selected' | 'notFound', isOwner?: boolean }
 */
export function checkUserPrivacyAccess(targetUserDocOrLiveStatus, viewerUserName) {
  if (!targetUserDocOrLiveStatus) {
    return { allowed: false, reason: 'notFound' }
  }

  const targetName = (
    targetUserDocOrLiveStatus.username ||
    targetUserDocOrLiveStatus.name ||
    ''
  ).toLowerCase()
  const viewer = (viewerUserName || '').trim().toLowerCase()

  // Owner always has access
  if (viewer && targetName && viewer === targetName) {
    return { allowed: true, isOwner: true }
  }

  const privacy = targetUserDocOrLiveStatus.privacy || {}
  const visibility = privacy.visibility || targetUserDocOrLiveStatus.visibility || 'public'
  const allowedUsers = privacy.allowedUsers || targetUserDocOrLiveStatus.allowedUsers || []
  const allowedSet = new Set(allowedUsers.map((u) => String(u).toLowerCase()))

  if (visibility === 'public') {
    return { allowed: true, visibility: 'public' }
  }

  if (visibility === 'private') {
    return { allowed: false, reason: 'private', visibility: 'private' }
  }

  if (visibility === 'selected') {
    if (viewer && allowedSet.has(viewer)) {
      return { allowed: true, visibility: 'selected', isPartner: true }
    }
    return {
      allowed: false,
      reason: 'selected',
      visibility: 'selected',
      needsLogin: !viewer,
    }
  }

  return { allowed: true, visibility: 'public' }
}

/**
 * Searches users by username or prefix in Firestore
 */
export async function searchUsers(searchTerm, limitCount = 6) {
  if (!searchTerm || searchTerm.trim().length < 2) return []
  const qTerm = searchTerm.trim().toLowerCase().replace(/^@/, '')
  const results = []
  const seenUsernames = new Set()

  // 1. Direct exact lookup
  try {
    const directDoc = await getUserDoc(qTerm)
    if (directDoc) {
      const uName = (directDoc.username || qTerm).toLowerCase()
      seenUsernames.add(uName)
      results.push({
        username: directDoc.username || qTerm,
        displayName: directDoc.displayName || directDoc.username || qTerm,
        photoUrl: directDoc.photoUrl || '',
        avatarColor: directDoc.avatarColor || '#7c3aed',
        privacy: directDoc.privacy || { visibility: 'public', allowedUsers: [] },
      })
    }
  } catch {}

  // 2. Prefix search on document IDs (__name__)
  try {
    const q = query(
      collection(db, 'users'),
      where('__name__', '>=', qTerm),
      where('__name__', '<=', qTerm + '\uf8ff'),
      limit(limitCount)
    )
    const snap = await getDocs(q)
    snap.forEach((d) => {
      const data = d.data()
      const uName = (data.username || d.id).toLowerCase()
      if (!seenUsernames.has(uName)) {
        seenUsernames.add(uName)
        results.push({
          username: data.username || d.id,
          displayName: data.displayName || data.username || d.id,
          photoUrl: data.photoUrl || '',
          avatarColor: data.avatarColor || '#7c3aed',
          privacy: data.privacy || { visibility: 'public', allowedUsers: [] },
        })
      }
    })
  } catch (err) {
    console.warn('searchUsers prefix query error:', err)
  }

  return results.slice(0, limitCount)
}

// ─────────────────────────────────────────────
// GOOGLE AUTHENTICATION & ONBOARDING
// ─────────────────────────────────────────────

/**
 * Generates an intelligent, clean, and guaranteed unique username based on Google name/email
 */
export async function generateSmartUniqueUsername(displayName, email) {
  const baseCandidates = []

  if (displayName) {
    // E.g. "Jeetesh Sharma" -> "jeetesh_sharma", "jeetesh"
    const cleaned = displayName.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (cleaned.length >= 4) baseCandidates.push(cleaned)
    const firstName = cleaned.split('_')[0]
    if (firstName && firstName.length >= 4) baseCandidates.push(firstName)
  }

  if (email) {
    const emailPrefix = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    if (emailPrefix.length >= 4 && !baseCandidates.includes(emailPrefix)) {
      baseCandidates.push(emailPrefix)
    }
  }

  baseCandidates.push(`scholar_${Math.floor(1000 + Math.random() * 9000)}`)

  for (const cand of baseCandidates) {
    try {
      const taken = await isUsernameTaken(cand)
      if (!taken) return cand
    } catch {}
  }

  // If initial candidates are taken, append sequential numbers
  const prime = baseCandidates[0] || 'student'
  for (let i = 1; i <= 50; i++) {
    const test = `${prime}${i}`
    try {
      const taken = await isUsernameTaken(test)
      if (!taken) return test
    } catch {}
  }

  return `${prime}_${Date.now().toString().slice(-4)}`
}

/**
 * Triggers Google Sign-In Popup:
 * - If user already has an account linked with this email or googleUid: returns { isNewUser: false, userDoc, username }
 * - If new user: returns { isNewUser: true, googleData: { email, displayName, photoUrl, googleUid, suggestedUsername } }
 */
export async function signInWithGoogleAuth() {
  const result = await signInWithPopup(auth, googleProvider)
  const gUser = result.user
  if (!gUser) throw new Error('Google Sign-In was cancelled or failed.')

  const email = (gUser.email || '').trim().toLowerCase()
  const displayName = gUser.displayName || ''
  const photoUrl = gUser.photoURL || ''
  const googleUid = gUser.uid

  // 1. Check if user already exists with this email
  let existingUser = null
  if (email) {
    try {
      const qEmail = query(collection(db, 'users'), where('email', '==', email), limit(1))
      const snap = await getDocs(qEmail)
      if (!snap.empty) {
        const docSnap = snap.docs[0]
        existingUser = { ...docSnap.data(), username: docSnap.id }
      }
    } catch (err) {
      console.warn('Error checking existing user by email:', err)
    }
  }

  // 2. Check if user already exists with this googleUid
  if (!existingUser && googleUid) {
    try {
      const qUid = query(collection(db, 'users'), where('googleUid', '==', googleUid), limit(1))
      const snap = await getDocs(qUid)
      if (!snap.empty) {
        const docSnap = snap.docs[0]
        existingUser = { ...docSnap.data(), username: docSnap.id }
      }
    } catch (err) {
      console.warn('Error checking existing user by googleUid:', err)
    }
  }

  // Existing user: direct login!
  if (existingUser) {
    // If user has no photoUrl, attach Google photoUrl
    if (!existingUser.photoUrl && photoUrl) {
      try {
        await updateDoc(doc(db, 'users', existingUser.username), { photoUrl, googleUid, email })
        existingUser.photoUrl = photoUrl
      } catch {}
    }
    return {
      isNewUser: false,
      userDoc: existingUser,
      username: existingUser.username,
    }
  }

  // New user: suggest smart username
  const suggestedUsername = await generateSmartUniqueUsername(displayName, email)

  return {
    isNewUser: true,
    googleData: {
      email,
      displayName,
      photoUrl,
      googleUid,
      suggestedUsername,
    },
  }
}

/**
 * Completes new user registration after Google Authentication:
 * Enforces username validation, uniqueness, and password protection
 */
export async function completeGoogleRegistration({
  username,
  password,
  displayName,
  email,
  googleUid,
  photoUrl,
}) {
  const lowerUsername = username.trim().toLowerCase()
  const userErr = validateUsername(lowerUsername)
  if (userErr) throw new Error(userErr)

  const taken = await isUsernameTaken(lowerUsername)
  if (taken) throw new Error(`@${lowerUsername} is already taken. Please choose another username.`)

  const passErr = validatePassword(password)
  if (passErr) throw new Error(passErr)

  const passwordHash = await hashPassword(password)

  const userData = {
    username: lowerUsername,
    displayName: displayName?.trim() || lowerUsername,
    email: email?.trim().toLowerCase() || '',
    googleUid: googleUid || '',
    photoUrl: photoUrl || '',
    passwordHash,
    avatarColor: '#7c3aed',
    authProvider: 'google',
    createdAt: serverTimestamp(),
    weeklyPlan: {},
    privacy: { visibility: 'public', allowedUsers: [] },
  }

  await setDoc(doc(db, 'users', lowerUsername), userData)
  return { ok: true, userDoc: userData, username: lowerUsername }
}




