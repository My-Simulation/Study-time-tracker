/**
 * SignIn.jsx — Login with username + password.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginUser } from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import GoogleSignInButton from '../components/GoogleSignInButton'

export default function SignIn() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignIn = async (e) => {
    e?.preventDefault()
    if (!username.trim() || !password) { setError('Enter your username and password.'); return }

    setLoading(true)
    setError('')

    try {
      const result = await loginUser(username.trim(), password)
      if (!result.ok) {
        setError(result.error)
        return
      }
      saveSession(username.trim().toLowerCase(), result.userDoc)
      navigate('/', { replace: true })
    } catch (err) {
      console.error(err)
      setError('Could not connect. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#0d0d0d' }}>
      <div className="card w-full max-w-sm p-7 flex flex-col gap-6" style={{ animation: 'scaleIn 200ms ease-out' }}>

        {/* Header */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              ← Back to Timer
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="w-8 h-8 rounded-full bg-[#1c1c24] hover:bg-[#282834] text-gray-400 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer shadow-sm active:scale-90"
              title="Close and back to timer"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: '#8b5cf620' }}>
              📚
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Welcome back</h2>
              <p className="text-xs text-gray-500">Sign in to your account</p>
            </div>
          </div>
        </div>

        {/* Google Sign-in */}
        <GoogleSignInButton text="Sign in with Google" />

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-xs text-gray-500">or sign in with password</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="flex flex-col gap-4">
          {/* Username */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-400">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError('') }}
                placeholder="your_username"
                maxLength={20}
                autoFocus
                autoCapitalize="none"
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 pl-8 pr-4 py-3 text-base outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">Password</label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="Your password"
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-4 py-3 text-base outline-none focus:border-purple-500 transition-colors pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-400 transition-colors px-1"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-400 text-sm bg-red-950/30 border border-red-900/40 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="pill-btn w-full mt-1"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: 'white',
              opacity: loading || !username.trim() || !password ? 0.5 : 1,
              cursor: loading || !username.trim() || !password ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-[#2a2a2a]" />
          <span className="text-xs text-gray-600">or</span>
          <div className="flex-1 h-px bg-[#2a2a2a]" />
        </div>

        {/* Create account */}
        <button
          onClick={() => navigate('/signup')}
          className="pill-btn w-full"
          style={{ background: '#1a1a1a', color: 'white', border: '1px solid #2a2a2a' }}
        >
          Create New Account
        </button>

        {/* Watch without login */}
        <p className="text-center text-xs text-gray-700">
          Just want to watch?{' '}
          <button onClick={() => navigate('/watch')} className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors">
            View a partner's live timer
          </button>
        </p>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        onResetSuccess={() => navigate('/', { replace: true })}
      />
    </div>
  )
}
