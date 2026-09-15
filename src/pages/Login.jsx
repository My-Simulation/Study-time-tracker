/**
 * Login.jsx
 * Unique username login — validates format + checks Firestore for duplicates.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureUserExists, validateUsername, isUsernameTaken, generateUsernameSuggestions } from '../utils/firestoreHelpers'

export default function Login() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const navigate = useNavigate()

  const handleContinue = async (e) => {
    e?.preventDefault()
    const trimmed = name.trim()

    // Client-side validation
    const validationError = validateUsername(trimmed)
    if (validationError) { setError(validationError); return }

    setLoading(true)
    setError('')
    setSuggestions([])

    try {
      const taken = await isUsernameTaken(trimmed)
      if (taken) {
        // Username is taken — offer suggestions
        setSuggestions(generateUsernameSuggestions(trimmed))
        setError(`@${trimmed.toLowerCase()} is already taken.`)
        setLoading(false)
        return
      }

      // Username is free — create user doc and save to localStorage
      const savedName = await ensureUserExists(trimmed)
      localStorage.setItem('studyTrackerUser', savedName)
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      setError('Could not connect. Check your Firebase config in src/firebase.js.')
    } finally {
      setLoading(false)
    }
  }

  const handleSuggestionClick = (s) => {
    setName(s)
    setSuggestions([])
    setError('')
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#0d0d0d' }}
    >
      <div
        className="card w-full max-w-sm p-8 flex flex-col gap-6"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: '#8b5cf620', border: '1px solid #8b5cf640' }}
          >
            📚
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Study Time Tracker</h1>
            <p className="text-sm text-gray-500 mt-1">Pick a unique username to get started</p>
          </div>
        </div>

        {/* Username rules hint */}
        <div className="rounded-xl bg-[#111] border border-[#2a2a2a] px-4 py-3 flex flex-col gap-1">
          <p className="text-xs text-gray-500 font-medium">Username rules:</p>
          <p className="text-xs text-gray-600">• 3–20 characters &nbsp;• Letters, numbers, underscores</p>
          <p className="text-xs text-gray-600">• No spaces &nbsp;• Must be unique (like Instagram)</p>
        </div>

        {/* Form */}
        <form onSubmit={handleContinue} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-400">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm select-none">@</span>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); setSuggestions([]) }}
                placeholder="e.g. jeetesh_23"
                maxLength={20}
                autoFocus
                disabled={loading}
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 pl-8 pr-4 py-3 text-base outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
              />
            </div>
            {/* Live preview */}
            {name.trim().length >= 3 && (
              <p className="text-xs text-gray-600 px-1">
                Your profile will be: <span className="text-purple-400">@{name.trim().toLowerCase()}</span>
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Suggestions when name is taken */}
          {suggestions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">Try one of these:</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSuggestionClick(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[#2a2a2a] text-gray-300 hover:border-purple-500 hover:text-purple-400 transition-colors"
                  >
                    @{s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || name.trim().length < 3}
            className="pill-btn w-full mt-1"
            style={{
              background: '#8b5cf6',
              color: 'white',
              opacity: loading || name.trim().length < 3 ? 0.5 : 1,
              cursor: loading || name.trim().length < 3 ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Checking…' : 'Continue →'}
          </button>
        </form>

        {/* Already have account */}
        <div className="text-center">
          <p className="text-xs text-gray-600">Already have a username?</p>
          <p className="text-xs text-gray-600 mt-0.5">Just enter it — existing users sign in automatically.</p>
        </div>
      </div>
    </div>
  )
}
