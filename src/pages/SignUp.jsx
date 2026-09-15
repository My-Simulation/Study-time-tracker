/**
 * SignUp.jsx — Create new account with username, password, and avatar.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  validateUsername, validatePassword,
  isUsernameTaken, generateUsernameSuggestions, createUser,
} from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'

const AVATAR_COLORS = [
  { color: '#7c3aed', label: 'Purple' },
  { color: '#2563eb', label: 'Blue' },
  { color: '#059669', label: 'Green' },
  { color: '#dc2626', label: 'Red' },
  { color: '#d97706', label: 'Amber' },
  { color: '#db2777', label: 'Pink' },
  { color: '#0891b2', label: 'Cyan' },
  { color: '#65a30d', label: 'Lime' },
]

export default function SignUp() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1) // 1=username, 2=password, 3=avatar

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0].color)
  const [showPassword, setShowPassword] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])

  // ── Step 1: Username ────────────────────────────────────────────────────
  const handleCheckUsername = async (e) => {
    e?.preventDefault()
    const trimmed = username.trim()
    const valErr = validateUsername(trimmed)
    if (valErr) { setError(valErr); return }

    setLoading(true)
    setError('')
    setSuggestions([])
    try {
      const taken = await isUsernameTaken(trimmed)
      if (taken) {
        setSuggestions(generateUsernameSuggestions(trimmed))
        setError(`@${trimmed.toLowerCase()} is already taken.`)
        return
      }
      setStep(2)
    } catch (err) {
      setError('Could not check username. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Password ────────────────────────────────────────────────────
  const handleCheckPassword = (e) => {
    e?.preventDefault()
    const valErr = validatePassword(password)
    if (valErr) { setError(valErr); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setError('')
    setStep(3)
  }

  // ── Step 3: Avatar + Submit ─────────────────────────────────────────────
  const handleCreate = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const userDoc = await createUser({
        username: username.trim(),
        password,
        displayName: username.trim(),
        avatarColor,
      })
      saveSession(username.trim().toLowerCase(), userDoc)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Failed to create account. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const lowerUsername = username.trim().toLowerCase()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0d0d0d' }}>
      <div className="card w-full max-w-sm p-7 flex flex-col gap-6" style={{ animation: 'scaleIn 200ms ease-out' }}>

        {/* Back + Header */}
        <div>
          <button onClick={() => step === 1 ? navigate('/welcome') : setStep(s => s - 1)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors mb-4 flex items-center gap-1">
            ← {step === 1 ? 'Back' : 'Previous'}
          </button>

          {/* Step indicator */}
          <div className="flex gap-1.5 mb-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="h-1 flex-1 rounded-full transition-all" style={{ background: s <= step ? '#8b5cf6' : '#2a2a2a' }} />
            ))}
          </div>

          <h2 className="text-xl font-bold text-white">
            {step === 1 ? 'Choose a username' : step === 2 ? 'Set your password' : 'Pick your avatar'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1 ? 'Like Instagram — unique, no spaces' : step === 2 ? 'Keep it safe — min 6 characters' : 'This shows on your profile'}
          </p>
        </div>

        {/* ── Step 1: Username ── */}
        {step === 1 && (
          <form onSubmit={handleCheckUsername} className="flex flex-col gap-4">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); setSuggestions([]) }}
                placeholder="your_username"
                maxLength={20}
                autoFocus
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 pl-8 pr-4 py-3 text-base outline-none focus:border-purple-500 transition-colors"
              />
            </div>
            {username.trim().length >= 3 && (
              <p className="text-xs text-gray-600 -mt-2 px-1">
                Your profile: <span className="text-purple-400">@{username.trim().toLowerCase()}</span>
              </p>
            )}
            {error && <ErrorBox>{error}</ErrorBox>}
            {suggestions.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500">Try:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => { setUsername(s); setError(''); setSuggestions([]) }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[#2a2a2a] text-gray-400 hover:border-purple-500 hover:text-purple-400 transition-colors">
                      @{s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <PrimaryBtn type="submit" disabled={loading || username.trim().length < 3}>
              {loading ? 'Checking…' : 'Continue →'}
            </PrimaryBtn>
          </form>
        )}

        {/* ── Step 2: Password ── */}
        {step === 2 && (
          <form onSubmit={handleCheckPassword} className="flex flex-col gap-4">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Password (min 6 chars)"
                autoFocus
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-4 py-3 text-base outline-none focus:border-purple-500 transition-colors pr-12"
              />
              <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 text-xs">
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
              placeholder="Confirm password"
              className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-4 py-3 text-base outline-none focus:border-purple-500 transition-colors"
            />
            {error && <ErrorBox>{error}</ErrorBox>}
            <PrimaryBtn type="submit" disabled={!password || !confirmPassword}>
              Continue →
            </PrimaryBtn>
          </form>
        )}

        {/* ── Step 3: Avatar ── */}
        {step === 3 && (
          <form onSubmit={handleCreate} className="flex flex-col gap-5">
            {/* Preview */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg transition-all"
                style={{ background: avatarColor, boxShadow: `0 0 30px ${avatarColor}50` }}
              >
                {lowerUsername[0]?.toUpperCase() || '?'}
              </div>
              <p className="text-sm text-white font-semibold">@{lowerUsername}</p>
            </div>

            {/* Color picker */}
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">Choose avatar color:</p>
              <div className="grid grid-cols-4 gap-3">
                {AVATAR_COLORS.map(({ color, label }) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAvatarColor(color)}
                    title={label}
                    className="relative w-full aspect-square rounded-xl transition-all"
                    style={{
                      background: color,
                      boxShadow: avatarColor === color ? `0 0 0 3px white, 0 0 0 5px ${color}` : 'none',
                      transform: avatarColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {avatarColor === color && (
                      <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-lg">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {error && <ErrorBox>{error}</ErrorBox>}

            <PrimaryBtn type="submit" disabled={loading}>
              {loading ? 'Creating account…' : '🚀 Create Account'}
            </PrimaryBtn>
          </form>
        )}

        {/* Sign in link */}
        <p className="text-center text-xs text-gray-600">
          Already have an account?{' '}
          <button onClick={() => navigate('/signin')} className="text-purple-400 hover:text-purple-300 underline underline-offset-2">
            Sign In
          </button>
        </p>
      </div>
    </div>
  )
}

function PrimaryBtn({ children, disabled, type = 'button', onClick }) {
  return (
    <button type={type} disabled={disabled} onClick={onClick}
      className="pill-btn w-full"
      style={{ background: '#8b5cf6', color: 'white', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {children}
    </button>
  )
}

function ErrorBox({ children }) {
  return (
    <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5">
      {children}
    </div>
  )
}
