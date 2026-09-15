/**
 * Stopwatch.jsx — Main timer page.
 * New in this version:
 *  - Live status synced to Firestore (useLiveStatus)
 *  - Daily goal progress bar (from weekly plan)
 *  - Profile pill (top-left: avatar + username)
 *  - Plan button (📅 icon → /plan)
 *  - Watch partner button (👁️ icon → /watch)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStopwatch } from '../hooks/useStopwatch'
import { useLiveStatus } from '../hooks/useLiveStatus'
import StopwatchDisplay from '../components/StopwatchDisplay'
import LapTable from '../components/LapTable'
import SaveModal from '../components/SaveModal'
import Toast from '../components/Toast'
import { getWeeklyPlan, getTargetForDate, getUserSessions } from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes } from '../utils/formatTime'
import { clearSession, getSession } from '../utils/auth'

export default function Stopwatch({ userName }) {
  const navigate = useNavigate()
  const { elapsed, isRunning, laps, displayTime, start, stop, reset, lap } = useStopwatch()

  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [dailyGoal, setDailyGoal] = useState(null)   // { targetMinutes, subjects }
  const [todayStudied, setTodayStudied] = useState(0) // seconds studied today
  const captureRef = useRef(null)

  const hasTime = elapsed > 0

  // ── Sync live status to Firestore ────────────────────────────────────────
  useLiveStatus(userName, isRunning, elapsed)

  // ── Load today's goal from weekly plan ───────────────────────────────────
  useEffect(() => {
    async function loadGoal() {
      try {
        const plan = await getWeeklyPlan(userName)
        const goal = getTargetForDate(todayString(), plan)
        setDailyGoal(goal)

        // Load today's already-studied time
        const sessions = await getUserSessions(userName)
        const todaySec = sessions
          .filter((s) => s.date === todayString())
          .reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
        setTodayStudied(todaySec)
      } catch (err) {
        console.warn('Could not load daily goal:', err)
      }
    }
    loadGoal()
  }, [userName])

  const session = getSession()
  const avatarColor = session?.avatarColor || '#7c3aed'

  const handleSwitchUser = () => {
    clearSession()
    navigate('/welcome', { replace: true })
  }

  const handleSaved = useCallback(
    (date, didReset) => {
      setShowModal(false)
      setToast({ visible: true, message: `Saved for ${date} ✅` })
      if (didReset) reset()
      // Refresh today's studied time
      const added = Math.floor(elapsed / 1000)
      setTodayStudied((prev) => prev + added)
    },
    [reset, elapsed]
  )

  const dismissToast = useCallback(() => setToast({ visible: false, message: '' }), [])
  const totalSeconds = Math.floor(elapsed / 1000)

  // ── Daily goal progress ───────────────────────────────────────────────────
  const goalProgress = (() => {
    if (!dailyGoal || !dailyGoal.targetMinutes) return null
    const targetSec = dailyGoal.targetMinutes * 60
    const studiedSec = todayStudied + Math.floor(elapsed / 1000)
    const pct = Math.min(100, Math.round((studiedSec / targetSec) * 100))
    return { pct, targetSec, studiedSec, label: formatHoursMinutes(targetSec) }
  })()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d0d0d' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-0">
        {/* Profile pill */}
        <ProfilePill userName={userName} avatarColor={avatarColor} onLogout={handleSwitchUser} />

        {/* Right icons */}
        <div className="flex items-center gap-1">
          {/* Plan icon */}
          <IconButton onClick={() => navigate('/plan')} title="Study Plan" aria-label="Study Plan">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="3" y1="9" x2="21" y2="9" />
            </svg>
          </IconButton>
          {/* Watch partner */}
          <IconButton onClick={() => navigate('/watch')} title="Watch Partner" aria-label="Watch Partner">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </IconButton>
          {/* History icon */}
          <IconButton onClick={() => navigate('/history')} title="History" aria-label="View history">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* ── Mode label ── */}
      <div className="flex justify-center px-4 pt-3 pb-1">
        <div
          className="px-5 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase select-none"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#aaa', letterSpacing: '0.15em' }}
        >
          Stopwatch
        </div>
      </div>

      {/* ── Daily goal progress bar ── */}
      {goalProgress && (
        <div className="px-4 pt-2 pb-0 max-w-lg mx-auto w-full">
          <div className="card px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500">Today's Goal</span>
                {dailyGoal.subjects && (
                  <span className="text-xs text-gray-600 ml-2">· {dailyGoal.subjects}</span>
                )}
              </div>
              <span className={`text-xs font-semibold font-mono ${goalProgress.pct >= 100 ? 'text-green-400' : 'text-purple-400'}`}>
                {formatHoursMinutes(goalProgress.studiedSec)} / {goalProgress.label}
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${goalProgress.pct}%`,
                  background: goalProgress.pct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
                }}
              />
            </div>
            {goalProgress.pct >= 100 && (
              <p className="text-xs text-green-400 text-center">🎉 Goal achieved for today!</p>
            )}
          </div>
        </div>
      )}

      {/* ── Main card ── */}
      <div className="flex-1 flex flex-col px-4 pb-8 max-w-lg mx-auto w-full">
        <div className="card flex flex-col flex-1 overflow-hidden mt-3">
          <div ref={captureRef} className="bg-[#1a1a1a] rounded-2xl">
            <StopwatchDisplay displayTime={displayTime} />
            {laps.length > 0 && <div className="border-t border-[#2a2a2a]" />}
            <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
              <LapTable laps={laps} />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2.5 p-4 pt-3">
            {hasTime && (
              <button
                onClick={() => setShowModal(true)}
                className="pill-btn w-full"
                style={{ background: '#8b5cf6', color: 'white' }}
              >
                Save Session
              </button>
            )}
            {isRunning && (
              <button onClick={lap} className="pill-btn w-full" style={{ background: '#3b82f6', color: 'white' }}>
                Lap
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={reset}
                disabled={isRunning || elapsed === 0}
                className="pill-btn flex-1"
                style={{ background: '#2a2a2a', color: isRunning || elapsed === 0 ? '#555' : 'white', cursor: isRunning || elapsed === 0 ? 'not-allowed' : 'pointer' }}
              >
                Reset
              </button>
              <button
                onClick={isRunning ? stop : start}
                className="pill-btn flex-1"
                style={{ background: isRunning ? '#ef4444' : '#22c55e', color: isRunning ? 'white' : 'black' }}
              >
                {isRunning ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SaveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
        captureTargetRef={captureRef}
        displayTime={displayTime}
        totalSeconds={totalSeconds}
        laps={laps}
        userName={userName}
      />
      <Toast message={toast.message} visible={toast.visible} onDismiss={dismissToast} />
    </div>
  )
}

// ── Profile Pill ──────────────────────────────────────────────────────────────
function ProfilePill({ userName, avatarColor, onLogout }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const shareLink = `${window.location.origin}/watch/${userName}`
  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-[#1a1a1a]"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ background: avatarColor }}
        >
          {userName[0].toUpperCase()}
        </div>
        <span className="text-sm text-gray-300 font-medium max-w-[100px] truncate">@{userName}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 card p-3 flex flex-col gap-1 min-w-[190px]" style={{ animation: 'scaleIn 150ms ease-out' }}>
            {/* Avatar header */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0" style={{ background: avatarColor }}>
                {userName[0].toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">@{userName}</p>
                <p className="text-xs text-gray-600">Your account</p>
              </div>
            </div>
            <div className="border-t border-[#2a2a2a] my-1" />
            <MenuBtn icon="📋" label="Weekly Plan" onClick={() => { navigate('/plan'); setOpen(false) }} />
            <MenuBtn icon="👁️" label="Watch Partner" onClick={() => { navigate('/watch'); setOpen(false) }} />
            <MenuBtn icon={copied ? '✓' : '🔗'} label={copied ? 'Copied!' : 'Copy Live Link'} onClick={copyLink} />
            <div className="border-t border-[#2a2a2a] my-1" />
            <MenuBtn icon="🚪" label="Logout" onClick={onLogout} danger />
          </div>
        </>
      )}
    </div>
  )
}

function MenuBtn({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left w-full ${
        danger ? 'hover:bg-red-950/30 text-red-400' : 'hover:bg-[#2a2a2a] text-gray-300'
      }`}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#1a1a1a]"
    >
      {children}
    </button>
  )
}

function stringToColor(str) {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
