/**
 * Profile.jsx — User Profile & Achievements Hub inspired by groupstudytimer.com
 * Features:
 * - Profile header with avatar, @username, active status indicator
 * - 4 Key Stats: GROUPS, STREAK 🔥, BEST DAY 🏆, ACTIVE DAYS 📅
 * - Weekly Study Target tracker with progress bar & day indicators
 * - Lifetime Milestones & Personal Records
 * - Quick action links (Watch Partner, Weekly Plan, Planner, Analytics, Logout)
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getUserSessions,
  getWeeklyPlan,
  getAllDayPlanners,
  calculateStreaks,
  groupSessionsByDate,
  getTargetForDate,
  getUserDoc,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration } from '../utils/formatTime'
import { clearSession } from '../utils/auth'
import EditProfileModal from '../components/EditProfileModal'

export default function Profile({ userName }) {
  const navigate = useNavigate()
  const today = todayString()

  const [loading, setLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [allSessions, setAllSessions] = useState([])
  const [weeklyPlan, setWeeklyPlan] = useState({})
  const [dayPlanners, setDayPlanners] = useState({})
  const [userData, setUserData] = useState(null)
  const [copied, setCopied] = useState(false)

  // Load all user details
  useEffect(() => {
    if (!userName) return
    let isMounted = true

    async function loadProfile() {
      setLoading(true)
      try {
        const [sessions, plan, planners, uDoc] = await Promise.all([
          getUserSessions(userName),
          getWeeklyPlan(userName),
          getAllDayPlanners(userName),
          getUserDoc(userName),
        ])
        if (isMounted) {
          setAllSessions(sessions || [])
          setWeeklyPlan(plan || {})
          setDayPlanners(planners || {})
          setUserData(uDoc || {})
        }
      } catch (err) {
        console.error('Error loading profile data:', err)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadProfile()
    return () => { isMounted = false }
  }, [userName])

  // All time groups & streaks
  const dateGroups = useMemo(() => groupSessionsByDate(allSessions), [allSessions])
  const streaks = useMemo(() => calculateStreaks(dateGroups), [dateGroups])

  // Total Lifetime Studied Time
  const lifetimeSeconds = useMemo(() => {
    return allSessions.reduce((acc, s) => acc + (s.totalSeconds || 0), 0)
  }, [allSessions])

  // Total Active Days
  const totalActiveDays = dateGroups.length

  // Best Single Study Day
  const bestDay = useMemo(() => {
    if (dateGroups.length === 0) return { date: '-', seconds: 0 }
    let max = dateGroups[0]
    for (const g of dateGroups) {
      if (g.totalSeconds > max.totalSeconds) max = g
    }
    return max
  }, [dateGroups])

  // Longest Single Session
  const longestSession = useMemo(() => {
    if (allSessions.length === 0) return { seconds: 0 }
    let max = allSessions[0]
    for (const s of allSessions) {
      if ((s.totalSeconds || 0) > (max.totalSeconds || 0)) max = s
    }
    return max
  }, [allSessions])

  // Favorite Subject
  const favoriteSubject = useMemo(() => {
    if (allSessions.length === 0) return '-'
    const counts = {}
    for (const s of allSessions) {
      const subj = s.subject?.trim() || 'General Study'
      counts[subj] = (counts[subj] || 0) + (s.totalSeconds || 0)
    }
    let top = '-'
    let maxSec = 0
    for (const [name, sec] of Object.entries(counts)) {
      if (sec > maxSec) {
        maxSec = sec
        top = name
      }
    }
    return top
  }, [allSessions])

  // Weekly Progress Calculation (Monday to Sunday of current week)
  const weeklyStats = useMemo(() => {
    const curr = new Date()
    const dayOfWeek = curr.getDay() // 0=Sun, 1=Mon...
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek // distance back to Monday
    const monday = new Date(curr)
    monday.setDate(curr.getDate() + diffToMon)

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    const weekDates = days.map((day, idx) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + idx)
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { day, dateStr }
    })

    const sessionDateMap = {}
    for (const s of allSessions) {
      sessionDateMap[s.date] = (sessionDateMap[s.date] || 0) + (s.totalSeconds || 0)
    }

    let totalTargetMinutes = 0
    let totalActualSeconds = 0

    const dayBreakdown = weekDates.map(({ day, dateStr }) => {
      const target = getTargetForDate(dateStr, weeklyPlan, dayPlanners)
      const actualSec = sessionDateMap[dateStr] || 0
      const targetMin = target?.targetMinutes || 0

      totalTargetMinutes += targetMin
      totalActualSeconds += actualSec

      return {
        day,
        dateStr,
        actualSec,
        targetMin,
        isToday: dateStr === today,
        isPast: dateStr < today,
        met: targetMin > 0 ? actualSec >= targetMin * 60 : actualSec > 0,
      }
    })

    const totalTargetSec = totalTargetMinutes * 60
    const pct = totalTargetSec > 0
      ? Math.min(100, Math.round((totalActualSeconds / totalTargetSec) * 100))
      : 0

    return {
      targetSec: totalTargetSec,
      actualSec: totalActualSeconds,
      pct,
      dayBreakdown,
    }
  }, [allSessions, weeklyPlan, dayPlanners, today])

  const shareLink = `${window.location.origin}/watch/${userName}`
  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      clearSession()
      navigate('/welcome')
    }
  }

  const avatarBg = userData?.avatarColor || '#7c3aed'

  return (
    <div className="min-h-screen pb-16" style={{ background: '#0d0d0d', color: '#f5f5f5' }}>
      {/* ── Top Nav ── */}
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3.5 border-b border-[#222] backdrop-blur-md"
        style={{ background: 'rgba(13, 13, 13, 0.9)' }}
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
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              <span>👤</span> User Profile
            </h1>
            <p className="text-[10px] text-gray-500">Milestones, Streaks & Stats</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-xs text-red-400 hover:text-red-300 font-semibold px-2.5 py-1 rounded-lg border border-red-500/20 hover:bg-red-500/10 transition-colors"
        >
          Logout
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4 flex flex-col gap-4">
        {/* ── User Profile Card (Matches Screenshot 1) ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            {/* Big Avatar */}
            <div
              onClick={() => setShowEditModal(true)}
              className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-lg border-2 border-white/20 flex-shrink-0 cursor-pointer relative group overflow-hidden"
              style={{ background: avatarBg }}
              title="Click to edit profile & photo"
            >
              {userData?.photoUrl ? (
                <img src={userData.photoUrl} alt={userName} className="w-full h-full object-cover" />
              ) : (
                (userName[0] || 'U').toUpperCase()
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-bold transition-opacity">
                📷 Edit
              </div>
            </div>

            {/* User details */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl font-black text-white capitalize">
                  {userData?.displayName || userName}
                </h2>
                <span className="text-xs font-mono text-gray-400">@{userName}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Focus Mode · Self-Study Scholar
              </p>

              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>✏️</span> Edit Profile
                </button>
                <button
                  onClick={copyShareLink}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#222] hover:bg-[#2c2c2c] border border-[#333] text-gray-200 transition-all flex items-center gap-1.5"
                >
                  <span>{copied ? '✓' : '🔗'}</span>
                  {copied ? 'Link Copied!' : 'Share Live Study Link'}
                </button>
                <button
                  onClick={() => navigate('/analytics')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 transition-all flex items-center gap-1.5"
                >
                  <span>📈</span> Analytics
                </button>
              </div>
            </div>
          </div>

          {/* 4 Stats Boxes Grid (GROUPS, STREAK, BEST, DAYS) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-5 pt-4 border-t border-[#222]">
            {/* Box 1: GROUPS */}
            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">GROUPS</span>
              <p className="text-xl font-black text-white mt-0.5 font-mono">1</p>
              <span className="text-[9px] text-gray-500">Live Study Room</span>
            </div>

            {/* Box 2: STREAK */}
            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                🔥 STREAK
              </span>
              <p className="text-xl font-black text-orange-400 mt-0.5 font-mono">
                {streaks.currentStreak}
              </p>
              <span className="text-[9px] text-gray-500">Active study days</span>
            </div>

            {/* Box 3: BEST */}
            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                🏆 BEST
              </span>
              <p className="text-xl font-black text-yellow-400 mt-0.5 font-mono">
                {bestDay.seconds > 0 ? formatHoursMinutes(bestDay.seconds) : '0h'}
              </p>
              <span className="text-[9px] text-gray-500">Single day record</span>
            </div>

            {/* Box 4: DAYS */}
            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3 text-center">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                📅 DAYS
              </span>
              <p className="text-xl font-black text-purple-400 mt-0.5 font-mono">
                {totalActiveDays}
              </p>
              <span className="text-[9px] text-gray-500">Total active days</span>
            </div>
          </div>
        </div>

        {/* ── Weekly Study Target Card (Matches Screenshot 1) ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Weekly Target</span>
              <h3 className="text-base font-bold text-white mt-0.5">Study Progress This Week</h3>
            </div>
            <button
              onClick={() => navigate('/plan')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition-all flex items-center gap-1"
            >
              <span>✏️</span> Set Target
            </button>
          </div>

          <div className="flex items-center justify-between text-xs mt-3">
            <span className="text-gray-400">
              Target: <strong className="text-white font-mono">{formatHoursMinutes(weeklyStats.targetSec)}</strong>
            </span>
            <span className="text-gray-400">
              Actual: <strong className="text-teal-400 font-mono">{formatHoursMinutes(weeklyStats.actualSec)}</strong>
            </span>
            <span className="font-bold text-purple-400 font-mono">Progress: {weeklyStats.pct}%</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2.5 rounded-full bg-[#202020] overflow-hidden mt-2.5">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${weeklyStats.pct}%`,
                background: weeklyStats.pct >= 100
                  ? 'linear-gradient(90deg, #10b981, #22c55e)'
                  : 'linear-gradient(90deg, #7c3aed, #a855f7)',
                boxShadow: weeklyStats.pct >= 100
                  ? '0 0 10px rgba(34, 197, 94, 0.5)'
                  : '0 0 10px rgba(124, 58, 237, 0.4)',
              }}
            />
          </div>

          {/* Weekday indicators */}
          <div className="grid grid-cols-7 gap-1.5 mt-4 pt-3 border-t border-[#202020]">
            {weeklyStats.dayBreakdown.map((item) => (
              <div
                key={item.dateStr}
                onClick={() => navigate(`/history/${item.dateStr}`)}
                className={`flex flex-col items-center p-2 rounded-xl border text-center cursor-pointer transition-all ${
                  item.isToday
                    ? 'border-purple-500 bg-purple-500/10'
                    : item.met
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-[#262626] bg-[#181818]'
                }`}
              >
                <span className={`text-[10px] font-black ${item.isToday ? 'text-purple-300 font-bold' : 'text-gray-400'}`}>
                  {item.day}
                </span>
                <span className="text-xs font-mono font-bold text-white mt-1">
                  {item.actualSec > 0 ? `${Math.round(item.actualSec / 3600 * 10) / 10}h` : '0h'}
                </span>
                <span className="text-[10px] mt-0.5">
                  {item.met ? '✓' : item.isToday ? '⏳' : item.isPast ? '·' : '·'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Lifetime Records & Hall of Fame ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">🏅</span>
            <h3 className="text-sm font-bold text-white">Lifetime Study Records</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Focus Time</span>
              <p className="text-lg font-black text-indigo-300 font-mono mt-1">
                {formatDuration(lifetimeSeconds)}
              </p>
              <span className="text-[10px] text-gray-500 mt-1">Lifetime across all dates</span>
            </div>

            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Longest Session</span>
              <p className="text-lg font-black text-emerald-300 font-mono mt-1">
                {longestSession.seconds > 0 ? formatDuration(longestSession.seconds) : '0m'}
              </p>
              <span className="text-[10px] text-gray-500 mt-1">Single uninterrupted stretch</span>
            </div>

            <div className="bg-[#191919] border border-[#282828] rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Top Subject</span>
              <p className="text-lg font-black text-amber-300 truncate mt-1">
                {favoriteSubject}
              </p>
              <span className="text-[10px] text-gray-500 mt-1">Most studied topic</span>
            </div>
          </div>
        </div>

        {/* ── App Navigation Shortcuts ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate('/')}
            className="p-3.5 rounded-xl bg-[#141414] border border-[#252525] hover:border-purple-500/50 flex flex-col items-center gap-1 text-center transition-all"
          >
            <span className="text-xl">⏱️</span>
            <span className="text-xs font-bold text-white">Timer</span>
          </button>
          <button
            onClick={() => navigate('/planner')}
            className="p-3.5 rounded-xl bg-[#141414] border border-[#252525] hover:border-purple-500/50 flex flex-col items-center gap-1 text-center transition-all"
          >
            <span className="text-xl">🌸</span>
            <span className="text-xs font-bold text-white">Day Planner</span>
          </button>
          <button
            onClick={() => navigate('/plan')}
            className="p-3.5 rounded-xl bg-[#141414] border border-[#252525] hover:border-purple-500/50 flex flex-col items-center gap-1 text-center transition-all"
          >
            <span className="text-xl">📋</span>
            <span className="text-xs font-bold text-white">Weekly Plan</span>
          </button>
          <button
            onClick={() => navigate('/history')}
            className="p-3.5 rounded-xl bg-[#141414] border border-[#252525] hover:border-purple-500/50 flex flex-col items-center gap-1 text-center transition-all"
          >
            <span className="text-xl">📜</span>
            <span className="text-xs font-bold text-white">History</span>
          </button>
        </div>
      </div>

      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        currentUser={userName}
        userData={userData}
        onUpdated={(updated, newU) => {
          setUserData(updated)
          if (newU && newU !== userName) {
            window.location.href = '/profile'
          }
        }}
      />
    </div>
  )
}
