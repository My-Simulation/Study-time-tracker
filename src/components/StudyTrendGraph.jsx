/**
 * StudyTrendGraph.jsx
 * Ultra-sleek, interactive day-by-day study hours and goal comparison graph.
 * Features:
 * - Timeframe Toggle: 7 Days (Weekly), 14 Days, This Month (30 Days)
 * - Studied Hours vs Target Goal Benchmark
 * - Neon Gradient Bars with Goal Met indicators (✓ / 🔥)
 * - Sunday Rest Day streak-shield protection visual (🛡️)
 * - Interactive Day Inspector (tap/hover to see exact hours, target delta, and status)
 * - Summary KPI chips: Total Studied, Daily Avg, Goals Met Ratio, Best Day Record
 * - Pure SVG & Tailwind, 100% responsive and zero external bloat.
 */

import React, { useState, useMemo } from 'react'
import { getTargetForDate } from '../utils/firestoreHelpers'
import { todayString, formatDuration } from '../utils/formatTime'

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function StudyTrendGraph({
  allSessions = [],
  weeklyPlan = {},
  dayPlanners = {},
  settings = {},
  selectedYear,
  selectedMonth, // 0-indexed
}) {
  const [timeframe, setTimeframe] = useState('7d') // '7d' | '14d' | 'month'
  const today = todayString()

  // Map all sessions by YYYY-MM-DD
  const sessionsByDate = useMemo(() => {
    const map = {}
    for (const s of allSessions) {
      if (!s.date) continue
      map[s.date] = (map[s.date] || 0) + (Number(s.totalSeconds) || 0)
    }
    return map
  }, [allSessions])

  // Build the list of dates based on selected timeframe
  const chartDays = useMemo(() => {
    const days = []
    const todayObj = new Date()

    if (timeframe === '7d' || timeframe === '14d') {
      const count = timeframe === '7d' ? 7 : 14
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(todayObj)
        d.setDate(d.getDate() - i)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dayNum = String(d.getDate()).padStart(2, '0')
        const dateStr = `${y}-${m}-${dayNum}`

        days.push({
          date: dateStr,
          dateObj: d,
          dayOfWeek: WEEKDAY_NAMES[d.getDay()],
          dayOfMonth: d.getDate(),
          monthLabel: MONTH_SHORT[d.getMonth()],
          isToday: dateStr === today,
        })
      }
    } else {
      // Month view: days in selectedMonth/selectedYear (or current month if not specified)
      const yr = selectedYear || todayObj.getFullYear()
      const mo = selectedMonth !== undefined ? selectedMonth : todayObj.getMonth()
      const totalDays = new Date(yr, mo + 1, 0).getDate()

      for (let day = 1; day <= totalDays; day++) {
        const d = new Date(yr, mo, day)
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const dayNum = String(day).padStart(2, '0')
        const dateStr = `${y}-${m}-${dayNum}`

        days.push({
          date: dateStr,
          dateObj: d,
          dayOfWeek: WEEKDAY_NAMES[d.getDay()],
          dayOfMonth: day,
          monthLabel: MONTH_SHORT[mo],
          isToday: dateStr === today,
        })
      }
    }

    // Populate study and target metrics for each day
    return days.map((day) => {
      const studiedSec = sessionsByDate[day.date] || 0
      const studiedHours = studiedSec / 3600
      const target = getTargetForDate(day.date, weeklyPlan, dayPlanners, settings)

      const targetMinutes = target?.targetMinutes || 0
      const targetSec = targetMinutes * 60
      const targetHours = targetMinutes / 60
      const isRest = Boolean(target?.isRestDay)

      const isAchieved = !isRest && targetSec > 0 && studiedSec >= targetSec
      const pct = isRest
        ? (studiedSec > 0 ? 100 : 0)
        : targetSec > 0
        ? Math.round((studiedSec / targetSec) * 100)
        : (studiedSec > 0 ? 100 : 0)

      return {
        ...day,
        studiedSec,
        studiedHours,
        targetSec,
        targetHours,
        isRest,
        isAchieved,
        pct,
      }
    })
  }, [timeframe, sessionsByDate, weeklyPlan, dayPlanners, settings, selectedYear, selectedMonth, today])

  // Summary statistics for selected timeframe
  const stats = useMemo(() => {
    let totalSec = 0
    let daysWithStudy = 0
    let goalsMet = 0
    let activeGoalDays = 0
    let bestDay = null

    for (const d of chartDays) {
      totalSec += d.studiedSec
      if (d.studiedSec > 0) {
        daysWithStudy++
        if (!bestDay || d.studiedSec > bestDay.studiedSec) {
          bestDay = d
        }
      }
      if (!d.isRest && d.targetSec > 0) {
        activeGoalDays++
        if (d.studiedSec >= d.targetSec) {
          goalsMet++
        }
      }
    }

    const passedDays = chartDays.filter((d) => d.date <= today).length || 1
    const avgSecPerDay = Math.round(totalSec / passedDays)

    return {
      totalSec,
      totalHours: (totalSec / 3600).toFixed(1),
      avgHours: (avgSecPerDay / 3600).toFixed(1),
      avgSecPerDay,
      goalsMet,
      activeGoalDays,
      goalSuccessRate: activeGoalDays > 0 ? Math.round((goalsMet / activeGoalDays) * 100) : 0,
      bestDay,
    }
  }, [chartDays, today])

  // Highest value for Y-axis scale (at least 8 hours for pleasing visual balance)
  const maxScaleHours = useMemo(() => {
    let max = 8
    for (const d of chartDays) {
      if (d.studiedHours > max) max = d.studiedHours
      if (d.targetHours > max) max = d.targetHours
    }
    return Math.ceil(max * 1.15) // +15% head room for bar badges
  }, [chartDays])

  // Active / Selected Day for inspection (defaults to today or best day)
  const [selectedDate, setSelectedDate] = useState(() => {
    return today
  })

  const activeDay = useMemo(() => {
    const found = chartDays.find((d) => d.date === selectedDate)
    return found || chartDays[chartDays.length - 1] || null
  }, [chartDays, selectedDate])

  return (
    <div className="bg-[#12121a]/95 border border-[#26263b] rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden backdrop-blur-xl transition-all">
      {/* Background ambient neon glow */}
      <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* ── Header & Timeframe Switcher ── */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#222234]">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-sm">
              📊
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-white tracking-tight">
              Study Hours & Goal Trends
            </h3>
          </div>
          <p className="text-[11px] text-gray-400 mt-0.5">
            Daily focus hours compared against planned study targets
          </p>
        </div>

        {/* Timeframe Selector Pill */}
        <div className="inline-flex p-1 rounded-xl bg-[#181824] border border-[#2b2b3e] self-start sm:self-auto shadow-inner">
          <button
            type="button"
            onClick={() => setTimeframe('7d')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === '7d'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('14d')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === '14d'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            14 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              timeframe === 'month'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Month View
          </button>
        </div>
      </div>

      {/* ── Quick KPI Stat Badges ── */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-4">
        <div className="p-2.5 rounded-2xl bg-[#161622] border border-[#252538] flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Studied</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-lg font-black font-mono text-white">
              {stats.totalHours}
            </span>
            <span className="text-[10px] text-purple-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-0.5 truncate">{formatDuration(stats.totalSec)} total</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-[#161622] border border-[#252538] flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Daily Average</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-lg font-black font-mono text-cyan-300">
              {stats.avgHours}
            </span>
            <span className="text-[10px] text-cyan-400 font-semibold">hrs/day</span>
          </div>
          <span className="text-[10px] text-gray-500 mt-0.5 truncate">{formatDuration(stats.avgSecPerDay)} / day</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-[#161622] border border-[#252538] flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Goals Met</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-lg font-black font-mono text-emerald-400">
              {stats.goalsMet}
            </span>
            <span className="text-[10px] text-emerald-300 font-semibold">/ {stats.activeGoalDays} days</span>
          </div>
          <span className="text-[10px] text-emerald-400/80 mt-0.5 font-medium">{stats.goalSuccessRate}% success</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-[#161622] border border-[#252538] flex flex-col justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Best Record</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-base sm:text-lg font-black font-mono text-amber-300">
              {stats.bestDay ? (stats.bestDay.studiedHours).toFixed(1) : '0'}
            </span>
            <span className="text-[10px] text-amber-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-gray-400 mt-0.5 truncate">
            {stats.bestDay ? `${stats.bestDay.dayOfMonth} ${stats.bestDay.monthLabel} 🔥` : 'No study yet'}
          </span>
        </div>
      </div>

      {/* ── Active Day Inspector Card (Reveals details on click/hover) ── */}
      {activeDay && (
        <div className="relative z-10 mb-4 p-3 rounded-2xl bg-gradient-to-r from-[#181828] via-[#1a1728] to-[#161b28] border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shadow-sm ${
              activeDay.isRest
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : activeDay.isAchieved
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : activeDay.isToday
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
            }`}>
              {activeDay.isRest ? '🛡️' : activeDay.isAchieved ? '🎉' : activeDay.isToday ? '⚡' : '📅'}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white">
                  {activeDay.dayOfWeek}, {activeDay.dayOfMonth} {activeDay.monthLabel}
                </span>
                {activeDay.isToday && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold uppercase tracking-wider">
                    Today
                  </span>
                )}
                {activeDay.isRest && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    Rest Shield
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400 block mt-0.5">
                {activeDay.isRest
                  ? 'Sunday Buffer & Rest Day — Streak Shielded'
                  : activeDay.isAchieved
                  ? `Goal Exceeded by +${formatDuration(activeDay.studiedSec - activeDay.targetSec)}! Superb Focus!`
                  : activeDay.studiedSec > 0
                  ? `Progress: ${activeDay.pct}% of target reached`
                  : 'No study recorded for this day'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs font-black font-mono text-white block">
                {formatDuration(activeDay.studiedSec)}
              </span>
              <span className="text-[10px] text-gray-400 block">
                Target: {activeDay.targetHours > 0 ? `${activeDay.targetHours}h` : 'Rest'}
              </span>
            </div>
            <div className="text-right pl-3 border-l border-[#2e2e42]">
              <span className={`text-xs font-black font-mono ${
                activeDay.isAchieved ? 'text-green-400' : activeDay.studiedSec > 0 ? 'text-teal-300' : 'text-gray-500'
              }`}>
                {activeDay.pct}%
              </span>
              <span className="text-[10px] text-gray-400 block">Achieved</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Bar Graph Area ── */}
      <div className="relative z-10 w-full overflow-x-auto pb-2 scrollbar-none">
        <div
          className="min-w-full flex flex-col justify-end"
          style={{ minWidth: timeframe === 'month' ? '680px' : '100%', height: '220px' }}
        >
          {/* Chart Y-Axis Gridlines & Reference Markers */}
          <div className="relative w-full h-[175px] border-b border-[#28283c] flex items-end">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between">
              <div className="border-b border-[#1e1e2d] w-full flex items-center justify-between text-[9px] text-gray-600 font-mono">
                <span>{maxScaleHours}h</span>
              </div>
              <div className="border-b border-[#1e1e2d] w-full flex items-center justify-between text-[9px] text-gray-600 font-mono">
                <span>{Math.round(maxScaleHours * 0.66)}h</span>
              </div>
              <div className="border-b border-[#1e1e2d] w-full flex items-center justify-between text-[9px] text-gray-600 font-mono">
                <span>{Math.round(maxScaleHours * 0.33)}h</span>
              </div>
              <div className="w-full flex items-center justify-between text-[9px] text-gray-600 font-mono">
                <span>0h</span>
              </div>
            </div>

            {/* Bars Container */}
            <div className="relative z-10 w-full h-full flex items-end justify-between gap-1 sm:gap-2 px-1">
              {chartDays.map((day) => {
                const heightPct = Math.min(100, Math.max(3, (day.studiedHours / maxScaleHours) * 100))
                const isSelected = activeDay?.date === day.date
                const hasHours = day.studiedSec > 0

                // Direct CSS gradient & glow styling
                let backgroundStyle = '#20202e'
                let glowColor = 'none'

                if (hasHours) {
                  if (day.isAchieved) {
                    backgroundStyle = 'linear-gradient(180deg, #34d399 0%, #10b981 60%, #059669 100%)'
                    glowColor = '0 0 14px rgba(16, 185, 129, 0.55)'
                  } else if (day.isToday) {
                    backgroundStyle = 'linear-gradient(180deg, #22d3ee 0%, #0ea5e9 60%, #3b82f6 100%)'
                    glowColor = '0 0 14px rgba(6, 182, 212, 0.55)'
                  } else if (day.isRest) {
                    backgroundStyle = 'linear-gradient(180deg, #c084fc 0%, #9333ea 60%, #7e22ce 100%)'
                    glowColor = '0 0 14px rgba(168, 85, 247, 0.45)'
                  } else {
                    backgroundStyle = 'linear-gradient(180deg, #a855f7 0%, #7c3aed 60%, #4f46e5 100%)'
                    glowColor = isSelected ? '0 0 12px rgba(124, 58, 237, 0.5)' : 'none'
                  }
                }

                // Target indicator line position
                const targetHeightPct = day.targetHours > 0
                  ? Math.min(100, (day.targetHours / maxScaleHours) * 100)
                  : 0

                return (
                  <div
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                    onMouseEnter={() => setSelectedDate(day.date)}
                    className="flex-1 flex flex-col items-center justify-end h-full group cursor-pointer relative"
                    style={{ minWidth: timeframe === 'month' ? '18px' : 'auto' }}
                  >
                    {/* Floating top badge: fire if target achieved, or target hours indicator */}
                    <div className="mb-1.5 flex flex-col items-center">
                      {day.isAchieved ? (
                        <span className="text-[11px] leading-none animate-bounce" title="Goal Met!">
                          🔥
                        </span>
                      ) : day.isRest && hasHours ? (
                        <span className="text-[10px] leading-none text-purple-300 font-bold" title="Bonus study on rest day">
                          +
                        </span>
                      ) : hasHours && timeframe !== 'month' ? (
                        <span className="text-[9px] font-mono text-gray-400 tabular-nums leading-none">
                          {day.studiedHours >= 1 ? `${day.studiedHours.toFixed(1)}h` : `${Math.round(day.studiedSec / 60)}m`}
                        </span>
                      ) : null}
                    </div>

                    {/* Bar Pillar */}
                    <div className="w-full relative flex items-end justify-center h-full">
                      {/* Optional Target Benchmark Tick */}
                      {targetHeightPct > 0 && (
                        <div
                          className="absolute w-full z-20 pointer-events-none flex items-center justify-center"
                          style={{ bottom: `${targetHeightPct}%` }}
                          title={`Target: ${day.targetHours}h`}
                        >
                          <div className="w-full h-[2px] bg-cyan-300/60 shadow-sm" />
                        </div>
                      )}

                      {/* Actual Filled Bar */}
                      <div
                        className={`w-full max-w-[28px] rounded-t-xl transition-all duration-500 relative ${
                          isSelected
                            ? 'ring-2 ring-white/80 scale-[1.04]'
                            : 'hover:opacity-95'
                        }`}
                        style={{
                          height: hasHours ? `${heightPct}%` : '4px',
                          background: backgroundStyle,
                          boxShadow: glowColor,
                        }}
                      >
                        {/* Shimmer overlay on active/today bar */}
                        {day.isToday && hasHours && (
                          <div className="absolute inset-0 rounded-t-xl bg-white/20 animate-pulse pointer-events-none" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Bottom Day Labels */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 px-1 pt-2 w-full">
            {chartDays.map((day) => {
              const isSelected = activeDay?.date === day.date
              return (
                <div
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex-1 text-center cursor-pointer transition-all ${
                    isSelected ? 'scale-105' : ''
                  }`}
                  style={{ minWidth: timeframe === 'month' ? '18px' : 'auto' }}
                >
                  <span
                    className={`block text-[10px] font-bold tabular-nums leading-tight ${
                      day.isToday
                        ? 'text-cyan-400 font-extrabold'
                        : isSelected
                        ? 'text-white'
                        : 'text-gray-400'
                    }`}
                  >
                    {timeframe === 'month' ? day.dayOfMonth : day.dayOfWeek}
                  </span>
                  {timeframe !== 'month' && (
                    <span className="block text-[9px] text-gray-500 tabular-nums">
                      {day.dayOfMonth}
                    </span>
                  )}
                  {day.isToday && (
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mx-auto mt-0.5 shadow-sm shadow-cyan-400" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legend Footer */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#222234] mt-2 text-[11px] text-gray-400">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-400 to-teal-500" />
            <span>Goal Achieved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-purple-500 to-indigo-600" />
            <span>Studied Hours</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-[2px] bg-cyan-300/80" />
            <span>Target Benchmark</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>🛡️</span>
            <span>Rest Shield</span>
          </div>
        </div>

        <span className="text-[10px] text-gray-500 italic">
          💡 Tap any bar to view detailed hours & delta
        </span>
      </div>
    </div>
  )
}
