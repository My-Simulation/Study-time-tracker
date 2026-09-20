/**
 * Analytics.jsx — Study Analytics Dashboard inspired by groupstudytimer.com
 * Features:
 * - Year & Month selector
 * - Today's Goal Progress Hero Banner with live timer sync
 * - 4 Primary KPI Cards: Total Study Time, Total Sessions, Avg Duration, Productivity Score
 * - 3 Secondary Visual Cards: Daily Average ring, Goal Achievement meter, Best Streak flames
 * - Subject Distribution & Topic breakdown
 * - Responsive, deep dark aesthetic matching #0d0d0d
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getUserSessions,
  getWeeklyPlan,
  getAllDayPlanners,
  calculateStreaks,
  groupSessionsByDate,
  getTargetForDate,
  getUserSettings,
  isRestDay,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration } from '../utils/formatTime'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Analytics({ userName }) {
  const navigate = useNavigate()
  const today = todayString()
  const [currentYear, currentMonthNum] = today.split('-').map(Number)

  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum - 1) // 0-indexed
  const [loading, setLoading] = useState(() => {
    if (!userName) return true
    try {
      return !localStorage.getItem(`stt_user_sessions_${userName.toLowerCase()}`)
    } catch {
      return true
    }
  })

  const [allSessions, setAllSessions] = useState(() => {
    if (!userName) return []
    try {
      const raw = localStorage.getItem(`stt_user_sessions_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return []
  })
  const [weeklyPlan, setWeeklyPlan] = useState(() => {
    if (!userName) return {}
    try {
      const raw = localStorage.getItem(`stt_user_doc_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw).weeklyPlan || {}
    } catch {}
    return {}
  })
  const [dayPlanners, setDayPlanners] = useState(() => {
    if (!userName) return {}
    try {
      const raw = localStorage.getItem(`stt_user_doc_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw).dayPlanners || {}
    } catch {}
    return {}
  })
  const [settings, setSettings] = useState(() => {
    if (!userName) return { sundayRestDay: false, effectiveFrom: null }
    try {
      const raw = localStorage.getItem(`stt_settings_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return { sundayRestDay: false, effectiveFrom: null }
  })

  // Load user data
  const fetchData = useCallback(async () => {
    if (!userName) return
    try {
      const [sessions, plan, planners, userSettings] = await Promise.all([
        getUserSessions(userName),
        getWeeklyPlan(userName),
        getAllDayPlanners(userName),
        getUserSettings(userName),
      ])
      setAllSessions(sessions || [])
      setWeeklyPlan(plan || {})
      setDayPlanners(planners || {})
      setSettings(userSettings || { sundayRestDay: false, effectiveFrom: null })
    } catch (err) {
      console.error('Error fetching analytics data:', err)
    } finally {
      setLoading(false)
    }
  }, [userName])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time synchronization listeners across tabs & pages
  useEffect(() => {
    const handleUpdate = () => {
      fetchData()
    }
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    window.addEventListener('study_settings_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
      window.removeEventListener('study_settings_updated', handleUpdate)
    }
  }, [fetchData])

  // Filter sessions for selected Year and Month
  const filteredSessions = useMemo(() => {
    const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
    return allSessions.filter((s) => s.date && s.date.startsWith(monthPrefix))
  }, [allSessions, selectedYear, selectedMonth])

  // All time groups for streak calculation
  const allDateGroups = useMemo(() => {
    return groupSessionsByDate(allSessions)
  }, [allSessions])

  const streaks = useMemo(() => {
    return calculateStreaks(allDateGroups, settings)
  }, [allDateGroups, settings])

  // Today's stats
  const todaySessions = useMemo(() => {
    return allSessions.filter((s) => s.date === today)
  }, [allSessions, today])

  const todayStudiedSec = useMemo(() => {
    let sec = todaySessions.reduce((acc, s) => acc + (s.totalSeconds || 0), 0)
    // If active stopwatch is running, also include its elapsed seconds for today
    if (userName) {
      try {
        const rawState = localStorage.getItem(`stt_stopwatch_state_${userName.toLowerCase()}`)
        if (rawState) {
          const parsed = JSON.parse(rawState)
          let activeElapsedMs = parsed.baseElapsed || 0
          if (parsed.isRunning && parsed.startTimestamp) {
            activeElapsedMs += Math.max(0, Date.now() - parsed.startTimestamp)
          }
          sec += Math.floor(activeElapsedMs / 1000)
        }
      } catch {}
    }
    return sec
  }, [todaySessions, userName])

  const isTodayRest = useMemo(() => {
    return isRestDay(today, settings)
  }, [today, settings])

  const todayTarget = useMemo(() => {
    return getTargetForDate(today, weeklyPlan, dayPlanners, settings)
  }, [today, weeklyPlan, dayPlanners, settings])

  const todayTargetSec = (todayTarget?.targetMinutes || 0) * 60
  const todayPct = isTodayRest
    ? 100
    : (todayTargetSec > 0 ? Math.min(100, Math.round((todayStudiedSec / todayTargetSec) * 100)) : 0)

  // Selected Month calculations
  const totalMonthSec = useMemo(() => {
    return filteredSessions.reduce((acc, s) => acc + (s.totalSeconds || 0), 0)
  }, [filteredSessions])

  const totalSessionsCount = filteredSessions.length

  const avgDurationSec = totalSessionsCount > 0
    ? Math.round(totalMonthSec / totalSessionsCount)
    : 0

  // Days in selected month
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate()
  }, [selectedYear, selectedMonth])

  // Month date groups
  const monthDateGroups = useMemo(() => {
    return groupSessionsByDate(filteredSessions)
  }, [filteredSessions])

  // Count days where target was achieved in selected month (excluding rest days from denominator)
  const { completedDaysCount, activePlannedDaysInMonth } = useMemo(() => {
    let completed = 0
    let activePlannedDays = 0

    // Group studied sec by date
    const dateMap = {}
    for (const s of filteredSessions) {
      dateMap[s.date] = (dateMap[s.date] || 0) + (s.totalSeconds || 0)
    }

    // Check every day of the month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isRest = isRestDay(dateStr, settings)
      if (isRest) {
        continue // Rest day is not a required study day
      }

      activePlannedDays++
      const target = getTargetForDate(dateStr, weeklyPlan, dayPlanners, settings)
      if (target && target.targetMinutes > 0) {
        const studied = dateMap[dateStr] || 0
        if (studied >= target.targetMinutes * 60) {
          completed++
        }
      } else if (dateMap[dateStr] && dateMap[dateStr] > 0) {
        completed++
      }
    }

    return { completedDaysCount: completed, activePlannedDaysInMonth: activePlannedDays }
  }, [filteredSessions, daysInMonth, selectedYear, selectedMonth, weeklyPlan, dayPlanners, settings])

  // Goal achievement percentage
  const goalAchievementRate = activePlannedDaysInMonth > 0
    ? Math.min(100, Math.round((completedDaysCount / activePlannedDaysInMonth) * 100))
    : 0

  // Daily average for this month (excluding scheduled rest days)
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === (currentMonthNum - 1)
  const passedDaysInMonth = useMemo(() => {
    const maxDay = isCurrentMonth ? Math.max(1, Math.min(daysInMonth, new Date().getDate())) : Math.max(1, daysInMonth)
    let count = 0
    for (let d = 1; d <= maxDay; d++) {
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      if (!isRestDay(dateStr, settings)) {
        count++
      }
    }
    return Math.max(1, count)
  }, [isCurrentMonth, daysInMonth, selectedYear, selectedMonth, settings])

  const dailyAverageSec = passedDaysInMonth > 0 ? Math.round(totalMonthSec / passedDaysInMonth) : 0

  // Expected daily goal
  const defaultDailyTargetSec = useMemo(() => {
    if (todayTarget?.targetMinutes && !isTodayRest) {
      return todayTarget.targetMinutes * 60
    }
    const monHours = weeklyPlan?.days?.[1]?.targetHours
    return (monHours ? Number(monHours) * 60 : 120) * 60
  }, [todayTarget, isTodayRest, weeklyPlan])

  const dailyAvgPct = defaultDailyTargetSec > 0
    ? Math.min(100, Math.round((dailyAverageSec / defaultDailyTargetSec) * 100))
    : 0

  // Productivity Score (0-100)
  const productivityScore = useMemo(() => {
    if (totalMonthSec === 0) return 0
    const regularity = Math.min(100, Math.round((monthDateGroups.length / passedDaysInMonth) * 100))
    const score = Math.round((goalAchievementRate * 0.5) + (regularity * 0.3) + (dailyAvgPct * 0.2))
    return Math.max(10, Math.min(100, score))
  }, [totalMonthSec, goalAchievementRate, monthDateGroups.length, passedDaysInMonth, dailyAvgPct])

  // Subject breakdown for this month
  const subjectBreakdown = useMemo(() => {
    const map = {}
    for (const s of filteredSessions) {
      const subj = (s.subject && s.subject.trim()) ? s.subject.trim() : 'General Study'
      map[subj] = (map[subj] || 0) + (s.totalSeconds || 0)
    }
    const list = Object.entries(map).map(([name, seconds]) => ({
      name,
      seconds,
      pct: totalMonthSec > 0 ? Math.round((seconds / totalMonthSec) * 100) : 0,
    }))
    return list.sort((a, b) => b.seconds - a.seconds)
  }, [filteredSessions, totalMonthSec])

  // Available years
  const availableYears = useMemo(() => {
    const years = new Set([currentYear])
    for (const s of allSessions) {
      if (s.date) {
        const y = parseInt(s.date.split('-')[0], 10)
        if (!isNaN(y)) years.add(y)
      }
    }
    return Array.from(years).sort((a, b) => b - a)
  }, [allSessions, currentYear])

  return (
    <div className="min-h-screen pb-16 bg-transparent" style={{ color: '#f5f5f5' }}>
      {/* ── Top Header Bar ── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3.5 border-b border-[#222]/80 backdrop-blur-md"
        style={{ background: 'rgba(13, 13, 13, 0.75)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[#1a1a1a] hover:bg-[#252525] border border-[#2e2e2e] transition-colors"
            title="Back to Timer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📈</span>
              <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-teal-300 via-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Study Analytics
              </h1>
            </div>
            <p className="text-[10px] text-gray-500">Track focus, trends & consistency</p>
          </div>
        </div>

        {/* Month & Year Filters */}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-xs text-gray-200 px-2.5 py-1.5 outline-none focus:border-cyan-500 cursor-pointer font-medium"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-lg bg-[#1a1a1a] border border-[#2e2e2e] text-xs text-cyan-300 px-2.5 py-1.5 outline-none focus:border-cyan-500 cursor-pointer font-semibold"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* ── Today's Goal Progress Hero Banner ── */}
        <div
          className="rounded-2xl p-4 border transition-all relative overflow-hidden"
          style={{
            background: isTodayRest
              ? 'linear-gradient(135deg, rgba(147, 51, 234, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
            borderColor: isTodayRest
              ? 'rgba(168, 85, 247, 0.4)'
              : todayPct >= 100
              ? 'rgba(34, 197, 94, 0.4)'
              : 'rgba(45, 212, 191, 0.25)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                isTodayRest ? 'bg-purple-500/15 border border-purple-500/30' : 'bg-teal-500/10 border border-teal-500/30'
              }`}>
                {isTodayRest ? '🛋️' : '🎯'}
              </div>
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  {isTodayRest ? 'Sunday Rest Day Active' : "Today's Goal Progress"}
                  {isTodayRest ? (
                    <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/35 px-2 py-0.5 rounded-full">
                      Protected 🛡️
                    </span>
                  ) : todayPct >= 100 ? (
                    <span className="text-xs">🎉</span>
                  ) : null}
                </h2>
                <p className="text-[11px] text-gray-400">
                  {isTodayRest
                    ? 'Take rest, recharge, and recover for the week ahead! Streak safely continues.'
                    : todayPct >= 100
                    ? 'Daily goal accomplished! Superb consistency!'
                    : 'Keep the momentum going!'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="text-sm font-black font-mono">
                {isTodayRest ? (
                  <span className="text-purple-300">Rest Day</span>
                ) : (
                  <>
                    <span className={todayPct >= 100 ? 'text-green-400' : 'text-teal-300'}>
                      {formatDuration(todayStudiedSec)}
                    </span>
                    <span className="text-gray-500 text-xs font-normal"> / </span>
                    <span className="text-gray-300 text-xs">
                      {todayTargetSec > 0 ? formatHoursMinutes(todayTargetSec) : 'No Goal'}
                    </span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-gray-400 font-medium">
                {isTodayRest ? '0h Target' : 'Studied Today'}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3.5 relative h-2.5 rounded-full bg-[#1e293b]/70 overflow-hidden border border-[#334155]/40">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${todayPct}%`,
                background: isTodayRest
                  ? 'linear-gradient(90deg, #9333ea, #a855f7)'
                  : todayPct >= 100
                  ? 'linear-gradient(90deg, #10b981, #22c55e)'
                  : 'linear-gradient(90deg, #06b6d4, #3b82f6)',
                boxShadow: isTodayRest
                  ? '0 0 12px rgba(168, 85, 247, 0.4)'
                  : todayPct >= 100
                  ? '0 0 12px rgba(34, 197, 94, 0.5)'
                  : '0 0 12px rgba(6, 182, 212, 0.4)',
              }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-gray-400 flex items-center gap-1">
              {isTodayRest ? '🛋️ Rest day active — Your streak is preserved!' : (todayPct >= 100 ? '⚡ Goal completed!' : `⚡ ${todayPct}% reached`)}
            </span>
            <button
              onClick={() => navigate('/planner')}
              className="text-teal-400 hover:text-teal-300 text-[10px] font-bold underline"
            >
              {isTodayRest ? 'View Day Planner →' : 'Adjust Goal →'}
            </button>
          </div>
        </div>

        {/* ── 4 Primary KPI Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Card 1: Total Study Time */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-3.5 flex flex-col justify-between hover:border-[#3a3a3a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-sm">
                ⏱️
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Study Time</p>
              <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5 tracking-tight font-mono">
                {formatDuration(totalMonthSec)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                {totalSessionsCount} sessions in {MONTH_NAMES[selectedMonth]}
              </p>
            </div>
          </div>

          {/* Card 2: Study Sessions */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-3.5 flex flex-col justify-between hover:border-[#3a3a3a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-sm">
                🎯
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sessions</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Study Sessions</p>
              <p className="text-lg sm:text-xl font-extrabold text-purple-400 mt-0.5 tracking-tight font-mono">
                {totalSessionsCount}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">Logged this month</p>
            </div>
          </div>

          {/* Card 3: Avg Duration */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-3.5 flex flex-col justify-between hover:border-[#3a3a3a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-sm">
                ⏳
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Avg</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Avg Duration</p>
              <p className="text-lg sm:text-xl font-extrabold text-cyan-400 mt-0.5 tracking-tight font-mono">
                {formatDuration(avgDurationSec)}
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">Per study session</p>
            </div>
          </div>

          {/* Card 4: Productivity Score */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-3.5 flex flex-col justify-between hover:border-[#3a3a3a] transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-sm">
                ⚡
              </span>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Score</span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Productivity Score</p>
              <p className="text-lg sm:text-xl font-extrabold text-amber-400 mt-0.5 tracking-tight font-mono">
                {productivityScore}/100
              </p>
              <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                {productivityScore >= 80 ? 'Exceptional focus 🔥' : productivityScore >= 50 ? 'Steady consistency 👍' : 'Get started 🚀'}
              </p>
            </div>
          </div>
        </div>

        {/* ── 3 Secondary Visual Cards (Daily Avg, Goal Achievement, Best Streak) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Daily Average with Circular Progress Ring */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Daily Average</p>
              <p className="text-xl font-black text-white mt-1 font-mono">{formatDuration(dailyAverageSec)}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">towards daily goal</p>
            </div>

            {/* Circular Ring SVG */}
            <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#262626]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-teal-400"
                  strokeDasharray={`${dailyAvgPct}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-bold text-teal-300">{dailyAvgPct}%</span>
            </div>
          </div>

          {/* 2. Goal Achievement Rate */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Goal Achievement</p>
              <p className="text-xl font-black text-indigo-400 mt-1 font-mono">{goalAchievementRate}%</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {completedDaysCount}/{activePlannedDaysInMonth} days active
              </p>
            </div>

            {/* Circular Ring SVG */}
            <div className="relative w-16 h-16 flex-shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-[#262626]"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-400"
                  strokeDasharray={`${goalAchievementRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-bold text-indigo-300">{goalAchievementRate}%</span>
            </div>
          </div>

          {/* 3. Best Streak Card with Flame Icons */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Best Streak</p>
            <div className="flex items-center justify-between my-1">
              <div className="flex items-center gap-1 text-2xl">
                <span className="animate-pulse">🔥</span>
                <span>🔥</span>
                <span>🔥</span>
              </div>
              <span className="text-2xl font-black text-orange-400 font-mono">
                {streaks.longestStreak}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-gray-400">
              <span>Current: {streaks.currentStreak} days</span>
              <span className="text-orange-300 font-medium">Consecutive</span>
            </div>
          </div>
        </div>

        {/* ── Subject / Topic Breakdown ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📚</span>
              <h3 className="text-sm font-bold text-white">Subject Distribution</h3>
            </div>
            <span className="text-xs text-gray-500">{subjectBreakdown.length} Subjects</span>
          </div>

          {subjectBreakdown.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-500">
              No sessions logged for {MONTH_NAMES[selectedMonth]} {selectedYear}. Start timer to see breakdown!
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {subjectBreakdown.map((subj, idx) => {
                const colors = [
                  'from-purple-500 to-indigo-500',
                  'from-cyan-500 to-blue-500',
                  'from-emerald-500 to-teal-500',
                  'from-amber-500 to-orange-500',
                  'from-pink-500 to-rose-500',
                ]
                const barColor = colors[idx % colors.length]
                return (
                  <div key={subj.name} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-200">{subj.name}</span>
                      <span className="font-mono text-gray-400">
                        {formatDuration(subj.seconds)} ({subj.pct}%)
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-[#202020] overflow-hidden">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
                        style={{ width: `${subj.pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Daily Breakdown Table / Activity List for Month ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📅</span>
              <h3 className="text-sm font-bold text-white">Daily Logs for {MONTH_NAMES[selectedMonth]}</h3>
            </div>
            <span className="text-xs text-gray-500">{monthDateGroups.length} active days</span>
          </div>

          {monthDateGroups.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No activity in this month.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#202020]">
              {monthDateGroups.map((group) => {
                const target = getTargetForDate(group.date, weeklyPlan, dayPlanners, settings)
                const isRest = isRestDay(group.date, settings)
                const isMet = target?.targetMinutes ? group.totalSeconds >= target.targetMinutes * 60 : true
                return (
                  <div
                    key={group.date}
                    onClick={() => navigate(`/history/${group.date}`)}
                    className="py-2.5 flex items-center justify-between hover:bg-[#1a1a1a] px-2 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white font-mono">{group.date}</p>
                        {isRest && (
                          <span className="text-[9px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded-full">
                            Rest Day 🛋️
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500">{group.sessions.length} session(s)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-200 font-mono">
                        {formatDuration(group.totalSeconds)}
                      </p>
                      {isRest ? (
                        <span className="text-[10px] text-purple-400 font-medium">Rest Day</span>
                      ) : target?.targetMinutes ? (
                        <span className={`text-[10px] font-medium ${isMet ? 'text-green-400' : 'text-amber-400'}`}>
                          {isMet ? '✓ Target Met' : 'Missed Target'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-500">Completed</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
