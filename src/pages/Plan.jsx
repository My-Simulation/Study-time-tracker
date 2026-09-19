/**
 * Plan.jsx
 * Weekly study plan page.
 * Enhanced:
 *  - Real-time Day-Wise Target vs. Actual study time comparison for each day
 *  - Target Met / Missed / In Progress completion status badges & progress bars
 *  - Automatic sync with Day Planner target hours ("vahi target vahan aaye")
 *  - Week navigation (Current Week, Previous/Next Week)
 *  - Weekly performance overview (Total Target vs Total Studied, Days Completed dots)
 *  - Direct links to Day Planner sheets
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  saveWeeklyPlan, getWeeklyPlan,
  getUserSessions, getAllDayPlanners,
  saveDayPlanner, getDayPlanner,
  syncTargetHours,
} from '../utils/firestoreHelpers'
import { formatHoursMinutes, todayString } from '../utils/formatTime'

const DAYS = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' },
]

const TODAY_KEY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]

const DEFAULT_PLAN = Object.fromEntries(
  DAYS.map(({ key }) => [key, { targetMinutes: 0, subjects: '' }])
)

/**
 * Calculates date info for each day of the week based on weekOffset (0 = this week).
 * Monday is treated as the first day of the week.
 */
function getWeekDates(weekOffset = 0) {
  const now = new Date()
  const currentDay = now.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
  const distToMonday = currentDay === 0 ? -6 : 1 - currentDay

  const monday = new Date(now)
  monday.setDate(now.getDate() + distToMonday + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  const toStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  const todayStr = todayString()

  const dates = {}
  DAYS.forEach(({ key }, idx) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + idx)
    const dateStr = toStr(d)
    dates[key] = {
      dateStr,
      dayNumber: d.getDate(),
      monthShort: d.toLocaleString('en-US', { month: 'short' }),
      formatted: `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' })}`,
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
      isFuture: dateStr > todayStr,
    }
  })

  // Start and end labels
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const rangeLabel = `${monday.getDate()} ${monday.toLocaleString('en-US', { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleString('en-US', { month: 'short' })} ${sunday.getFullYear()}`

  return { dates, rangeLabel }
}

