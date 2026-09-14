/**
 * History.jsx
 * Shows all saved sessions grouped by date with stats summary.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserSessions, groupSessionsByDate } from '../utils/firestoreHelpers'
import { formatDateDisplay, formatHoursMinutes } from '../utils/formatTime'

export default function History({ userName }) {
  const navigate = useNavigate()
  const [dateGroups, setDateGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ── Stats computed from dateGroups ───────────────────────────────────────
  const stats = computeStats(dateGroups)

  // ── Load sessions ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sessions = await getUserSessions(userName)
      setDateGroups(groupSessionsByDate(sessions))
    } catch (err) {
      console.error('History load error:', err)
      setError('Failed to load history. Check your Firebase config.')
    } finally {
      setLoading(false)
    }
  }, [userName])

  useEffect(() => {
    load()
  }, [load])

  const handleSwitchUser = () => {
    localStorage.removeItem('studyTrackerUser')
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0d0d0d' }}
      // Fade in animation
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Timer</span>
        </button>
        <button
          onClick={handleSwitchUser}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
        >
          Switch User
        </button>
      </div>

      {/* ── Page title ── */}
      <div className="px-4 pb-4">
        <h1 className="text-xl font-bold text-white">Study History</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {userName && `Sessions for ${userName}`}
        </p>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col px-4 pb-8 max-w-lg mx-auto w-full gap-4">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorCard message={error} onRetry={load} />
        ) : dateGroups.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label="Days Studied"
                value={stats.totalDays}
              />
              <StatCard
                label="Total Hours"
                value={formatHoursMinutes(stats.totalSeconds)}
              />
              <StatCard
                label="Best Day"
                value={formatHoursMinutes(stats.bestDaySeconds)}
              />
            </div>

            {/* Date cards */}
            <div className="flex flex-col gap-3">
              {dateGroups.map((group) => {
                // Find the most recent screenshot from this date's sessions
                const latestScreenshot = [...group.sessions]
                  .reverse()
                  .find((s) => s.screenshotUrl)?.screenshotUrl

                return (
                  <div
                    key={group.date}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/history/${group.date}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/history/${group.date}`)}
                    className="card p-4 flex items-center gap-3 text-left hover:border-[#3a3a3a] transition-all btn-press cursor-pointer"
                  >
                    {/* Date + time info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {formatDateDisplay(group.date)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {group.sessions.length} session
                          {group.sessions.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="font-mono text-xs text-purple-400 tabular-nums whitespace-nowrap">
                          {formatHoursMinutes(group.totalSeconds)}
                        </span>
                      </div>
                    </div>

                    {/* Thumbnail */}
                    {latestScreenshot ? (
                      <img
                        src={latestScreenshot}
                        alt={`Session on ${group.date}`}
                        className="w-20 h-12 sm:w-24 sm:h-14 object-cover rounded-lg flex-shrink-0 border border-[#2a2a2a]"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-20 h-12 sm:w-24 sm:h-14 rounded-lg flex-shrink-0 flex items-center justify-center border border-[#2a2a2a]"
                        style={{ background: '#111' }}
                      >
                        <span className="text-gray-700 text-xs">No img</span>
                      </div>
                    )}

                    {/* Chevron */}
                    <ChevronRight />
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────────────────────

function StatCard({ label, value }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <div className="text-xs text-gray-500 leading-tight">{label}</div>
      <div className="text-base font-bold text-white tabular-nums font-mono">
        {value}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] border-t-purple-500 animate-spin"
        style={{ borderTopColor: '#8b5cf6' }}
      />
    </div>
  )
}

function ErrorCard({ message, onRetry }) {
  return (
    <div className="card p-6 flex flex-col items-center gap-4 text-center">
      <div className="text-red-400 text-3xl">⚠️</div>
      <p className="text-sm text-gray-400">{message}</p>
      <button
        onClick={onRetry}
        className="pill-btn px-6 h-10 text-sm"
        style={{ background: '#2a2a2a', color: 'white' }}
      >
        Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card p-10 flex flex-col items-center gap-3 text-center">
      <div className="text-4xl">📖</div>
      <p className="text-gray-400 text-sm">No sessions saved yet.</p>
      <p className="text-gray-600 text-xs">
        Start the stopwatch and tap "Save" to record a session.
      </p>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#555"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ── Stats computation ────────────────────────────────────────────────────────
function computeStats(dateGroups) {
  if (!dateGroups.length) {
    return { totalDays: 0, totalSeconds: 0, bestDaySeconds: 0 }
  }
  const totalDays = dateGroups.length
  const totalSeconds = dateGroups.reduce((sum, g) => sum + g.totalSeconds, 0)
  const bestDaySeconds = Math.max(...dateGroups.map((g) => g.totalSeconds))
  return { totalDays, totalSeconds, bestDaySeconds }
}
