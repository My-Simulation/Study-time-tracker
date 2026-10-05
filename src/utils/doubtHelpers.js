/**
 * doubtHelpers.js
 * Firestore helpers & business logic for the Mentor Doubt Solver system.
 * Rules:
 * - 1st question is 100% FREE for every student.
 * - From 2nd question onwards, uses paid doubt tokens (e.g. ₹9/doubt or ₹39 for 5 doubts).
 * - Admin (bandar, jeeteshsharma, etc.) can view incoming queue and reply with handwritten photo + text solution.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase.js'
import { getUserDoc } from './firestoreHelpers.js'

export const ADMIN_USERNAMES = ['bandar', 'jeeteshsharma']

/**
 * Check if the given username is an authorized admin/mentor.
 */
export function checkIsAdmin(username = '') {
  if (!username) return false
  const lower = username.toLowerCase().trim()
  return ADMIN_USERNAMES.includes(lower)
}

/**
 * Get user's doubt entitlement status:
 * - freeDoubtAvailable: boolean (true if user has never used their 1 free question)
 * - paidDoubtsBalance: number
 * - canAskDoubt: boolean
 */
export async function getUserDoubtBalance(username = '') {
  if (!username) {
    return { freeDoubtAvailable: false, paidDoubtsBalance: 0, canAskDoubt: false }
  }
  const user = await getUserDoc(username.toLowerCase(), true)
  const freeDoubtUsed = Boolean(user?.freeDoubtUsed)
  const paidDoubtsBalance = Number(user?.paidDoubtsBalance) || 0
  const freeDoubtAvailable = !freeDoubtUsed
  const canAskDoubt = freeDoubtAvailable || paidDoubtsBalance > 0

  return {
    freeDoubtAvailable,
    freeDoubtUsed,
    paidDoubtsBalance,
    canAskDoubt,
  }
}

/**
 * Credit paid doubts to user's account after purchase/activation.
 */
export async function addPaidDoubts(username, count = 1) {
  const lower = username.toLowerCase().trim()
  const userRef = doc(db, 'users', lower)
  const snap = await getDoc(userRef)
  const current = snap.exists() ? (Number(snap.data()?.paidDoubtsBalance) || 0) : 0
  const newBalance = current + count

  await updateDoc(userRef, {
    paidDoubtsBalance: newBalance,
    lastPaymentAt: new Date().toISOString(),
  })
  return newBalance
}

/**
 * Submit a new doubt to Mentor/Admin.
 * Automatically deducts 1 free doubt or 1 paid token.
 */
export async function submitDoubt({
  userName,
  displayName,
  subject,
  questionText,
  imageUrl = '',
}) {
  const lower = userName.toLowerCase().trim()
  const userRef = doc(db, 'users', lower)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.exists() ? userSnap.data() : {}

  const freeDoubtUsed = Boolean(userData.freeDoubtUsed)
  const paidBalance = Number(userData.paidDoubtsBalance) || 0

  let isFreeUsedThisTime = false
  if (!freeDoubtUsed) {
    // Consume free doubt
    await updateDoc(userRef, { freeDoubtUsed: true })
    isFreeUsedThisTime = true
  } else if (paidBalance > 0) {
    // Deduct 1 paid doubt
    await updateDoc(userRef, { paidDoubtsBalance: Math.max(0, paidBalance - 1) })
  } else {
    throw new Error('No free or paid doubt tokens available. Please top up to ask.')
  }

  const doubtPayload = {
    userName: lower,
    displayName: displayName || userName,
    subject: subject || 'General',
    questionText: questionText.trim(),
    imageUrl: imageUrl || '',
    status: 'pending', // 'pending' | 'solved'
    isFreeDoubt: isFreeUsedThisTime,
    createdAt: new Date().toISOString(),
    createdAtTimestamp: serverTimestamp(),
    solutionText: '',
    solutionImageUrl: '',
    solvedAt: null,
    solvedBy: null,
  }

  const docRef = await addDoc(collection(db, 'doubts'), doubtPayload)
  return { id: docRef.id, ...doubtPayload }
}

/**
 * Real-time listener for a student's own doubts.
 */
export function subscribeToStudentDoubts(username, callback) {
  if (!username) return () => {}
  const lower = username.toLowerCase().trim()
  const q = query(
    collection(db, 'doubts'),
    where('userName', '==', lower)
  )

  return onSnapshot(q, (snapshot) => {
    const doubts = []
    snapshot.forEach((doc) => {
      doubts.push({ id: doc.id, ...doc.data() })
    })
    // Sort client-side by date descending
    doubts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    callback(doubts)
  })
}

/**
 * Real-time listener for Admin to see all incoming doubts.
 */
export function subscribeToAllDoubtsForAdmin(callback) {
  const q = collection(db, 'doubts')
  return onSnapshot(q, (snapshot) => {
    const doubts = []
    snapshot.forEach((doc) => {
      doubts.push({ id: doc.id, ...doc.data() })
    })
    // Sort client-side by date descending
    doubts.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    callback(doubts)
  })
}

/**
 * Admin solves a doubt by providing solution text and/or handwritten solution photo.
 */
export async function solveDoubtByAdmin({
  doubtId,
  adminUsername,
  solutionText = '',
  solutionImageUrl = '',
}) {
  if (!doubtId) throw new Error('Missing doubt ID')
  const doubtRef = doc(db, 'doubts', doubtId)

  await updateDoc(doubtRef, {
    status: 'solved',
    solutionText: solutionText.trim(),
    solutionImageUrl: solutionImageUrl || '',
    solvedAt: new Date().toISOString(),
    solvedBy: adminUsername || 'Admin',
  })

  return { success: true }
}

/**
 * Helper to compress and convert any file/image to lightweight base64 DataURL
 */
export function compressImageFile(file, maxWidth = 900, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file provided'))
    if (!file.type.startsWith('image/')) {
      return reject(new Error('File must be an image'))
    }

    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = (e) => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        const compressed = canvas.toDataURL('image/jpeg', quality)
        resolve(compressed)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
