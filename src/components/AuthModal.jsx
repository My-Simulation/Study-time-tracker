/**
 * AuthModal.jsx
 * Frictionless authentication modal for guest users.
 * Supports:
 * - 1-tap Google Sign-In
 * - Instant Username & Password Sign In
 * - Instant Account Creation
 * - Preserves in-progress session / timer state
 */

import React, { useState } from 'react'
import { loginUser, createUser, getUserDoc } from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'
import GoogleSignInButton from './GoogleSignInButton'

export default function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Join JeetPrep',
  subtitle = 'Unlock your complete study operating system',
  sessionDuration = '',
  actionContext = 'save', // 'save' | 'plan' | 'feature'
}) {
  const [tab, setTab] = useState('signin') // 'signin' | 'signup'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape key press
  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleAuthSubmit = async (e) => {
    e?.preventDefault()
    const cleanUsername = username.trim().toLowerCase()
    if (!cleanUsername) {
      setError('Please enter a username.')
      return
    }
    if (cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername)) {
      setError('Username can only contain letters, numbers, and underscores.')
      return
    }
    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (tab === 'signin') {
        const result = await loginUser(cleanUsername, password)
        if (!result.ok) {
          setError(result.error || 'Invalid username or password.')
          setLoading(false)
          return
        }
        saveSession(cleanUsername, result.userDoc)
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: { username: cleanUsername } }))
        onSuccess?.(cleanUsername, result.userDoc)
        onClose?.()
      } else {
        // Sign up
        const existing = await getUserDoc(cleanUsername)
        if (existing) {
          setError(`@${cleanUsername} is already taken. Try another name or sign in.`)
          setLoading(false)
          return
        }

        const newUserDoc = await createUser({
          username: cleanUsername,
          password,
          displayName: displayName.trim() || cleanUsername,
          avatarColor: '#7c3aed',
        })
        saveSession(cleanUsername, newUserDoc)
        window.dispatchEvent(new Event('storage'))
        window.dispatchEvent(new CustomEvent('auth_state_changed', { detail: { username: cleanUsername } }))
        onSuccess?.(cleanUsername, newUserDoc)
        onClose?.()
      }
    } catch (err) {
      console.error('Auth error:', err)
      setError('Connection failed. Please check internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md p-6 sm:p-7 rounded-3xl bg-[#14141a]/95 border border-[#2e2e42] shadow-2xl relative text-white flex flex-col gap-5 overflow-hidden cursor-default"
        style={{ animation: 'scaleIn 180ms ease-out' }}
      >
        {/* Top ambient glow */}
        <div
          className="absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, transparent 70%)',
          }}
        />

        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose?.()
          }}
          type="button"
          aria-label="Close modal"
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-[#1e1e28] hover:bg-[#2e2e3e] text-gray-300 hover:text-white flex items-center justify-center text-base font-bold transition-all cursor-pointer z-50 shadow-md active:scale-90"
        >
          ✕
        </button>

        {/* Header */}
        <div className="relative z-10 flex flex-col gap-1.5 pr-8">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="text-xs font-black tracking-wider uppercase text-purple-400">JeetPrep Auth</span>
          </div>
          <h3 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            {title}
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            {subtitle}
          </p>
        </div>

        {/* Session time banner if saving session */}
        {sessionDuration && (
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-purple-500/10 border border-purple-500/25">
            <span className="text-2xl">⏱️</span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-purple-200">
                Study Session of <span className="text-white font-mono">{sessionDuration}</span> ready to save!
              </p>
              <p className="text-[11px] text-gray-400">
                Sign in to log this in your daily streak and history.
              </p>
            </div>
          </div>
        )}

        {/* Google 1-tap sign-in */}
        <div className="w-full">
          <GoogleSignInButton
            text="Continue with Google"
            className="py-3 text-sm rounded-xl font-bold bg-[#191924] hover:bg-[#222232] border-[#36364d]"
          />
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#262636]" />
          <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">or with username</span>
          <div className="flex-1 h-px bg-[#262636]" />
        </div>

        {/* Tab switch */}
        <div className="flex p-1 rounded-xl bg-[#181822] border border-[#282838]">
          <button
            type="button"
            onClick={() => { setTab('signin'); setError('') }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signin'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setTab('signup'); setError('') }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              tab === 'signup'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
          {tab === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-gray-400">Your Name (optional)</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Rohit"
                maxLength={30}
                className="w-full rounded-xl bg-[#121218] border border-[#2a2a3a] text-white placeholder-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400">Username</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                placeholder="choose_username"
                maxLength={20}
                autoCapitalize="none"
                className="w-full rounded-xl bg-[#121218] border border-[#2a2a3a] text-white placeholder-gray-600 pl-8 pr-3.5 py-2.5 text-sm outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-gray-400">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Min 4 characters"
                className="w-full rounded-xl bg-[#121218] border border-[#2a2a3a] text-white placeholder-gray-600 px-3.5 py-2.5 text-sm outline-none focus:border-purple-500 transition-colors pr-14"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-500 hover:text-gray-300 font-medium px-1 cursor-pointer"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-rose-400 text-xs bg-rose-950/40 border border-rose-900/50 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="pill-btn w-full mt-1.5 py-3 text-sm font-bold text-white shadow-lg cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 4px 20px rgba(124, 58, 237, 0.35)',
            }}
          >
            {loading
              ? 'Please wait...'
              : tab === 'signin'
              ? 'Sign In & Continue →'
              : 'Create Account & Continue →'}
          </button>
        </form>

        {/* Feature highlight bullet points */}
        <div className="pt-2 border-t border-[#222230] grid grid-cols-2 gap-2 text-[10px] text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> Auto Cloud Backup
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> Daily Streaks & Goals
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> Live Partner Watch
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-green-400">✓</span> Kit AI Study Mentor
          </div>
        </div>
      </div>
    </div>
  )
}
