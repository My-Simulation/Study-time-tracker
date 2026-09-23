/**
 * Welcome.jsx
 * High-converting, interactive landing page for JeetPrep.
 * Highlights:
 *  - "Try Timer Directly (No Login Needed)" primary hero CTA
 *  - 1-click Google Sign-in
 *  - Feature cards showcase (Timer, Day Planner, Live Partner, Kit AI)
 *  - Sign in & Create Account options
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import GoogleSignInButton from '../components/GoogleSignInButton'

export default function Welcome() {
  const navigate = useNavigate()

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{ background: '#0a0a0f' }}
    >
      {/* Background gradients */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 20%, rgba(124,58,237,0.18) 0%, rgba(79,70,229,0.08) 45%, transparent 70%)',
        }}
      />

      <div
        className="w-full max-w-md flex flex-col items-center gap-6 relative z-10 my-8"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Top Branding Chip */}
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-300 text-xs font-bold shadow-sm">
          <span>⚡</span>
          <span>JeetPrep • Study Operating System</span>
        </div>

        {/* Hero Title */}
        <div className="text-center flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-2xl mb-1"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
            }}
          >
            📚
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Study With Relentless Consistency.
          </h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-sm mx-auto leading-relaxed">
            Precision stopwatch, daily study sheets, live study partners, and Kit AI coach — designed for serious exam aspirants.
          </p>
        </div>

        {/* Primary Guest CTA: Try Timer Immediately */}
        <div className="w-full p-4 rounded-3xl bg-gradient-to-b from-[#181824] to-[#12121a] border border-[#2e2e42] shadow-2xl flex flex-col gap-3.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="pill-btn w-full py-3.5 text-sm sm:text-base font-extrabold text-white flex items-center justify-center gap-2.5 shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.35)',
              color: '#000',
              fontWeight: 800,
            }}
          >
            <span className="text-lg">⏱️</span>
            <span>Launch Stopwatch Timer (No Login)</span>
            <span className="text-xs opacity-75">→</span>
          </button>

          <p className="text-center text-[11px] text-gray-400">
            Guest mode available. Explore timer, Pomodoro & Day Planner freely.
          </p>

          <div className="flex items-center gap-3 my-0.5">
            <div className="flex-1 h-px bg-[#262638]" />
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">or sign in to save stats</span>
            <div className="flex-1 h-px bg-[#262638]" />
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton text="Continue with Google" />

          {/* Username sign in / create account buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => navigate('/signin')}
              className="py-2.5 px-3 rounded-xl bg-[#1c1c28] hover:bg-[#252536] border border-[#303044] text-white text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>🔑</span>
              <span>Sign In</span>
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="py-2.5 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>✨</span>
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Interactive Feature Highlights Grid */}
        <div className="w-full grid grid-cols-2 gap-2.5 text-left">
          <div className="p-3.5 rounded-2xl bg-[#121218]/90 border border-[#222230] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>⏱️</span>
              <span>Precision Timer</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Millisecond accurate stopwatch, 25m/50m Pomodoro & floating window.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121218]/90 border border-[#222230] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>🌸</span>
              <span>Daily Planner</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Day 1, 2, 3 sequential tracking with target vs actual study hours.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121218]/90 border border-[#222230] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>👁️</span>
              <span>Live Study Room</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              Watch your study partner's timer count live across mobile & laptop.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#121218]/90 border border-[#222230] flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>🤖</span>
              <span>Kit AI Coach</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-tight">
              AI Timetable generator, smart revision tips & exam pacing.
            </p>
          </div>
        </div>

        {/* Public watch partner link */}
        <button
          onClick={() => navigate('/watch')}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-4 flex items-center gap-1.5"
        >
          <span>👁️</span>
          <span>Watch a partner's live study timer (No login required)</span>
        </button>

        <p className="text-[11px] text-gray-600 text-center">
          100% Free for serious students. Your study records stay private.
        </p>
      </div>
    </div>
  )
}
