/**
 * GuestGate.jsx
 * Shown when an unauthenticated guest visits a personal account route
 * (/history, /analytics, /profile, /plan).
 * Instead of abruptly blocking or redirecting, shows an attractive preview
 * of the feature and invites the user to sign in or return to the timer.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthModal from './AuthModal'

const FEATURE_CONFIGS = {
  history: {
    icon: '📖',
    badge: 'Study History & Logs',
    title: 'Keep a complete record of every study session',
    description:
      'View detailed daily session logs, exact timestamps, focus ratings, subjects studied, and questions completed.',
    perks: ['Daily study timeline & breaks', 'Subject & topic breakdown', 'Detailed revision logs'],
  },
  analytics: {
    icon: '📊',
    badge: 'Progress & Analytics',
    title: 'Visualize your consistency, streaks, and subject trends',
    description:
      'Interactive weekly & monthly charts, subject distribution pie graphs, productivity heatmaps, and exam countdowns.',
    perks: ['Weekly & monthly hour charts', 'Subject balance graphs', 'Streak maintenance analysis'],
  },
  plan: {
    icon: '📅',
    badge: 'Weekly Study Target',
    title: 'Set weekly targets and customize study routines',
    description:
      'Set targeted hours per day, assign subjects to days of the week, and configure rest days with automatic streak shields.',
    perks: ['Custom hours target per weekday', 'Streak Shield rest day protection', 'Automated progress pacing'],
  },
  profile: {
    icon: '👤',
    badge: 'Personal Profile & Settings',
    title: 'Manage your focus account and live partner link',
    description:
      'Customize focus wallpapers, avatar colors, display names, and generate your live partner study room link.',
    perks: ['Custom focus wallpapers & dark dimming', 'Shareable Live Watch partner link', 'Account security & password settings'],
  },
}

export default function GuestGate({ feature = 'history', children, isAuthenticated = false }) {
  const navigate = useNavigate()
  const [showAuthModal, setShowAuthModal] = useState(false)

  if (isAuthenticated) {
    return children
  }

  const cfg = FEATURE_CONFIGS[feature] || FEATURE_CONFIGS.history

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div
        className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-[#14141c]/90 border border-[#2c2c3e] shadow-2xl flex flex-col items-center gap-5 relative overflow-hidden backdrop-blur-xl"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Ambient glow */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-40 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124, 58, 237, 0.3) 0%, transparent 70%)',
          }}
        />

        {/* Feature badge */}
        <div className="relative z-10 flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
          <span>{cfg.icon}</span>
          <span>{cfg.badge}</span>
        </div>

        {/* Title & description */}
        <div className="relative z-10 flex flex-col gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
            {cfg.title}
          </h2>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
            {cfg.description}
          </p>
        </div>

        {/* Visual Mockup preview card */}
        <div className="w-full p-4 rounded-2xl bg-[#0f0f14] border border-[#232332] text-left flex flex-col gap-2.5 my-1">
          <div className="flex items-center justify-between text-xs text-gray-400 pb-2 border-b border-[#1c1c28]">
            <span className="font-semibold text-gray-300 flex items-center gap-1.5">
              <span>⚡</span> JeetPrep Cloud Sync
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
              Free Account
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            {cfg.perks.map((perk, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-gray-300">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>{perk}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col sm:flex-row gap-2.5 pt-1">
          <button
            onClick={() => setShowAuthModal(true)}
            className="flex-1 py-3 px-5 rounded-2xl text-white font-bold text-xs sm:text-sm shadow-xl transition-all active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
              boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
            }}
          >
            <span>✨</span>
            <span>Sign In / Create Account</span>
          </button>

          <button
            onClick={() => navigate('/')}
            className="py-3 px-4 rounded-2xl text-gray-300 hover:text-white bg-[#1a1a24] hover:bg-[#222230] border border-[#2e2e40] text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <span>⏱️</span>
            <span>Use Timer</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-500">
          No credit card required. Free forever for serious aspirants.
        </p>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false)
          window.location.reload()
        }}
        title={`Sign in to access ${cfg.badge}`}
        subtitle="Your study progress, streaks, and sessions will be synced automatically."
      />
    </div>
  )
}
