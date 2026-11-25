/**
 * AccountVerificationModal.jsx
 * Compulsory Verification Modal for existing legacy accounts (like maahi_07)
 * Ensures every active user has:
 * 1. A verified Google Account (Real authentic Gmail address)
 * 2. Accurate State & City (so Admin knows real location instead of faulty cellular IP)
 * 3. Target Competitive Exam
 */

import React, { useState, useEffect } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore'
import { auth, googleProvider, db } from '../firebase'
import { getUserDoc, linkGoogleToExistingUser } from '../utils/firestoreHelpers'
import { getSession, updateCurrentSession } from '../utils/auth'
import { INDIAN_STATES, TARGET_EXAMS } from '../utils/geoConstants'
import { checkIsAdmin } from '../utils/doubtHelpers'

export default function AccountVerificationModal() {
  const session = getSession()
  const userName = session?.username || ''

  const [isOpen, setIsOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const [showAlertBanner, setShowAlertBanner] = useState(false)
  const [alertData, setAlertData] = useState(null)

  // Verification step state
  const [googleUser, setGoogleUser] = useState(null) // { email, displayName, uid, photoUrl }
  const [selectedState, setSelectedState] = useState(INDIAN_STATES[5]) // Default Delhi (NCR)
  const [city, setCity] = useState('')
  const [targetExam, setTargetExam] = useState(TARGET_EXAMS[0])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // 1. Listen for real-time Admin alerts sent to this user
  useEffect(() => {
    if (!userName) return
    const cleanUser = userName.trim().toLowerCase()
    const qAlerts = query(
      collection(db, 'userAlerts'),
      where('targetUsername', '==', cleanUser),
      limit(5)
    )

    const unsubscribe = onSnapshot(qAlerts, (snap) => {
      if (!snap.empty) {
        const latestDoc = snap.docs[0].data()
        setAlertData(latestDoc)
        setIsOpen(true)
        setShowAlertBanner(true)

        // Haptic feedback / vibrate on device
        try {
          navigator.vibrate?.([200, 100, 200, 100, 200])
        } catch {}

        // Browser push notification if permitted
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          navigator.serviceWorker?.ready.then((reg) => {
            reg?.showNotification('🔒 JeetPrep Action Required', {
              body: latestDoc.message || `Hello @${userName}! Please verify your Google Account & State.`,
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              vibrate: [200, 100, 200],
              tag: 'admin-alert',
            })
          }).catch(() => {})
        }
      }
    })

    return () => unsubscribe()
  }, [userName])

  // 2. Initial user verification check
  useEffect(() => {
    if (!userName) {
      setIsOpen(false)
      setChecking(false)
      return
    }

    let isMounted = true

    getUserDoc(userName)
      .then((doc) => {
        if (!isMounted) return
        if (!doc) {
          setIsOpen(false)
          return
        }

        // If user has NO email or NO googleUid, require verification!
        const needsVerification = !doc.email || (!doc.googleUid && !doc.isVerified)
        if (needsVerification) {
          setIsOpen(true)
          setShowAlertBanner(true)
          if (doc.state) setSelectedState(doc.state)
          if (doc.city) setCity(doc.city)
          if (doc.targetExam) setTargetExam(doc.targetExam)

          // Gentle device vibration alert
          try {
            navigator.vibrate?.([150, 80, 150])
          } catch {}
        } else {
          setIsOpen(false)
          setShowAlertBanner(false)
          updateCurrentSession({
            email: doc.email || '',
            state: doc.state || '',
            city: doc.city || '',
            targetExam: doc.targetExam || '',
            isVerified: true,
          })
        }
      })
      .catch((err) => {
        console.warn('Error checking user verification status:', err)
      })
      .finally(() => {
        if (isMounted) setChecking(false)
      })

    return () => {
      isMounted = false
    }
  }, [userName])

  // Step 1: 1-Click Google Verification
  const handleGoogleVerify = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      if (!user) throw new Error('Google Sign-in failed.')

      const email = (user.email || '').trim().toLowerCase()
      if (!email) throw new Error('No email found in Google account.')

      setGoogleUser({
        email,
        displayName: user.displayName || userName,
        uid: user.uid,
        photoUrl: user.photoURL || '',
      })
    } catch (err) {
      console.error('Google verification error:', err)
      if (err?.code === 'auth/popup-closed-by-user') {
        // User closed popup
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError(`Please authorize domain "${window.location.hostname}" in Firebase Console.`)
      } else {
        setError(err?.message || 'Google verification failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Final Submit
  const handleCompleteVerification = async (e) => {
    e?.preventDefault()
    if (!googleUser?.email) {
      setError('Please click the Google button above to verify your account first.')
      return
    }
    if (!city.trim()) {
      setError('Please enter your City / District.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await linkGoogleToExistingUser({
        username: userName,
        email: googleUser.email,
        googleUid: googleUser.uid,
        displayName: googleUser.displayName,
        photoUrl: googleUser.photoUrl,
        state: selectedState,
        city: city.trim(),
        targetExam,
      })

      // Update active session
      updateCurrentSession({
        email: googleUser.email,
        state: selectedState,
        city: city.trim(),
        targetExam,
        isVerified: true,
        photoUrl: googleUser.photoUrl,
      })

      setSuccess(true)
      setTimeout(() => {
        setIsOpen(false)
      }, 1500)
    } catch (err) {
      console.error('Verification save error:', err)
      setError(err?.message || 'Failed to save verification. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Logout option if user wants to switch accounts
  const handleLogout = () => {
    localStorage.removeItem('stt_session_v2')
    localStorage.removeItem('studyTrackerUser')
    window.location.href = '/signin'
  }

  if (checking) return null

  return (
    <>
      {/* ── Top Floating Notification Banner (Visible on all pages) ── */}
      {showAlertBanner && !isOpen && (
        <div className="fixed top-3 inset-x-3 max-w-lg mx-auto z-[9990] p-3.5 rounded-2xl bg-[#1c142e]/95 border-2 border-amber-500/70 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 text-white animate-bounce">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl animate-pulse flex-shrink-0">🔔</span>
            <div className="min-w-0">
              <span className="text-xs font-black text-amber-300 block truncate">
                {alertData?.title || 'Account Verification Required'}
              </span>
              <span className="text-[11px] text-gray-200 block truncate">
                {alertData?.message || 'Link Google Account & State to continue Mock Tests'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md flex-shrink-0 cursor-pointer transition-transform active:scale-95"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* ── Main Modal ── */}
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div
            className="w-full max-w-md p-6 sm:p-7 rounded-3xl bg-[#121218] border border-amber-500/40 shadow-2xl flex flex-col gap-5 relative text-white font-sans"
            style={{ animation: 'scaleIn 200ms ease-out' }}
          >
            {/* Glow Header */}
            <div className="flex items-center justify-between border-b border-[#252535] pb-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-amber-500/10">
                  🔒
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>{alertData?.title || 'Account Verification'}</span>
                  </h3>
                  <p className="text-xs text-amber-300 font-medium truncate">
                    Action needed for <span className="text-white font-bold font-mono">@{userName}</span>
                  </p>
                </div>
              </div>

              {/* Close Button — users and admin can close if needed */}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-[#1e1e2c] hover:bg-[#2c2c3e] text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shadow-sm active:scale-90 flex-shrink-0 ml-2"
                title="Close for now"
              >
                ✕
              </button>
            </div>

            {success ? (
              <div className="p-6 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-center flex flex-col items-center gap-2 animate-scaleIn">
                <span className="text-3xl">🎉</span>
                <h4 className="text-sm font-bold text-emerald-300">Account Successfully Verified!</h4>
                <p className="text-xs text-gray-300">
                  Welcome back, @{userName}. Unlocking Mock Tests & Tracker...
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-300 leading-relaxed bg-[#191924] border border-[#2b2b3d] p-3.5 rounded-2xl">
                  👋 <strong>Dear @{userName}</strong>, {alertData?.message || 'JeetPrep par Mock Tests dene aur account security ke liye apne Verified Google Account aur Location ko link karein.'}
                </p>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCompleteVerification} className="flex flex-col gap-4">
              {/* Step 1: Google Button */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                  <span>Step 1: Link Google Account</span>
                  {googleUser ? (
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="text-amber-400 font-bold text-[10px]">Mandatory *</span>
                  )}
                </label>

                {googleUser ? (
                  <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {googleUser.photoUrl ? (
                        <img src={googleUser.photoUrl} alt="" className="w-8 h-8 rounded-full border border-emerald-500/50" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold flex items-center justify-center text-xs">
                          G
                        </div>
                      )}
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">{googleUser.displayName}</span>
                        <span className="text-[11px] text-emerald-300 font-mono block truncate">{googleUser.email}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGoogleUser(null)}
                      className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleGoogleVerify}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-purple-500/40 bg-[#1a1a24] hover:bg-[#232332] text-white text-xs sm:text-sm font-bold transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>{loading ? 'Opening Google...' : 'Verify with Google (1-Click)'}</span>
                  </button>
                )}
              </div>

              {/* Step 2: Real State & City */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[#252535]">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-300">
                    State / UT <span className="text-amber-400">*</span>
                  </label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#181824] border border-[#2e2e42] text-white text-xs outline-none focus:border-purple-500 transition-colors cursor-pointer"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s} className="bg-[#181824] text-white">
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-300">
                    City / District <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setError('') }}
                    placeholder="e.g. Jaipur, Patna"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#181824] border border-[#2e2e42] text-white text-xs outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
              </div>

              {/* Target Exam */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-300">
                  Target Competitive Exam <span className="text-amber-400">*</span>
                </label>
                <select
                  value={targetExam}
                  onChange={(e) => setTargetExam(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#181824] border border-[#2e2e42] text-white text-xs outline-none focus:border-purple-500 transition-colors cursor-pointer"
                >
                  {TARGET_EXAMS.map((ex) => (
                    <option key={ex} value={ex} className="bg-[#181824] text-white">
                      {ex}
                    </option>
                  ))}
                </select>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !googleUser || !city.trim()}
                className="w-full py-3 rounded-xl font-black text-xs sm:text-sm transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
                style={{
                  background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                  color: 'white',
                }}
              >
                <span>{loading ? 'Saving Verification...' : 'Save & Unlock App ➔'}</span>
              </button>
            </form>

            <div className="pt-2 flex items-center justify-between border-t border-[#252535]">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[11px] text-gray-400 hover:text-gray-200 underline cursor-pointer"
              >
                Remind me later (Baad me karein)
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[11px] text-gray-500 hover:text-gray-300 underline cursor-pointer"
              >
                Sign out / Switch account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )}
</>
  )
}
