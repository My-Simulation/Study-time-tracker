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
} from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'
import { useNavigate } from 'react-router-dom'

export default function GoogleOnboardingModal({
  isOpen,
  onClose,
  googleData,
  onSuccess,
}) {
  if (!isOpen || !googleData) return null

  const navigate = useNavigate()

  const [username, setUsername] = useState(googleData.suggestedUsername || '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState(true)
  const [usernameError, setUsernameError] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Debounced real-time username availability check
  useEffect(() => {
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
            setUsernameError(`@${trimmed} is already taken. Try another.`)
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
  }, [username])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setError('')

    const cleanUser = username.trim().toLowerCase()
    const userErr = validateUsername(cleanUser)
    if (userErr) {
      setError(userErr)
      return
    }

    if (!usernameAvailable) {
      setError(`@${cleanUser} is already taken. Please choose another username.`)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="card w-full max-w-md p-6 flex flex-col gap-5 border border-purple-500/40 shadow-2xl relative"
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
                <span>Welcome! 🎉</span>
              </h3>
              <p className="text-xs text-gray-400 font-medium">
                Signed in as <span className="text-purple-300 font-semibold">{googleData.email}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg p-1"
            title="Cancel"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed bg-purple-950/20 border border-purple-500/30 rounded-xl p-3">
          💡 <strong>Bas 2 aasan steps:</strong> Apna unique <strong>@username</strong> confirm karein aur ek <strong>password</strong> set karein taaki aap kisi bhi device par dono tareeqo se login kar sakein!
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              <p className="text-[11px] text-rose-400">{usernameError}</p>
            )}
            <p className="text-[10px] text-gray-500">
              Only letters, numbers, and underscores (min 4 characters).
            </p>
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
                className="text-[11px] text-purple-400 hover:text-purple-300"
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
              className="pill-btn flex-1 text-xs"
              style={{ background: '#222', color: 'white' }}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || !usernameAvailable || username.trim().length < 4}
              className="pill-btn flex-1 text-xs font-bold shadow-lg"
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
      </div>
    </div>
  )
}
