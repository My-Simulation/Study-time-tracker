/**
 * HistoryDetail.jsx
 * Shows all sessions saved on a specific date in read-only format.
 * Displays timer, lap table, and screenshot for each session.
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getSessionsByDate } from '../utils/firestoreHelpers'
import { formatDateDisplay } from '../utils/formatTime'
import { ReadOnlyLapTable } from '../components/LapTable'

export default function HistoryDetail({ userName }) {
  const { date } = useParams()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await getSessionsByDate(userName, date)
        if (!cancelled) setSessions(data)
      } catch (err) {
        console.error('HistoryDetail load error:', err)
        if (!cancelled) setError('Failed to load session data.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [userName, date])

  const handleSwitchUser = () => {
    localStorage.removeItem('studyTrackerUser')
    navigate('/login', { replace: true })
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0d0d0d' }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/history')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to History</span>
        </button>
        <button
          onClick={handleSwitchUser}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
        >
          Switch User
        </button>
      </div>

      {/* ── Date heading ── */}
      <div className="px-4 pb-4">
        <h1 className="text-xl font-bold text-white">
          {date ? formatDateDisplay(date) : 'Session Detail'}
        </h1>
        {sessions.length > 0 && (
          <p className="text-sm text-gray-500 mt-0.5">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded
          </p>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col px-4 pb-10 max-w-lg mx-auto w-full gap-5">
        {loading ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorCard message={error} />
        ) : sessions.length === 0 ? (
          <EmptyState date={date} />
        ) : (
          sessions.map((session, idx) => (
            <SessionCard key={session.id} session={session} index={idx} />
          ))
        )}
      </div>
    </div>
  )
}

// ── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, index }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Session label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Session {index + 1}
        </span>
        <div className="flex-1 h-px bg-[#2a2a2a]" />
      </div>

      {/* Stopwatch-style read-only card */}
      <div className="card overflow-hidden">
        {/* Big timer number */}
        <div
          className="relative flex items-center justify-center py-8"
          style={{ minHeight: '100px' }}
        >
          {/* Glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div
              style={{
                width: '300px',
                height: '140px',
                background:
                  'radial-gradient(ellipse at center, rgba(30,40,80,0.5) 0%, rgba(13,13,13,0) 70%)',
                borderRadius: '50%',
              }}
            />
          </div>

          <span
            className="relative z-10 font-mono tabular-nums tracking-tight text-white"
            style={{
              fontSize: 'clamp(40px, 10vw, 72px)',
              fontWeight: 700,
              fontFamily: '"Roboto Mono", ui-monospace, monospace',
            }}
          >
            {(session.totalTime || '0:00:00.00').split('').map((char, i) => {
              if (char === ':' || char === '.') {
                return (
                  <span key={i} style={{ fontWeight: 300, opacity: 0.7, margin: '0 1px' }}>
                    {char}
                  </span>
                )
              }
              return <span key={i}>{char}</span>
            })}
          </span>
        </div>

        {/* Lap table */}
        {session.laps && session.laps.length > 0 && (
          <div className="border-t border-[#2a2a2a]">
            <ReadOnlyLapTable laps={session.laps} />
          </div>
        )}
      </div>

      {/* Screenshot */}
      {session.screenshotUrl && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#2a2a2a]">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
              Saved Screenshot
            </p>
          </div>
          <img
            src={session.screenshotUrl}
            alt={`Screenshot of session ${index + 1}`}
            className="w-full object-contain"
            loading="lazy"
            style={{ maxHeight: '320px' }}
          />
        </div>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-xs text-gray-600">
          {session.laps?.length || 0} lap{session.laps?.length !== 1 ? 's' : ''}
        </span>
        <span className="text-xs text-gray-700">·</span>
        <span className="text-xs text-gray-600 font-mono tabular-nums">
          {session.totalTime}
        </span>
        {session.createdAt?.seconds && (
          <>
            <span className="text-xs text-gray-700">·</span>
            <span className="text-xs text-gray-600">
              {new Date(session.createdAt.seconds * 1000).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <div
        className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin"
        style={{ borderTopColor: '#8b5cf6' }}
      />
    </div>
  )
}

function ErrorCard({ message }) {
  return (
    <div className="card p-6 flex flex-col items-center gap-3 text-center">
      <div className="text-red-400 text-3xl">⚠️</div>
      <p className="text-sm text-gray-400">{message}</p>
    </div>
  )
}

function EmptyState({ date }) {
  return (
    <div className="card p-10 flex flex-col items-center gap-3 text-center">
      <div className="text-4xl">📭</div>
      <p className="text-gray-400 text-sm">
        No sessions found for {date ? formatDateDisplay(date) : 'this date'}.
      </p>
    </div>
  )
}
