/**
 * GoogleOnboardingModal.jsx
 * Modal shown to first-time Google sign-in users to:
 * 1. Confirm or customize their suggested @username
 * 2. Set an account password for dual login (Google + Password protection)
 */

import React, { useState, useEffect } from 'react'
import {
  validateUsername,
  validatePassword,
  isUsernameTaken,
  completeGoogleRegistration,
  loginUser,
  linkGoogleToExistingUser,
} from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'
import { INDIAN_STATES, TARGET_EXAMS } from '../utils/geoConstants'
import { useNavigate } from 'react-router-dom'

export default function GoogleOnboardingModal({
  isOpen,
  onClose,
  googleData,
  onSuccess,
}) {
  const navigate = useNavigate()

  // Mode: 'new' (Create new account) or 'link' (Link existing username/password account)
  const [mode, setMode] = useState('new')

  // New account form state
  const [username, setUsername] = useState(googleData?.suggestedUsername || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedState, setSelectedState] = useState(INDIAN_STATES[5]) // Default Delhi (NCR)
  const [city, setCity] = useState('')
  const [targetExam, setTargetExam] = useState(TARGET_EXAMS[0])

  // Link existing account state
  const [linkUsername, setLinkUsername] = useState('')
  const [linkPassword, setLinkPassword] = useState('')
  const [showLinkPassword, setShowLinkPassword] = useState(false)

  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(true)
  const [usernameError, setUsernameError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (googleData?.suggestedUsername) {
      setUsername(googleData.suggestedUsername)
    }
  }, [googleData])

  // Debounced real-time username availability check (only in 'new' mode)
  useEffect(() => {
    if (!isOpen || !googleData || mode !== 'new') return
    const trimmed = username.trim().toLowerCase()
    const valErr = validateUsername(trimmed)
    if (valErr) {
      setUsernameError(valErr)
      setUsernameAvailable(false)
      setCheckingUsername(false)
      return
    }

    setUsernameError('')
    setCheckingUsername(true)
    let active = true

    const timer = setTimeout(async () => {
      try {
        const taken = await isUsernameTaken(trimmed)
        if (active) {
          if (taken) {
            setUsernameAvailable(false)
            setUsernameError(`@${trimmed} is already registered.`)
          } else {
            setUsernameAvailable(true)
            setUsernameError('')
          }
        }
      } catch (err) {
        console.warn(err)
      } finally {
        if (active) setCheckingUsername(false)
      }
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [username, mode, isOpen, googleData])

  // Handle New Registration
  const handleSubmitNew = async (e) => {
    e?.preventDefault()
    setError('')

    const cleanUser = username.trim().toLowerCase()
    const userErr = validateUsername(cleanUser)
    if (userErr) {
      setError(userErr)
      return
    }

    if (!usernameAvailable) {
      setError(`@${cleanUser} is already taken. If this is your account, switch to "Link Existing Account".`)
      return
    }

    if (!city.trim()) {
      setError('Please enter your City (e.g. Jaipur, Patna, Lucknow).')
      return
    }

    const passErr = validatePassword(password)
    if (passErr) {
      setError(passErr)
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const result = await completeGoogleRegistration({
        username: cleanUser,
        password,
        displayName: googleData.displayName || cleanUser,
        email: googleData.email,
        googleUid: googleData.googleUid,
        photoUrl: googleData.photoUrl,
        state: selectedState,
        city: city.trim(),
        targetExam,
      })

      // Save local session
      saveSession(cleanUser, result.userDoc)

      if (onSuccess) {
        onSuccess(cleanUser, result.userDoc)
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Google onboarding registration error:', err)
      setError(err?.message || 'Could not complete registration. Try again.')
    } finally {
      setLoading(false)
    }
  }

  // Handle Linking Old Account
  const handleLinkExisting = async (e) => {
    e?.preventDefault()
    setError('')

    const cleanUser = linkUsername.trim().toLowerCase()
    if (!cleanUser) {
      setError('Enter your existing Username.')
      return
    }
    if (!linkPassword) {
      setError('Enter your existing account Password.')
      return
    }

    setLoading(true)
    try {
      // 1. Verify username and password
      const loginRes = await loginUser(cleanUser, linkPassword)
      if (!loginRes.ok) {
        setError(loginRes.error || 'Incorrect username or password.')
        setLoading(false)
        return
      }

      // 2. Link Google Auth to this existing doc
      const existingDoc = loginRes.userDoc || {}
      await linkGoogleToExistingUser({
        username: cleanUser,
        email: googleData.email,
        googleUid: googleData.googleUid,
        displayName: googleData.displayName || existingDoc.realName,
        photoUrl: googleData.photoUrl || existingDoc.photoUrl,
        state: existingDoc.state || selectedState,
        city: existingDoc.city || city.trim(),
        targetExam: existingDoc.targetExam || targetExam,
      })

      const updatedUserDoc = {
        ...existingDoc,
        email: googleData.email,
        googleUid: googleData.googleUid,
        photoUrl: googleData.photoUrl || existingDoc.photoUrl,
        isVerified: true,
      }

      // 3. Save session and log in!
      saveSession(cleanUser, updatedUserDoc)

      if (onSuccess) {
        onSuccess(cleanUser, updatedUserDoc)
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Account link error:', err)
      setError(err?.message || 'Could not link account. Please check credentials.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !googleData) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="card w-full max-w-md p-6 flex flex-col gap-4 border border-purple-500/40 shadow-2xl relative max-h-[92vh] overflow-y-auto"
        style={{ background: '#121216', animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#252530] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500/50 flex items-center justify-center bg-purple-900 text-white font-bold text-lg flex-shrink-0 shadow-md">
              {googleData.photoUrl ? (
                <img src={googleData.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (googleData.displayName || 'G')[0].toUpperCase()
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <span>Welcome to JeetPrep! 🎉</span>
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Google: <span className="text-purple-300 font-semibold">{googleData.email}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg p-1 cursor-pointer"
            title="Cancel"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector Tabs: New Account vs Link Purana Account */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#181822] border border-[#2a2a3a]">
          <button
            type="button"
            onClick={() => { setMode('new'); setError('') }}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'new'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ✨ Naya Account
          </button>
          <button
            type="button"
            onClick={() => { setMode('link'); setError('') }}
            className={`py-2 px-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              mode === 'link'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🔗 Purana Account Link Karein
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* ── TAB 1: LINK EXISTING ACCOUNT ── */}
        {mode === 'link' ? (
          <form onSubmit={handleLinkExisting} className="flex flex-col gap-4">
            <div className="text-xs text-amber-300/90 leading-relaxed bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              💡 <strong>Purana Account Safe Hai!</strong> Apna purana <strong>Username</strong> aur <strong>Password</strong> dalein. Aapka sara purana timer aur mock test data is Google account se jud jayega.
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-300">
                Purana Username <span className="text-purple-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">@</span>
                <input
                  type="text"
                  value={linkUsername}
                  onChange={(e) => setLinkUsername(e.target.value.toLowerCase())}
                  placeholder="e.g. bandar, jeeteshsharma"
                  autoFocus
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white font-mono text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">
                  Account Password <span className="text-purple-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowLinkPassword(!showLinkPassword)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  {showLinkPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showLinkPassword ? 'text' : 'password'}
                value={linkPassword}
                onChange={(e) => setLinkPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="pill-btn flex-1 text-xs cursor-pointer"
                style={{ background: '#222', color: 'white' }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !linkUsername.trim() || !linkPassword}
                className="pill-btn flex-1 text-xs font-bold shadow-lg cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  opacity: loading || !linkUsername.trim() || !linkPassword ? 0.5 : 1,
                }}
              >
                {loading ? 'Linking...' : 'Link & Login 🚀'}
              </button>
            </div>
          </form>
        ) : (
          /* ── TAB 2: CREATE NEW ACCOUNT ── */
          <form onSubmit={handleSubmitNew} className="flex flex-col gap-4">
            <p className="text-xs text-gray-300 leading-relaxed bg-purple-950/20 border border-purple-500/30 rounded-xl p-3">
              💡 Naye users ke liye: Apna <strong>@username</strong> confirm karein aur ek <strong>password</strong> set karein taaki dono tareeqo se login kar sakein.
            </p>

            {/* Username selection */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">
                  Choose Unique Username <span className="text-purple-400">*</span>
                </label>
                {checkingUsername ? (
                  <span className="text-[11px] text-gray-400">Checking...</span>
                ) : usernameAvailable && !usernameError && username.trim().length >= 4 ? (
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    ✓ Available
                  </span>
                ) : null}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-mono">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="choose_username"
                  autoFocus
                  className={`w-full pl-8 pr-4 py-2.5 rounded-xl bg-[#181820] border text-white font-mono text-sm outline-none transition-colors ${
                    usernameError
                      ? 'border-rose-500 focus:border-rose-500'
                      : usernameAvailable && username.trim().length >= 4
                      ? 'border-emerald-500/60 focus:border-emerald-500'
                      : 'border-[#2e2e38] focus:border-purple-500'
                  }`}
                />
              </div>

              {usernameError && (
                <div className="flex flex-col gap-1 mt-1">
                  <p className="text-[11px] text-rose-400">{usernameError}</p>
                  <div className="flex items-center justify-between text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 rounded-lg">
                    <span>Kya yeh aapka purana account hai?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkUsername(username)
                        setMode('link')
                      }}
                      className="underline font-bold text-amber-200 hover:text-white cursor-pointer ml-1"
                    >
                      Link karein ➔
                    </button>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-500">
                Only letters, numbers, and underscores (min 4 characters).
              </p>
            </div>

            {/* Location & Exam Selection (Admin Info) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#252530]">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300">
                  State / UT <span className="text-purple-400">*</span>
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-xs outline-none focus:border-purple-500 transition-colors cursor-pointer"
                >
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-[#181820] text-white">
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300">
                  City / District <span className="text-purple-400">*</span>
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Jaipur, Patna, Lucknow"
                  className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-xs outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {/* Target Exam */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-300">
                Target Exam <span className="text-purple-400">*</span>
              </label>
              <select
                value={targetExam}
                onChange={(e) => setTargetExam(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-xs outline-none focus:border-purple-500 transition-colors cursor-pointer"
              >
                {TARGET_EXAMS.map((ex) => (
                  <option key={ex} value={ex} className="bg-[#181820] text-white">
                    {ex}
                  </option>
                ))}
              </select>
            </div>

            {/* Password fields */}
            <div className="flex flex-col gap-2 pt-1 border-t border-[#252530]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300">
                  Set Account Password <span className="text-purple-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-purple-400 hover:text-purple-300 cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password (min 6 chars)"
                className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-sm outline-none focus:border-purple-500 transition-colors"
              />

              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full px-3 py-2.5 rounded-xl bg-[#181820] border border-[#2e2e38] text-white text-sm outline-none focus:border-purple-500 transition-colors"
              />
              <p className="text-[10px] text-gray-500">
                This lets you log in via <strong>@{username || 'username'} + password</strong> on any device.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="pill-btn flex-1 text-xs cursor-pointer"
                style={{ background: '#222', color: 'white' }}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !usernameAvailable || username.trim().length < 4}
                className="pill-btn flex-1 text-xs font-bold shadow-lg cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  opacity: loading || !usernameAvailable || username.trim().length < 4 ? 0.5 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Enter Tracker 🚀'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
