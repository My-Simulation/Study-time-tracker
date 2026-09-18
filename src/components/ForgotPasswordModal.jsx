/**
 * ForgotPasswordModal.jsx — Password reset modal for forgot password
 * Allows user to verify their username and set a new password.
 */

import React, { useState } from 'react'
import { getUserDoc, resetUserPassword, validatePassword } from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'

export default function ForgotPasswordModal({ isOpen, onClose, onResetSuccess }) {
  if (!isOpen) return null

  const [step, setStep] = useState(1) // 1=find username, 2=new password
  const [username, setUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // ── Step 1: Check if user exists ──────────────────────────────────────────
  const handleFindAccount = async (e) => {
    e?.preventDefault()
    const trimmed = username.trim().toLowerCase()
    if (!trimmed) {
      setError('Please enter your username.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const user = await getUserDoc(trimmed)
      if (!user) {
        setError(`No account found for @${trimmed}. Please check your spelling.`)
        return
      }
      setStep(2)
    } catch (err) {
      console.error(err)
      setError('Could not verify account. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 2: Reset Password ────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e?.preventDefault()
    setError('')
    setSuccess('')

    const pwErr = validatePassword(newPassword)
    if (pwErr) {
      setError(pwErr)
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const trimmed = username.trim().toLowerCase()
      const result = await resetUserPassword(trimmed, newPassword)
      if (!result.ok) {
        setError(result.error)
        return
      }

      setSuccess('Password reset successfully! Logging you in... 🎉')
      setTimeout(() => {
        saveSession(trimmed, result.userDoc)
        if (onResetSuccess) onResetSuccess(trimmed, result.userDoc)
        onClose()
      }, 1000)
    } catch (err) {
      console.error(err)
      setError('Failed to update password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl max-w-sm w-full p-6 flex flex-col gap-5 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔑</span>
            <h3 className="text-base font-bold text-white">Reset Password</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#202020] text-gray-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {step === 1 ? (
          /* Step 1: Verify Username */
          <form onSubmit={handleFindAccount} className="flex flex-col gap-4">
            <p className="text-xs text-gray-400">
              Enter your username to recover access to your study dashboard and stats.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">Username</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    setError('')
                  }}
                  placeholder="your_username"
                  autoFocus
                  autoCapitalize="none"
                  className="w-full rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm pl-8 pr-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="pill-btn w-full mt-1"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                color: 'white',
                opacity: loading || !username.trim() ? 0.5 : 1,
                cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Finding Account...' : 'Continue →'}
            </button>
          </form>
        ) : (
          /* Step 2: Set New Password */
          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div>
              <span className="text-xs text-purple-300 font-semibold">Account found:</span>
              <p className="text-sm font-bold text-white font-mono">@{username.trim().toLowerCase()}</p>
            </div>

            {/* New Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">New Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Min 6 characters"
                  autoFocus
                  className="w-full rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors pr-14"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-300">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setError('')
                }}
                placeholder="Re-enter new password"
                className="w-full rounded-xl bg-[#1a1a1a] border border-[#2a2a2a] text-white text-sm px-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 rounded-xl bg-green-950/40 border border-green-900/50 text-green-300 text-xs">
                {success}
              </div>
            )}

            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="py-2.5 px-4 rounded-xl bg-[#202020] text-gray-300 text-xs font-bold hover:bg-[#282828] transition-colors"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword}
                className="pill-btn flex-1"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                  color: 'white',
                  opacity: loading || !newPassword || !confirmPassword ? 0.5 : 1,
                  cursor: loading || !newPassword || !confirmPassword ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Updating...' : 'Set Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
