/**
 * History.jsx — Full study history with:
 *  - Goal completion (red/green) per day based on weekly plan
 *  - Streak tracker (🔥 current, ⭐ longest)
 *  - 7-day activity chart
 *  - Partner search
 *  - Session mini-cards instead of "No img"
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getUserSessions, groupSessionsByDate,
  calculateStreaks, getWeeklyPlan, getTargetForDate,
  getSpacedRepetitionDue, getAllDayPlanners, saveSession,
} from '../utils/firestoreHelpers'
import { formatDateDisplay, formatHoursMinutes, todayString } from '../utils/formatTime'
import { clearSession } from '../utils/auth'

export default function History({ userName }) {
  const navigate = useNavigate()
  const [dateGroups, setDateGroups] = useState([])
  const [rawSessions, setRawSessions] = useState([])
  const [weeklyPlan, setWeeklyPlan] = useState({})
  const [dayPlanners, setDayPlanners] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerInput, setPartnerInput] = useState('')
  const [showRevisionAlerts, setShowRevisionAlerts] = useState(true)
  const [showManualModal, setShowManualModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [sessions, plan, dPlanners] = await Promise.all([
        getUserSessions(userName),
        getWeeklyPlan(userName),
        getAllDayPlanners(userName),
      ])
      setRawSessions(sessions || [])
      setDateGroups(groupSessionsByDate(sessions))
      setWeeklyPlan(plan || {})
      setDayPlanners(dPlanners || {})
    } catch (err) {
      console.error('History load error:', err)
      setError(`Failed to load: ${err?.message || 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }, [userName])

  useEffect(() => {
    load()
    const handleUpdate = (e) => {
      if (!e.detail?.userName || e.detail.userName === userName) {
        load()
      }
    }
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
    }
  }, [load, userName])

  const handleLogout = () => {
    clearSession()
    navigate('/welcome', { replace: true })
  }

  const { currentStreak, longestStreak } = calculateStreaks(dateGroups)
  const totalSeconds = dateGroups.reduce((s, g) => s + g.totalSeconds, 0)
  const bestDaySeconds = dateGroups.length ? Math.max(...dateGroups.map((g) => g.totalSeconds)) : 0

  // Last 7 days for chart
  const last7 = getLast7DaysData(dateGroups)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span><span>Back to Timer</span>
        </button>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-red-400 transition-colors underline underline-offset-2"
        >
          Logout
        </button>
      </div>

      {/* Page title & Manual Log button */}
      <div className="px-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Study History</h1>
          <p className="text-sm text-gray-500 mt-0.5">{userName && `@${userName}`}</p>
        </div>
        <button
          onClick={() => setShowManualModal(true)}
          className="text-xs px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 font-medium transition-all flex items-center gap-1.5 shadow-sm"
        >
          <span>➕</span>
          <span>Log Past Session</span>
        </button>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-10 max-w-lg mx-auto w-full gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
          </div>
        ) : error ? (
          <div className="card p-6 flex flex-col items-center gap-4 text-center">
            <div className="text-3xl">⚠️</div>
            <p className="text-sm text-gray-400">{error}</p>
            <button onClick={load} className="pill-btn px-6 h-10 text-sm" style={{ background: '#2a2a2a', color: 'white' }}>
              Retry
            </button>
          </div>
        ) : dateGroups.length === 0 ? (
          <div className="card p-10 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">📖</div>
            <p className="text-gray-400 text-sm">No sessions saved yet.</p>
            <p className="text-gray-600 text-xs">Start the stopwatch and tap "Save Session".</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Days Studied" value={dateGroups.length} />
              <StatCard label="Total Hours" value={formatHoursMinutes(totalSeconds)} />
              <StatCard label="🔥 Streak" value={`${currentStreak} day${currentStreak !== 1 ? 's' : ''}`} accent />
              <StatCard label="⭐ Best Streak" value={`${longestStreak} day${longestStreak !== 1 ? 's' : ''}`} />
            </div>

            {/* 7-day chart */}
            <WeeklyChart data={last7} />

            {/* Partner search */}
            <div className="card p-4 flex flex-col gap-3">
              <p className="text-sm font-semibold text-white">👁️ Watch a Study Partner</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">@</span>
                  <input
                    type="text"
                    value={partnerInput}
                    onChange={(e) => setPartnerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && partnerInput.trim() && navigate(`/watch/${partnerInput.trim().toLowerCase()}`)}
                    placeholder="their_username"
                    className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 pl-7 pr-3 py-2 text-sm outline-none focus:border-purple-500 transition-colors"
                  />
                </div>
                <button
                  onClick={() => partnerInput.trim() && navigate(`/watch/${partnerInput.trim().toLowerCase()}`)}
                  className="pill-btn px-4 h-10 text-sm"
                  style={{ background: '#8b5cf6', color: 'white' }}
                >
                  Watch
                </button>
              </div>
            </div>

            {/* Spaced Repetition Revision Alerts */}
            {(() => {
              const due = getSpacedRepetitionDue(rawSessions)
              const hasDue = due.day1.length > 0 || due.day3.length > 0 || due.day7.length > 0
              if (!hasDue || !showRevisionAlerts) return null

              return (
                <div className="card p-3.5 flex flex-col gap-2.5 border-purple-500/30 bg-[#161224]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🧠</span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Spaced Repetition Revision Due
                      </span>
                    </div>
                    <button
                      onClick={() => setShowRevisionAlerts(false)}
                      className="text-gray-500 hover:text-gray-300 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Review these topics for 5–10 minutes today to boost long-term memory retention:
                  </p>

                  <div className="flex flex-col gap-1.5 pt-1">
                    {due.day1.length > 0 && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                          1-Day (Yesterday)
                        </span>
                        {due.day1.map((item) => (
                          <span key={item.label} className="text-gray-300 font-medium text-[11px] bg-[#1d1730] px-2 py-0.5 rounded-lg border border-[#2e2648]">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {due.day3.length > 0 && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                          3-Day (3 Days Ago)
                        </span>
                        {due.day3.map((item) => (
                          <span key={item.label} className="text-gray-300 font-medium text-[11px] bg-[#1d1730] px-2 py-0.5 rounded-lg border border-[#2e2648]">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {due.day7.length > 0 && (
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                          7-Day (1 Week Ago)
                        </span>
                        {due.day7.map((item) => (
                          <span key={item.label} className="text-gray-300 font-medium text-[11px] bg-[#1d1730] px-2 py-0.5 rounded-lg border border-[#2e2648]">
                            {item.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Date cards with goal status & outcome tags */}
            <div className="flex flex-col gap-3">
              {dateGroups.map((group) => {
                const screenshot = [...group.sessions].reverse().find((s) => s.screenshotUrl)?.screenshotUrl
                const goal = getTargetForDate(group.date, weeklyPlan, dayPlanners)
                const goalPct = goal?.targetMinutes
                  ? Math.min(100, Math.round((group.totalSeconds / (goal.targetMinutes * 60)) * 100))
                  : null
                const isToday = group.date === todayString()
                const isPast = group.date < todayString()
                const goalMet = goalPct !== null && goalPct >= 100
                const goalMissed = goalPct !== null && goalPct < 100 && isPast && !isToday

                // Gather day's focus, output count, subjects and reflection tags
                const focusScores = group.sessions.map((s) => s.focusScore).filter(Boolean)
                const avgFocus = focusScores.length
                  ? (focusScores.reduce((a, b) => a + b, 0) / focusScores.length).toFixed(1)
                  : null

                const totalOutput = group.sessions
                  .map((s) => s.outputCount)
                  .filter((c) => c !== null && c !== undefined && !isNaN(c))
                  .reduce((a, b) => a + b, 0)

                const outputUnits = Array.from(new Set(group.sessions.map((s) => s.outputUnit).filter(Boolean)))
                const reflectionTags = Array.from(new Set(group.sessions.map((s) => s.reflectionTag).filter(Boolean)))
                const subjects = Array.from(new Set(group.sessions.map((s) => s.subject).filter(Boolean)))

                return (
                  <div
                    key={group.date}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/history/${group.date}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/history/${group.date}`)}
                    className="card p-4 flex flex-col gap-3 hover:border-[#3a3a3a] transition-all btn-press cursor-pointer"
                  >
                    {/* Top row */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {formatDateDisplay(group.date)}
                          {isToday && <span className="ml-2 text-xs text-purple-400 font-normal">Today</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-xs text-gray-600">·</span>
                          <span className="font-mono text-xs text-purple-400 tabular-nums whitespace-nowrap">
                            {formatHoursMinutes(group.totalSeconds)}
                          </span>
                          {goalMet && <GoalBadge type="met" />}
                          {goalMissed && <GoalBadge type="missed" />}
                        </div>

                        {/* Outcomes & tags row */}
                        {(avgFocus || totalOutput > 0 || reflectionTags.length > 0 || subjects.length > 0) && (
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            {avgFocus && (
                              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                                ⭐ {avgFocus}
                              </span>
                            )}
                            {totalOutput > 0 && (
                              <span className="text-[10px] font-medium text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                                📝 {totalOutput} {outputUnits[0] || 'done'}
                              </span>
                            )}
                            {reflectionTags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                                  tag.includes('Distraction') || tag.includes('Fatigue')
                                    ? 'text-red-300 bg-red-500/10 border-red-500/20'
                                    : 'text-gray-300 bg-[#222] border-[#333]'
                                }`}
                              >
                                {tag}
                              </span>
                            ))}
                            {subjects.map((sub) => (
                              <span key={sub} className="text-[10px] text-gray-400 bg-[#1a1a1a] border border-[#2a2a2a] px-1.5 py-0.5 rounded-md">
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Thumbnail or mini card */}
                      {screenshot ? (
                        <img
                          src={screenshot}
                          alt=""
                          className="w-20 h-12 sm:w-24 sm:h-14 object-cover rounded-lg flex-shrink-0 border border-[#2a2a2a]"
                          loading="lazy"
                        />
                      ) : (
                        <SessionMiniCard totalSeconds={group.totalSeconds} sessions={group.sessions.length} />
                      )}

                      <ChevronRight />
                    </div>

                    {/* Goal progress bar */}
                    {goalPct !== null && (
                      <div className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">
                            Goal: {formatHoursMinutes(goal.targetMinutes * 60)}
                            {goal.subjects && ` · ${goal.subjects}`}
                          </span>
                          <span className={goalMet ? 'text-green-400' : goalMissed ? 'text-red-400' : 'text-gray-500'}>
                            {goalPct}%
                          </span>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${goalPct}%`,
                              background: goalMet
                                ? '#22c55e'
                                : goalMissed
                                ? '#ef4444'
                                : 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Manual Log Modal for missed/past sessions */}
      <ManualLogModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSaved={load}
        userName={userName}
      />
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────────────────────────

function StatCard({ label, value, accent }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-base font-bold tabular-nums font-mono ${accent ? 'text-orange-400' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function GoalBadge({ type }) {
  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
        type === 'met'
          ? 'text-green-400 bg-green-400/10 border border-green-400/20'
          : 'text-red-400 bg-red-400/10 border border-red-400/20'
      }`}
    >
      {type === 'met' ? '✓ Goal Met' : '✗ Missed'}
    </span>
  )
}

function SessionMiniCard({ totalSeconds, sessions }) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return (
    <div className="w-20 h-12 rounded-lg border border-[#2a2a2a] bg-[#111] flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
      <span className="text-white font-mono font-bold text-sm leading-none">
        {h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`}
      </span>
      <span className="text-gray-600 text-[9px] mt-0.5">
        {sessions} session{sessions !== 1 ? 's' : ''}
      </span>
    </div>
  )
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

// ── Weekly 7-day Chart ────────────────────────────────────────────────────────
function WeeklyChart({ data }) {
  const maxSec = Math.max(...data.map((d) => d.seconds), 1)

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-white">Last 7 Days</p>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d) => {
          const pct = d.seconds / maxSec
          const h = Math.floor(d.seconds / 3600)
          const m = Math.floor((d.seconds % 3600) / 60)
          const label = d.seconds > 0 ? (h > 0 ? `${h}h` : `${m}m`) : ''

          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              {/* Label above bar */}
              <span className="text-[9px] text-gray-600 tabular-nums h-3">
                {label}
              </span>
              {/* Bar */}
              <div className="w-full flex-1 flex items-end rounded-sm overflow-hidden bg-[#2a2a2a]">
                <div
                  className="w-full rounded-sm transition-all duration-500"
                  style={{
                    height: pct > 0 ? `${Math.max(8, Math.round(pct * 100))}%` : '0%',
                    background: d.isToday
                      ? 'linear-gradient(180deg, #a78bfa, #7c3aed)'
                      : d.seconds > 0
                      ? '#3b3b3b'
                      : 'transparent',
                  }}
                />
              </div>
              {/* Day label */}
              <span className={`text-[10px] tabular-nums ${d.isToday ? 'text-purple-400 font-bold' : 'text-gray-600'}`}>
                {d.dayLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getLast7DaysData(dateGroups) {
  const map = {}
  for (const g of dateGroups) map[g.date] = g.totalSeconds

  const result = []
  const dayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
  const today = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const y = d.getFullYear()
    const mo = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${mo}-${dy}`
    result.push({
      date: dateStr,
      dayLabel: dayLabels[d.getDay()],
      seconds: map[dateStr] || 0,
      isToday: i === 0,
    })
  }
  return result
}

function ManualLogModal({ isOpen, onClose, onSaved, userName }) {
  const [date, setDate] = useState(todayString())
  const [hours, setHours] = useState('1')
  const [minutes, setMinutes] = useState('0')
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSave = async (e) => {
    e.preventDefault()
    const h = parseInt(hours, 10) || 0
    const m = parseInt(minutes, 10) || 0
    const totalSec = h * 3600 + m * 60

    if (totalSec <= 0) {
      setError('Please enter at least 1 minute of study time.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const hStr = String(h).padStart(2, '0')
      const mStr = String(m).padStart(2, '0')
      await saveSession({
        userName,
        date,
        totalTime: `${hStr}:${mStr}:00.00`,
        totalSeconds: totalSec,
        laps: [],
        screenshotUrl: '',
        focusScore: 5,
        reflectionTag: '🔥 Deep Focus',
        notes: notes.trim() || 'Manual study session log',
        subject: subject.trim() || 'Self Study',
        topic: topic.trim(),
      })
      onSaved()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to save session. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="card w-full max-w-sm p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">⏱️</span>
            <h2 className="text-sm font-bold text-white">Log Past Study Session</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#222]"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {/* Date Picker */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Study Date</label>
            <input
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500"
              required
            />
          </div>

          {/* Time: Hours & Minutes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Duration Studied</label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">hours</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">mins</span>
              </div>
            </div>
          </div>

          {/* Subject & Topic */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Subject (Optional)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Math"
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Topic (Optional)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Number System"
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs text-gray-400 block mb-1">Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you study during this session?"
              className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 pill-btn h-9 text-xs bg-[#222] text-gray-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 pill-btn h-9 text-xs"
              style={{ background: '#8b5cf6', color: 'white', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
