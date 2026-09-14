/**
 * Login.jsx
 * Name-based login page. Saves user to localStorage + Firestore.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ensureUserExists } from '../utils/firestoreHelpers'

export default function Login() {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleContinue = async (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Please enter your name.')
      return
    }
    if (trimmed.length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (trimmed.length > 50) {
      setError('Name must be 50 characters or less.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await ensureUserExists(trimmed)
      localStorage.setItem('studyTrackerUser', trimmed)
      navigate('/', { replace: true })
    } catch (err) {
      console.error('Login error:', err)
      setError(
        'Could not connect to database. Check your Firebase config in src/firebase.js.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: '#0d0d0d' }}
    >
      <div
        className="card w-full max-w-sm p-8 flex flex-col gap-7"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Icon / Logo */}
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: '#8b5cf620', border: '1px solid #8b5cf640' }}
          >
            📚
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-white">Study Time Tracker</h1>
            <p className="text-sm text-gray-500 mt-1">
              Track your daily study sessions
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleContinue} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-400">
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={50}
              autoFocus
              disabled={loading}
              className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-4 py-3 text-base outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="pill-btn w-full mt-1"
            style={{
              background: '#8b5cf6',
              color: 'white',
              opacity: loading || !name.trim() ? 0.5 : 1,
              cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Setting up…' : 'Continue →'}
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center">
          No password needed — your name is your session key.
        </p>
      </div>
    </div>
  )
}
