/**
 * mockTestFirestore.js
 * Firestore persistence and scoring helper for CBT Mock Test attempts.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { todayString } from './formatTime.js'
const LOCAL_STORAGE_MOCK_PREFIX = 'stt_mock_attempts_'

/**
 * Calculate complete test scorecard, accuracy, percentile and rank
 */
export function calculateScorecard(test, userAnswers, timeSpentPerQuestion = {}) {
  const marksPerCorrect = Number(test.marksPerCorrect) || 1
  const negativeMarks = Number(test.negativeMarks) || 0
  const totalQuestions = test.questions?.length || 0

  let attemptedCount = 0
  let correctCount = 0
  let incorrectCount = 0
  let unattemptedCount = 0
  let totalScore = 0

  // Per section accumulators
  const sectionStats = {}
  test.sections?.forEach((sec) => {
    sectionStats[sec.id] = {
      sectionId: sec.id,
      sectionName: sec.name,
      totalQuestions: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      score: 0,
      maxScore: 0,
      timeSpentSeconds: 0,
      timeLimitMinutes: sec.timeLimitMinutes || test.durationMinutes || 25,
    }
  })

  // Evaluate each question
  const evaluatedQuestions = (test.questions || []).map((q, idx) => {
    const selected = userAnswers[q.id] !== undefined ? userAnswers[q.id] : null
    const timeSpent = timeSpentPerQuestion[q.id] || 0
    const secId = q.sectionId || test.sections?.[0]?.id || 'sec_1'

    if (!sectionStats[secId]) {
      sectionStats[secId] = {
        sectionId: secId,
        sectionName: 'General',
        totalQuestions: 0,
        attempted: 0,
        correct: 0,
        incorrect: 0,
        score: 0,
        maxScore: 0,
        timeSpentSeconds: 0,
        timeLimitMinutes: test.durationMinutes || 25,
      }
    }

    const sec = sectionStats[secId]
    sec.totalQuestions += 1
    sec.maxScore += marksPerCorrect
    sec.timeSpentSeconds += timeSpent

    let isCorrect = false
    let isAttempted = selected !== null && selected !== undefined

    if (isAttempted) {
      attemptedCount += 1
      sec.attempted += 1
      if (selected === q.correctOption) {
        isCorrect = true
        correctCount += 1
        sec.correct += 1
        sec.score += marksPerCorrect
        totalScore += marksPerCorrect
      } else {
        incorrectCount += 1
        sec.incorrect += 1
        sec.score -= negativeMarks
        totalScore -= negativeMarks
      }
    } else {
      unattemptedCount += 1
    }

    return {
      ...q,
      questionIndex: idx + 1,
      userSelected: selected,
      isAttempted,
      isCorrect,
      timeSpentSeconds: timeSpent,
    }
  })

  // Overall calculations
  const maxMarks = totalQuestions * marksPerCorrect
  const accuracy = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0
  const totalTimeTakenSeconds = Object.values(timeSpentPerQuestion).reduce((a, b) => a + b, 0)

  // Construct Sectional Summary rows
  const sectionalSummary = Object.values(sectionStats).map((sec) => {
    const secAccuracy = sec.attempted > 0 ? (sec.correct / sec.attempted) * 100 : 0
    return {
      ...sec,
      score: Math.max(0, Number(sec.score.toFixed(2))),
      accuracy: Number(secAccuracy.toFixed(2)),
    }
  })

  // Simulated realistic percentile & cohort rank
  // Higher accuracy & score yields higher percentile (60% - 99%)
  const rawRatio = maxMarks > 0 ? Math.max(0, totalScore / maxMarks) : 0
  const simulatedCohortSize = Math.floor(450 + Math.random() * 250) // e.g. 603 students
  const percentile = Math.min(99.4, Math.max(25, Number((rawRatio * 75 + accuracy * 0.25).toFixed(2))))
  const rank = Math.max(1, Math.floor(simulatedCohortSize * (1 - percentile / 100)) + 1)

  return {
    testId: test.id,
    testTitle: test.title,
    examName: test.examName,
    category: test.category || '',
    totalQuestions,
    attemptedCount,
    correctCount,
    incorrectCount,
    unattemptedCount,
    score: Number(totalScore.toFixed(2)),
    maxMarks,
    accuracy: Number(accuracy.toFixed(2)),
    percentile,
    rank,
    totalStudents: simulatedCohortSize,
    timeTakenSeconds: totalTimeTakenSeconds,
    totalDurationMinutes: test.durationMinutes || 25,
    sectionalSummary,
    questions: evaluatedQuestions,
    date: todayString(),
  }
}

/**
 * Save completed mock attempt to Firestore & localStorage
 */
export async function saveMockAttempt(userName, attemptData) {
  const attemptId = `mock_att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const cleanUser = (userName || 'guest').toLowerCase()

  const payload = {
    ...attemptData,
    id: attemptId,
    userName: cleanUser,
    createdAt: serverTimestamp(),
    timestampMs: Date.now(),
  }

  // 1. Save locally in localStorage for instant offline access
  try {
    const key = `${LOCAL_STORAGE_MOCK_PREFIX}${cleanUser}`
    const existing = JSON.parse(localStorage.getItem(key) || '[]')
    existing.unshift({ ...payload, createdAt: { seconds: Math.floor(Date.now() / 1000) } })
    localStorage.setItem(key, JSON.stringify(existing.slice(0, 30)))
  } catch (e) {
    console.warn('Could not save mock attempt to localStorage:', e)
  }

  // 2. Persist to Firestore
  try {
    if (userName && userName !== 'guest') {
      const docRef = doc(db, 'mock_attempts', attemptId)
      await setDoc(docRef, payload)
    }
  } catch (err) {
    console.warn('Could not save mock attempt to Firestore:', err)
  }

  return attemptId
}

/**
 * Fetch all past mock attempts for a user
 */
export async function getUserMockAttempts(userName) {
  const cleanUser = (userName || 'guest').toLowerCase()
  const key = `${LOCAL_STORAGE_MOCK_PREFIX}${cleanUser}`

  // 1. Read local storage first
  let localAttempts = []
  try {
    const raw = localStorage.getItem(key)
    if (raw) localAttempts = JSON.parse(raw)
  } catch {}

  // 2. If logged in, fetch from Firestore and merge
  if (userName && userName !== 'guest') {
    try {
      const q = query(
        collection(db, 'mock_attempts'),
        where('userName', '==', cleanUser)
      )
      const snap = await getDocs(q)
      const remoteAttempts = []
      snap.forEach((d) => remoteAttempts.push({ id: d.id, ...d.data() }))

      if (remoteAttempts.length > 0) {
        remoteAttempts.sort((a, b) => (b.timestampMs || 0) - (a.timestampMs || 0))
        try {
          localStorage.setItem(key, JSON.stringify(remoteAttempts.slice(0, 30)))
        } catch {}
        return remoteAttempts
      }
    } catch (e) {
      console.warn('Firestore mock attempts fetch failed, falling back to local:', e)
    }
  }

  return localAttempts
}

/**
 * Get a single mock attempt by ID
 */
export async function getMockAttemptById(attemptId, userName) {
  const cleanUser = (userName || 'guest').toLowerCase()
  const key = `${LOCAL_STORAGE_MOCK_PREFIX}${cleanUser}`

  // Check local first
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const list = JSON.parse(raw)
      const match = list.find((a) => a.id === attemptId)
      if (match) return match
    }
  } catch {}

  // Check Firestore
  try {
    const snap = await getDoc(doc(db, 'mock_attempts', attemptId))
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() }
    }
  } catch {}

  return null
}
