/**
 * Welcome.jsx
 * App landing page — shown when not logged in.
 * Options: Sign In (existing user) or Create Account (new user)
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: '#0d0d0d' }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.12) 0%, transparent 60%)',
        }}
      />

      <div
        className="w-full max-w-sm flex flex-col items-center gap-8 relative z-10"
        style={{ animation: 'scaleIn 250ms ease-out' }}
      >
        {/* App icon */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 0 40px rgba(124,58,237,0.4)',
            }}
          >
            📚
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white tracking-tight">Study Time Tracker</h1>
            <p className="text-gray-500 text-sm mt-1">Track. Compete. Improve.</p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2">
          {[
            '⏱ Live Timer', '🔥 Streaks', '📅 Weekly Plan',
            '👁 Watch Partner', '📊 Progress', '🏆 Goals',
          ].map((f) => (
            <span
              key={f}
              className="text-xs px-3 py-1 rounded-full text-gray-400 border border-[#2a2a2a]"
              style={{ background: '#111' }}
            >
              {f}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => navigate('/signup')}
            className="pill-btn w-full"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              color: 'white',
              boxShadow: '0 0 20px rgba(124,58,237,0.3)',
            }}
          >
            Create Account
          </button>
          <button
            onClick={() => navigate('/signin')}
            className="pill-btn w-full"
            style={{ background: '#1a1a1a', color: 'white', border: '1px solid #2a2a2a' }}
          >
            Sign In
          </button>
        </div>

        {/* Watch without logging in */}
        <button
          onClick={() => navigate('/watch')}
          className="text-xs text-gray-600 hover:text-gray-400 transition-colors underline underline-offset-2"
        >
          Watch a partner's timer (no login needed)
        </button>

        <p className="text-xs text-gray-700 text-center">
          Your data is private. Only you can log in with your password.
        </p>
      </div>
    </div>
  )
}
