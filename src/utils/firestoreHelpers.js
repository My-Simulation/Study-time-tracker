/**
 * firestoreHelpers.js
 * Firestore & Storage helper functions for Study Time Tracker.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../firebase'

// ─────────────────────────────────────────────
// USER HELPERS
// ─────────────────────────────────────────────

/**
 * Creates a user document in Firestore if it doesn't already exist.
 * @param {string} name - User's name (used as document ID)
 */
export async function ensureUserExists(name) {
  const userRef = doc(db, 'users', name)
  const snap = await getDoc(userRef)
  if (!snap.exists()) {
    await setDoc(userRef, {
      name,
      createdAt: serverTimestamp(),
    })
  }
}

// ─────────────────────────────────────────────
// SESSION HELPERS
// ─────────────────────────────────────────────

/**
 * Captures a DOM element as PNG using html2canvas,
 * uploads to Firebase Storage, and returns the download URL.
 *
 * @param {HTMLElement} element - The DOM element to capture
 * @param {string} userName - User's name (for storage path)
 * @param {string} dateStr - "YYYY-MM-DD" date string
 * @returns {Promise<string>} Download URL of the uploaded screenshot
 */
export async function captureAndUploadScreenshot(element, userName, dateStr) {
  // Dynamically import html2canvas to avoid SSR issues
  const html2canvas = (await import('html2canvas')).default

  const canvas = await html2canvas(element, {
    backgroundColor: '#1a1a1a',
    scale: 2, // 2x for retina quality
    logging: false,
    useCORS: true,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Failed to convert canvas to blob'))
        return
      }
      try {
        const filename = `${dateStr}_${Date.now()}.png`
        const storageRef = ref(storage, `screenshots/${userName}/${filename}`)
        await uploadBytes(storageRef, blob, { contentType: 'image/png' })
        const url = await getDownloadURL(storageRef)
        resolve(url)
      } catch (err) {
        reject(err)
      }
    }, 'image/png')
  })
}

/**
 * Saves a study session to Firestore.
 *
 * @param {object} params
 * @param {string} params.userName
 * @param {string} params.date - "YYYY-MM-DD"
 * @param {string} params.totalTime - "H:MM:SS.CC"
 * @param {number} params.totalSeconds
 * @param {Array}  params.laps - [{lapNo, split, total}]
 * @param {string} params.screenshotUrl
 * @returns {Promise<string>} The new document ID
 */
export async function saveSession({
  userName,
  date,
  totalTime,
  totalSeconds,
  laps,
  screenshotUrl,
}) {
  const docRef = await addDoc(collection(db, 'sessions'), {
    userName,
    date,
    totalTime,
    totalSeconds,
    laps,
    screenshotUrl,
    createdAt: serverTimestamp(),
  })
  return docRef.id
}

/**
 * Fetches all sessions for a given user, ordered by date descending.
 * @param {string} userName
 * @returns {Promise<Array>} Array of session objects with id field
 */
export async function getUserSessions(userName) {
  const q = query(
    collection(db, 'sessions'),
    where('userName', '==', userName),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Fetches all sessions for a given user on a specific date.
 * @param {string} userName
 * @param {string} dateStr - "YYYY-MM-DD"
 * @returns {Promise<Array>} Array of session objects ordered by createdAt ascending
 */
export async function getSessionsByDate(userName, dateStr) {
  const q = query(
    collection(db, 'sessions'),
    where('userName', '==', userName),
    where('date', '==', dateStr),
    orderBy('createdAt', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Groups sessions by date and computes per-date stats.
 * Returns array of { date, totalSeconds, sessions } sorted newest first.
 * @param {Array} sessions - Raw sessions from getUserSessions()
 * @returns {Array}
 */
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
