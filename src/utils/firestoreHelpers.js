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

export async function updateLiveStatus(userName, { isRunning, baseElapsed, startTimestamp }) {
  if (!userName) return
  const statusRef = doc(db, 'liveStatus', userName.toLowerCase())
  const now = Date.now()
  await setDoc(statusRef, {
    userName: userName.toLowerCase(),
    isRunning: Boolean(isRunning),
    baseElapsed: Number(baseElapsed) || 0,
    startedAtMs: isRunning && startTimestamp ? Number(startTimestamp) : null,
    updatedAtMs: now,
    // Keep serverTimestamp for backward compatibility
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
  const sessionData = {
    userName: userName.toLowerCase(),
    date,
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

  const ref2 = await addDoc(collection(db, 'sessions'), sessionData)
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

export function getTargetForDate(dateStr, weeklyPlan, dayPlanners = null) {
  if (!dateStr) return null

  // 1. Priority: check if specific Day Planner sheet has targetHours for this date
  if (dayPlanners && dayPlanners[dateStr] && typeof dayPlanners[dateStr].targetHours === 'number' && dayPlanners[dateStr].targetHours > 0) {
    return {
      targetMinutes: Math.round(dayPlanners[dateStr].targetHours * 60),
      subjects: dayPlanners[dateStr].goals?.[0] || '',
      source: 'dayPlanner',
    }
  }

  // 2. Fallback to weeklyPlan template
  if (!weeklyPlan) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const wp = weeklyPlan[days[date.getDay()]]
  return wp ? { ...wp, source: 'weeklyPlan' } : null
}

// ─────────────────────────────────────────────
// SYLLABUS & TOPICS
// ─────────────────────────────────────────────

export async function saveSyllabus(userName, syllabus) {
  if (!userName) return
  const uKey = userName.toLowerCase()
  try {
    localStorage.setItem(`stt_syllabus_${uKey}`, JSON.stringify(syllabus))
  } catch {}
  try {
    await updateDoc(doc(db, 'users', uKey), { syllabus })
  } catch (err) {
    console.warn('Failed to save syllabus to Firestore:', err)
  }
}

export async function getSyllabus(userName) {
  if (!userName) return []
  const uKey = userName.toLowerCase()
  try {
    const cached = localStorage.getItem(`stt_syllabus_${uKey}`)
    if (cached) return JSON.parse(cached)
  } catch {}
  try {
    const docData = await getUserDoc(uKey)
    if (docData?.syllabus) {
      localStorage.setItem(`stt_syllabus_${uKey}`, JSON.stringify(docData.syllabus))
      return docData.syllabus
    }
  } catch {}
  return []
}

// ─────────────────────────────────────────────
// EXAM COUNTDOWN & TARGET
// ─────────────────────────────────────────────

export async function saveExamGoal(userName, examGoal) {
  if (!userName) return
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
export async function calculateDayNumber(userName, targetDateStr) {
  if (!userName || !targetDateStr) return 1
  try {
    const [sessions, userDoc] = await Promise.all([
      getUserSessions(userName),
      getUserDoc(userName),
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

  // 2. Extract uncompleted tasks & goals from current day
  const uncompletedRows = (currentPlanData.rows || []).filter(
    (r) => !r.done && (r.topic || r.plan || (r.subject && r.subject !== 'New Subject'))
  )

  const uncompletedGoals = (currentPlanData.goals || []).filter(
    (g) => g && g.trim().length > 0
  )

  // 3. Load or initialize next day's planner
  const existingNextPlan = await getDayPlanner(userName, nextDateStr)

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

  const nextDayNumber = (currentPlanData.dayNumber || 1) + 1

  const nextPlanData = {
    ...(existingNextPlan || {}),
    date: nextDateStr,
    dayNumber: nextDayNumber,
    targetHours: existingNextPlan?.targetHours || currentPlanData.targetHours || 6,
    goals: nextGoals,
    rows:
      combinedRows.length > 0
        ? combinedRows
        : currentPlanData.rows.map((r) => ({
            ...r,
            id: `row_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            done: false,
          })),
    notes: existingNextPlan?.notes || '',
    progressRating: existingNextPlan?.progressRating || 'good',
    isLocked: false,
    updatedAt: Date.now(),
  }

  await saveDayPlanner(userName, nextDateStr, nextPlanData)
  return { finalizedCurrent, nextPlanData }
}