export default function Plan({ userName }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [sessions, setSessions] = useState([])
  const [dayPlanners, setDayPlanners] = useState({})
  const [weekOffset, setWeekOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const { dates: weekDates, rangeLabel } = useMemo(
    () => getWeekDates(weekOffset),
    [weekOffset]
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [existingPlan, userSessions, allDayPlans] = await Promise.all([
        getWeeklyPlan(userName),
        getUserSessions(userName),
        getAllDayPlanners(userName),
      ])

      const merged = { ...DEFAULT_PLAN, ...(existingPlan || {}) }

      // If viewing current week, sync Day Planner target hours into weekly view ("vahi target vahan aaye")
      if (weekOffset === 0 && allDayPlans) {
        DAYS.forEach(({ key }) => {
          const dStr = weekDates[key]?.dateStr
          if (dStr && Number(allDayPlans[dStr]?.targetHours) > 0) {
            merged[key] = {
              ...merged[key],
              targetMinutes: Math.round(Number(allDayPlans[dStr].targetHours) * 60),
            }
          }
        })
      }

      setPlan(merged)
      setSessions(userSessions || [])
      setDayPlanners(allDayPlans || {})
    } catch (err) {
      console.error('Plan load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userName, weekOffset, weekDates])

  useEffect(() => {
    load()
  }, [load])

  // Real-time synchronization listeners across tabs & pages
  useEffect(() => {
    const handleUpdate = () => {
      load()
    }
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
    }
  }, [load])

  const handleHoursChange = (dayKey, minutes) => {
    setPlan((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], targetMinutes: minutes },
    }))
    setSaved(false)
  }

  // Instant sync when slider is released/touched
  const handleSliderRelease = async (dayKey, minutes) => {
    const dStr = weekDates[dayKey]?.dateStr
    const targetHours = Number((minutes / 60).toFixed(2))
    if (dStr && userName) {
      try {
        await syncTargetHours(userName, dStr, targetHours)
      } catch (e) {
        console.warn('Auto-sync target failed:', e)
      }
    }
  }

  const handleSubjectsChange = (dayKey, subjects) => {
    setPlan((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], subjects },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Save weekly plan template
      await saveWeeklyPlan(userName, plan)

      // 2. Synchronize target hours into Day Planner sheets for the entire active week
      const syncPromises = DAYS.map(async ({ key }) => {
        const dStr = weekDates[key]?.dateStr
        const targetMin = plan[key]?.targetMinutes || 0
        const targetHours = Number((targetMin / 60).toFixed(2))
        if (dStr) {
          try {
            const existingDayPlan = await getDayPlanner(userName, dStr)
            const updated = existingDayPlan
              ? { ...existingDayPlan, targetHours }
              : { date: dStr, targetHours, goals: ['', '', ''], rows: [] }
            await saveDayPlanner(userName, dStr, updated)
          } catch (e) {
            console.warn(`Could not sync to day planner for ${dStr}:`, e)
          }
        }
      })
      await Promise.all(syncPromises)

      // 3. Broadcast real-time update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('study_plan_updated', { detail: { userName, weeklyPlan: plan } })
        )
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save plan error:', err)
      alert('Failed to save. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  // Calculate weekly totals
  const weeklyStats = useMemo(() => {
    let totalTargetMinutes = 0
    let totalStudiedSeconds = 0
    let daysGoalMet = 0
    let daysWithTarget = 0

    DAYS.forEach(({ key }) => {
      const d = plan[key] || { targetMinutes: 0 }
      const targetMin = d.targetMinutes || 0
      totalTargetMinutes += targetMin

      const dateStr = weekDates[key]?.dateStr
      const daySec = sessions
        .filter((s) => s.date === dateStr)
        .reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

      totalStudiedSeconds += daySec

      if (targetMin > 0) {
        daysWithTarget++
        if (daySec >= targetMin * 60) {
          daysGoalMet++
        }
      }
    })

    const totalTargetSeconds = totalTargetMinutes * 60
    const overallPct = totalTargetSeconds > 0
      ? Math.min(100, Math.round((totalStudiedSeconds / totalTargetSeconds) * 100))
      : 0

    return {
      totalTargetMinutes,
      totalStudiedSeconds,
      daysGoalMet,
      daysWithTarget,
      overallPct,
    }
  }, [plan, sessions, weekDates])

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
          onClick={() => navigate('/planner')}
          className="text-xs px-3 py-1 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/30 hover:bg-pink-500/20 transition-all font-medium flex items-center gap-1.5"
        >
          <span>🌸</span><span>Day Planner Sheet</span>
        </button>
      </div>

      {/* Header */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📅</span> Weekly Study Plan
          </h1>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Set daily targets & track whether you hit your goals each day.
        </p>
      </div>

      {/* Week Navigator */}
      <div className="px-4 pb-2 max-w-lg mx-auto w-full">
        <div className="card p-2.5 flex items-center justify-between bg-[#141414] border border-[#262626]">
          <button
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-1.5 rounded-lg hover:bg-[#222] text-gray-400 hover:text-white transition-all text-xs flex items-center gap-1"
          >
            <span>←</span><span>Prev Week</span>
          </button>

          <div className="text-center">
            <span className="text-xs font-bold text-white block">
              {rangeLabel}
            </span>
            {weekOffset === 0 ? (
              <span className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">
                Current Week
              </span>
            ) : (
              <button
                onClick={() => setWeekOffset(0)}
                className="text-[10px] text-pink-400 underline font-medium"
              >
                Jump to Current Week
              </button>
            )}
          </div>

          <button
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-1.5 rounded-lg hover:bg-[#222] text-gray-400 hover:text-white transition-all text-xs flex items-center gap-1"
          >
            <span>Next Week</span><span>→</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-4 pb-28 max-w-lg mx-auto w-full gap-3">

          {/* Weekly Performance Summary Card */}
          <div className="card p-4 flex flex-col gap-3.5 bg-gradient-to-br from-[#161228] to-[#121212] border border-purple-500/30 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-purple-300 font-bold uppercase tracking-wider block">
                  Weekly Target vs Actual
                </span>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {weeklyStats.daysGoalMet} of {weeklyStats.daysWithTarget} days with goals achieved
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-white text-base">
                  {formatHoursMinutes(weeklyStats.totalStudiedSeconds)}
                  <span className="text-gray-400 text-xs font-normal"> / {formatHoursLabel(weeklyStats.totalTargetMinutes)}</span>
                </span>
                <span className="block text-[11px] text-purple-400 font-semibold">
                  {weeklyStats.overallPct}% weekly completion
                </span>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="relative h-2 rounded-full bg-[#201c30] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${weeklyStats.overallPct}%`,
                  background: weeklyStats.overallPct >= 100
                    ? 'linear-gradient(90deg, #10b981, #22c55e)'
                    : 'linear-gradient(90deg, #7c3aed, #ec4899)',
                }}
              />
            </div>

            {/* Day indicator dots */}
            <div className="grid grid-cols-7 gap-1 pt-1 border-t border-[#262138]">
              {DAYS.map(({ key }) => {
                const dayDate = weekDates[key]
                const d = plan[key] || { targetMinutes: 0 }
                const targetSec = (d.targetMinutes || 0) * 60
                const daySec = sessions
                  .filter((s) => s.date === dayDate.dateStr)
                  .reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

                const isMet = targetSec > 0 && daySec >= targetSec
                const isMissed = targetSec > 0 && daySec < targetSec && dayDate.isPast
                const isToday = dayDate.isToday

                let dotColor = 'bg-[#222] text-gray-500'
                if (isMet) dotColor = 'bg-green-500/20 text-green-400 border border-green-500/40'
                else if (isMissed) dotColor = 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                else if (isToday) dotColor = 'bg-purple-500/30 text-purple-300 border border-purple-500'

                return (
                  <div key={key} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] text-gray-500 font-medium">
                      {key}
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${dotColor}`}>
                      {isMet ? '✓' : isMissed ? '✕' : dayDate.dayNumber}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Day cards */}
          {DAYS.map(({ key, label }) => {
            const d = plan[key] || { targetMinutes: 0, subjects: '' }
            const dayDate = weekDates[key] || {}
            const isToday = dayDate.isToday
            const isPast = dayDate.isPast

            const hours = Math.floor(d.targetMinutes / 60)
            const mins = d.targetMinutes % 60
            const displayH = hours > 0 ? `${hours}h` : ''
            const displayM = mins > 0 ? `${mins}m` : ''
            const targetDisplayTime = displayH + (displayH && displayM ? ' ' : '') + displayM || '0h'

            // Actual study time from saved sessions on this date
            const dayActualSec = sessions
              .filter((s) => s.date === dayDate.dateStr)
              .reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

            const targetSec = d.targetMinutes * 60
            const pct = targetSec > 0 ? Math.min(100, Math.round((dayActualSec / targetSec) * 100)) : 0
            const isGoalMet = targetSec > 0 && dayActualSec >= targetSec
            const isGoalMissed = targetSec > 0 && dayActualSec < targetSec && isPast

            const daySheet = dayPlanners[dayDate.dateStr]

            return (
              <div
                key={key}
                className={`card p-4 flex flex-col gap-3 transition-all relative overflow-hidden ${
                  isToday ? 'ring-1 ring-purple-500/50 bg-[#16112a]' : ''
                }`}
                style={
                  isToday
                    ? { borderColor: 'rgba(139, 92, 246, 0.4)' }
                    : isGoalMet
                    ? { borderColor: 'rgba(34, 197, 94, 0.25)' }
                    : {}
                }
              >
                {/* Day Header Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      {label}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      · {dayDate.formatted}
                    </span>
                    {isToday && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/40">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Goal Status Badge */}
                  {targetSec > 0 ? (
                    isGoalMet ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/30 flex items-center gap-1">
                        ✓ Goal Met! 🎉
                      </span>
                    ) : isGoalMissed ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        ❌ Missed
                      </span>
                    ) : isToday ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        ⏳ In Progress ({pct}%)
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#222] text-gray-400 border border-[#333]">
                        📅 Target Set
                      </span>
                    )
                  ) : dayActualSec > 0 ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                      Studied {formatHoursMinutes(dayActualSec)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-gray-500">
                      No Target
                    </span>
                  )}
                </div>

                {/* Target vs Actual Metrics */}
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Target:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {targetDisplayTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Actual Studied:</span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        isGoalMet
                          ? 'text-green-400'
                          : isGoalMissed
                          ? 'text-rose-400'
                          : dayActualSec > 0
                          ? 'text-purple-300'
                          : 'text-gray-500'
                      }`}
                    >
                      {formatHoursMinutes(dayActualSec)}
                    </span>
                    {targetSec > 0 && (
                      <span className="text-[11px] text-gray-400">
                        ({pct}%)
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {targetSec > 0 && (
                  <div className="relative h-2 rounded-full bg-[#222] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: isGoalMet
                          ? 'linear-gradient(90deg, #10b981, #22c55e)'
                          : isGoalMissed
                          ? 'linear-gradient(90deg, #f43f5e, #e11d48)'
                          : 'linear-gradient(90deg, #7c3aed, #ec4899)',
                      }}
                    />
                  </div>
                )}

                {/* Hours slider */}
                <div className="flex flex-col gap-1 pt-1">
                  <div className="flex justify-between text-[11px] text-gray-500">
                    <span>0h</span>
                    <span>4h</span>
                    <span>8h</span>
                    <span>12h</span>
                    <span>16h</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={960}
                    step={30}
                    value={d.targetMinutes}
                    onChange={(e) => handleHoursChange(key, Number(e.target.value))}
                    onPointerUp={(e) => handleSliderRelease(key, Number(e.target.value))}
                    onTouchEnd={(e) => handleSliderRelease(key, Number(e.target.value))}
                    className="w-full accent-purple-500 cursor-pointer"
                    style={{ accentColor: '#8b5cf6' }}
                  />
                </div>

                {/* Subjects input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Subjects / topics planned for this day (e.g. Physics, Chemistry)"
                    value={d.subjects}
                    onChange={(e) => handleSubjectsChange(key, e.target.value)}
                    className="flex-1 rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-3 py-2 text-xs outline-none focus:border-purple-500 transition-colors"
                  />
                </div>

                {/* Day Planner Sheet Link if active/saved */}
                {daySheet && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#242424] text-[11px]">
                    <span className="text-gray-400 flex items-center gap-1">
                      <span>🌸</span>
                      <span>Day {daySheet.dayNumber || 1} Planner Sheet exists</span>
                    </span>
                    <button
                      onClick={() => navigate('/planner')}
                      className="text-pink-400 hover:text-pink-300 font-semibold hover:underline"
                    >
                      Open Day Sheet →
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Fixed bottom save button */}
      <div
        className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 max-w-lg mx-auto w-full backdrop-blur-md"
        style={{ background: 'linear-gradient(to top, #0d0d0d 80%, transparent)' }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="pill-btn w-full shadow-lg"
          style={{
            background: saved ? '#22c55e' : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
            color: 'white',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving & Syncing…' : saved ? '✓ Weekly Plan Saved & Synced!' : 'Save Weekly Plan'}
        </button>
      </div>
    </div>
  )
}

function formatHoursLabel(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0 && m === 0) return '0h'
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
