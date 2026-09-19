/**
 * GoogleSignInButton.jsx
 * Reusable 1-click "Continue with Google" button.
 * Handles:
 * - Google Sign-in popup via signInWithGoogleAuth()
 * - Instant login for existing users
 * - Triggers GoogleOnboardingModal for first-time users
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithGoogleAuth } from '../utils/firestoreHelpers'
import { saveSession } from '../utils/auth'
import GoogleOnboardingModal from './GoogleOnboardingModal'

export default function GoogleSignInButton({ text = 'Continue with Google', className = '' }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [onboardingData, setOnboardingData] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)

  const handleGoogleClick = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await signInWithGoogleAuth()
      if (res.isNewUser) {
        setOnboardingData(res.googleData)
        setShowOnboarding(true)
      } else {
        // Existing user: direct login!
        saveSession(res.username, res.userDoc)
        navigate('/', { replace: true })
      }
    } catch (err) {
      console.error('Google Sign-In error:', err)
      // If user closed popup, don't show loud error
      if (err?.code === 'auth/popup-closed-by-user') {
        // User just closed popup
      } else {
        setError(err?.message || 'Google Sign-In failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="w-full flex flex-col gap-1.5">
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={loading}
          className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-[#333] bg-[#16161c] hover:bg-[#1f1f28] text-white text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-[0.99] disabled:opacity-60 cursor-pointer ${className}`}
        >
          {/* Official Google G Logo SVG */}
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
          <span>{loading ? 'Connecting with Google...' : text}</span>
        </button>

        {error && (
          <p className="text-[11px] text-rose-400 text-center">{error}</p>
        )}
      </div>

      <GoogleOnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        googleData={onboardingData}
        onSuccess={(username, userDoc) => {
          setShowOnboarding(false)
          saveSession(username, userDoc)
          navigate('/', { replace: true })
        }}
      />
    </>
  )
}
