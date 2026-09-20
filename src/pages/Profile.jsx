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
  updatePrivacySettings,
  searchUsers,
  getUserSettings,
  saveUserSettings,
  isRestDay,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration } from '../utils/formatTime'
import { clearSession, updateCurrentSession } from '../utils/auth'
import EditProfileModal from '../components/EditProfileModal'

export default function Profile({ userName }) {
  const navigate = useNavigate()
  const today = todayString()

  const [loading, setLoading] = useState(() => {
    if (!userName) return true
    try {
      return !localStorage.getItem(`stt_user_doc_${userName.toLowerCase()}`)
    } catch {
      return true
    }
  })
  const [showEditModal, setShowEditModal] = useState(false)
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
  const [userData, setUserData] = useState(() => {
    if (!userName) return null
    try {
      const raw = localStorage.getItem(`stt_user_doc_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return null
  })
  const [copied, setCopied] = useState(false)
  const [settings, setSettings] = useState(() => {
    if (!userName) return { sundayRestDay: false, effectiveFrom: null }
    try {
      const raw = localStorage.getItem(`stt_settings_${userName.toLowerCase()}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return { sundayRestDay: false, effectiveFrom: null }
  })
  const [settingsSaved, setSettingsSaved] = useState(false)

  // ── Privacy & Live Activity Visibility State ──
  const [visibility, setVisibility] = useState('public') // 'public' | 'selected' | 'private'
  const [allowedUsers, setAllowedUsers] = useState([])
  const [privacySaved, setPrivacySaved] = useState(false)
  const [partnerQuery, setPartnerQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchFeedback, setSearchFeedback] = useState('')

  // Sync privacy state from loaded userData
  useEffect(() => {
    if (userData?.privacy) {
      setVisibility(userData.privacy.visibility || 'public')
      setAllowedUsers(userData.privacy.allowedUsers || [])
    }
  }, [userData])

  // Real-time search for study partners
  useEffect(() => {
    const trimmed = partnerQuery.trim().toLowerCase().replace(/^@/, '')
    if (trimmed.length < 2) {
      setSearchResults([])
      setSearching(false)
      setSearchFeedback('')
      return
    }
    setSearching(true)
    setSearchFeedback('')
    let active = true
    const timer = setTimeout(async () => {
      try {
        const res = await searchUsers(trimmed, 6)
        if (active) {
          const filtered = res.filter(
            (u) => u.username.toLowerCase() !== (userName || '').toLowerCase()
          )
          setSearchResults(filtered)
          if (filtered.length === 0) {
            setSearchFeedback(`No user found matching "@${trimmed}"`)
          }
        }
      } catch (err) {
        console.warn('User search error:', err)
      } finally {
        if (active) setSearching(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [partnerQuery, userName])

  const handleVisibilityChange = async (newVis) => {
    setVisibility(newVis)
    setPrivacySaved(true)
    setTimeout(() => setPrivacySaved(false), 2500)
    try {
      await updatePrivacySettings(userName, {
        visibility: newVis,
        allowedUsers,
      })
      setUserData((prev) => ({
        ...prev,
        privacy: { ...(prev?.privacy || {}), visibility: newVis, allowedUsers },
      }))
    } catch (e) {
      console.error('Failed to update privacy visibility:', e)
    }
  }

  const handleAddAllowedUser = async (targetUser) => {
    const clean = targetUser.trim().toLowerCase().replace(/^@/, '')
    if (!clean) return
    if (clean === (userName || '').toLowerCase()) {
      alert('You cannot add your own username. You always have full access to your account.')
      return
    }
    if (allowedUsers.includes(clean)) {
      setPartnerQuery('')
      setSearchResults([])
      setSearchFeedback('')
      return
    }
    const updated = [...allowedUsers, clean]
    setAllowedUsers(updated)
    setPartnerQuery('')
    setSearchResults([])
    setSearchFeedback('')
    setPrivacySaved(true)
    setTimeout(() => setPrivacySaved(false), 2500)
    try {
      await updatePrivacySettings(userName, {
        visibility,
        allowedUsers: updated,
      })
      setUserData((prev) => ({
        ...prev,
        privacy: { ...(prev?.privacy || {}), visibility, allowedUsers: updated },
      }))
    } catch (e) {
      console.error('Failed to add allowed partner:', e)
    }
  }

  const handleRemoveAllowedUser = async (targetUser) => {
    const clean = targetUser.trim().toLowerCase()
    const updated = allowedUsers.filter((u) => u !== clean)
    setAllowedUsers(updated)
    setPrivacySaved(true)
    setTimeout(() => setPrivacySaved(false), 2500)
    try {
      await updatePrivacySettings(userName, {
        visibility,
        allowedUsers: updated,
      })
      setUserData((prev) => ({
        ...prev,
        privacy: { ...(prev?.privacy || {}), visibility, allowedUsers: updated },
      }))
    } catch (e) {
      console.error('Failed to remove allowed partner:', e)
    }
  }

  // Load all user details
  useEffect(() => {
    if (!userName) return
    let isMounted = true

    async function loadProfile() {
      try {
        const [sessions, plan, planners, uDoc, uSettings] = await Promise.all([
          getUserSessions(userName),
          getWeeklyPlan(userName),
          getAllDayPlanners(userName),
          getUserDoc(userName),
          getUserSettings(userName),
        ])
        if (isMounted) {
          setAllSessions(sessions || [])
          setWeeklyPlan(plan || {})
          setDayPlanners(planners || {})
          setUserData(uDoc || {})
          setSettings(uSettings || { sundayRestDay: false, effectiveFrom: null })
          if (uDoc) {
            updateCurrentSession({
              photoUrl: uDoc.photoUrl || '',
              avatarColor: uDoc.avatarColor || '#7c3aed',
              displayName: uDoc.displayName || userName,
            })
          }
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

  // Sync settings and plan across tabs/components
  useEffect(() => {
    const handleUpdate = async () => {
      if (!userName) return
      try {
        const [uSettings, plan, sessions] = await Promise.all([
          getUserSettings(userName),
          getWeeklyPlan(userName),
          getUserSessions(userName),
        ])
        setSettings(uSettings || { sundayRestDay: false, effectiveFrom: null })
        setWeeklyPlan(plan || {})
        setAllSessions(sessions || [])
      } catch {}
    }
    window.addEventListener('study_settings_updated', handleUpdate)
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_settings_updated', handleUpdate)
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
    }
  }, [userName])

  const handleToggleSundayRest = async (newVal) => {
    const updated = {
      sundayRestDay: newVal,
      effectiveFrom: newVal ? todayString() : null,
    }
    setSettings(updated)
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2500)
    try {
      await saveUserSettings(userName, updated)
    } catch (err) {
      console.error('Failed to save rest day setting in profile:', err)
    }
  }

  // All time groups & streaks
  const dateGroups = useMemo(() => groupSessionsByDate(allSessions), [allSessions])
  const streaks = useMemo(() => calculateStreaks(dateGroups, settings), [dateGroups, settings])

  // Total Lifetime Studied Time
  const lifetimeSeconds = useMemo(() => {
    return allSessions.reduce((acc, s) => acc + (s.totalSeconds || 0), 0)
  }, [allSessions])

  // Total Active Days
  const totalActiveDays = dateGroups.length

  // Best Single Study Day
  const bestDay = useMemo(() => {
    if (!dateGroups || dateGroups.length === 0) return { date: '-', totalSeconds: 0 }
    let max = dateGroups[0]
    for (const g of dateGroups) {
      if ((g.totalSeconds || 0) > (max.totalSeconds || 0)) max = g
    }
    return max
  }, [dateGroups])

  // Longest Single Session
  const longestSession = useMemo(() => {
    if (!allSessions || allSessions.length === 0) return { totalSeconds: 0 }
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
      const isRest = isRestDay(dateStr, settings)
      const target = getTargetForDate(dateStr, weeklyPlan, dayPlanners, settings)
      const actualSec = sessionDateMap[dateStr] || 0
      const targetMin = isRest ? 0 : (target?.targetMinutes || 0)

      if (!isRest) {
        totalTargetMinutes += targetMin
      }
      totalActualSeconds += actualSec

      return {
        day,
        dateStr,
        actualSec,
        targetMin,
        isRest,
        isToday: dateStr === today,
        isPast: dateStr < today,
        met: isRest ? true : (targetMin > 0 ? actualSec >= targetMin * 60 : actualSec > 0),
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
  }, [allSessions, weeklyPlan, dayPlanners, today, settings])

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
    <div className="min-h-screen pb-16 bg-transparent" style={{ color: '#f5f5f5' }}>
      {/* ── Top Nav ── */}
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
                {(bestDay.totalSeconds || 0) > 0 ? formatHoursMinutes(bestDay.totalSeconds) : '0h'}
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

        {/* ── Live Activity & History Privacy Card ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛡️</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Live Activity & History Privacy</h3>
                  {privacySaved && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-fadeIn">
                      Saved ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Control who can watch your live stopwatch timer and view your session history
                </p>
              </div>
            </div>

            {/* Current status pill */}
            <div className="self-start sm:self-auto">
              {visibility === 'public' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  🌍 Public (Everyone)
                </span>
              )}
              {visibility === 'selected' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  👥 Selected ({allowedUsers.length} Partners)
                </span>
              )}
              {visibility === 'private' && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  🔒 Private (Off)
                </span>
              )}
            </div>
          </div>

          {/* 3 Visibility Toggle Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Option 1: Public */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('public')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                visibility === 'public'
                  ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30'
                  : 'bg-[#181818] border-[#262626] hover:border-[#383838]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🌍</span>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  visibility === 'public' ? 'border-emerald-400 bg-emerald-500' : 'border-gray-600'
                }`}>
                  {visibility === 'public' && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                </span>
              </div>
              <div>
                <p className={`text-xs font-bold ${visibility === 'public' ? 'text-emerald-300' : 'text-white'}`}>
                  Public (Live to All)
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                  Sabko dikhe — Anyone can search and watch your live timer & study history.
                </p>
              </div>
            </button>

            {/* Option 2: Selected */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('selected')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                visibility === 'selected'
                  ? 'bg-purple-950/25 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                  : 'bg-[#181818] border-[#262626] hover:border-[#383838]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">👥</span>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  visibility === 'selected' ? 'border-purple-400 bg-purple-500' : 'border-gray-600'
                }`}>
                  {visibility === 'selected' && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                </span>
              </div>
              <div>
                <p className={`text-xs font-bold ${visibility === 'selected' ? 'text-purple-300' : 'text-white'}`}>
                  Selected Users Only
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                  Sirf chune hue users ko — Only approved partners you choose can view your activity.
                </p>
              </div>
            </button>

            {/* Option 3: Private */}
            <button
              type="button"
              onClick={() => handleVisibilityChange('private')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 ${
                visibility === 'private'
                  ? 'bg-rose-950/20 border-rose-500/50 shadow-md ring-1 ring-rose-500/30'
                  : 'bg-[#181818] border-[#262626] hover:border-[#383838]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">🔒</span>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  visibility === 'private' ? 'border-rose-400 bg-rose-500' : 'border-gray-600'
                }`}>
                  {visibility === 'private' && <span className="w-1.5 h-1.5 bg-black rounded-full" />}
                </span>
              </div>
              <div>
                <p className={`text-xs font-bold ${visibility === 'private' ? 'text-rose-300' : 'text-white'}`}>
                  Private (Off)
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">
                  Kisi ko na dikhe — Turn off sharing completely. Nobody can watch or view history.
                </p>
              </div>
            </button>
          </div>

          {/* Interactive Partner Search & Management (When 'selected' is active) */}
          {visibility === 'selected' && (
            <div className="p-4 rounded-xl bg-[#181820] border border-purple-500/30 flex flex-col gap-3 mt-1 animate-fadeIn">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>🔍</span> Add Study Partners
                  </h4>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Search usernames to allow them to watch your live timer & view your study history.
                  </p>
                </div>
                <span className="text-[11px] font-mono font-bold text-purple-300 bg-purple-500/15 px-2.5 py-0.5 rounded-full self-start sm:self-auto">
                  {allowedUsers.length} Approved {allowedUsers.length === 1 ? 'Partner' : 'Partners'}
                </span>
              </div>

              {/* Search Input Box */}
              <div className="relative">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs">@</span>
                    <input
                      type="text"
                      value={partnerQuery}
                      onChange={(e) => setPartnerQuery(e.target.value)}
                      placeholder="Search by username (e.g. rahul, priya)..."
                      className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#111] border border-[#333] text-white placeholder-gray-500 text-xs outline-none focus:border-purple-500 transition-colors"
                    />
                  </div>
                  {partnerQuery && (
                    <button
                      type="button"
                      onClick={() => handleAddAllowedUser(partnerQuery)}
                      className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors flex items-center gap-1"
                    >
                      <span>+</span> Add
                    </button>
                  )}
                </div>

                {searching && (
                  <p className="text-[10px] text-gray-400 mt-1 italic">Searching users...</p>
                )}

                {searchFeedback && !searching && (
                  <p className="text-[10px] text-amber-400/80 mt-1">{searchFeedback}</p>
                )}

                {/* Live Search Suggestions Dropdown */}
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl bg-[#14141c] border border-purple-500/40 shadow-2xl overflow-hidden z-20">
                    {searchResults.map((user) => {
                      const isAlreadyAdded = allowedUsers.includes(user.username.toLowerCase())
                      return (
                        <div
                          key={user.username}
                          className="flex items-center justify-between px-3 py-2 hover:bg-purple-600/10 border-b border-[#252535] last:border-0 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                              style={{ background: user.avatarColor || '#7c3aed' }}
                            >
                              {user.photoUrl ? (
                                <img src={user.photoUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                user.username[0].toUpperCase()
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{user.displayName || user.username}</p>
                              <p className="text-[10px] text-gray-400 font-mono truncate">@{user.username}</p>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isAlreadyAdded}
                            onClick={() => handleAddAllowedUser(user.username)}
                            className={`text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all ${
                              isAlreadyAdded
                                ? 'bg-gray-800 text-gray-500 cursor-default'
                                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-sm'
                            }`}
                          >
                            {isAlreadyAdded ? 'Added ✓' : '+ Add Partner'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Allowed Users Chips List */}
              <div className="pt-2 border-t border-[#252535] flex flex-col gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Currently Allowed Study Partners:
                </span>

                {allowedUsers.length === 0 ? (
                  <p className="text-xs text-amber-300/80 italic bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5">
                    ⚠️ Koi partner add nahi hai. Upar search box me username search karke add karein taaki sirf unhe aapka timer aur history dikhe.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allowedUsers.map((u) => (
                      <span
                        key={u}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/35 text-xs text-purple-200 font-mono shadow-sm"
                      >
                        <span>@{u}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAllowedUser(u)}
                          className="w-4 h-4 rounded-full bg-purple-500/20 hover:bg-purple-500 text-gray-300 hover:text-white flex items-center justify-center text-[10px] transition-colors"
                          title={`Remove @${u}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Study Preferences & Rest Day Settings Card ── */}
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-xl flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#222] pb-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛋️</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Sunday Rest Day (Buffer)</h3>
                  {settingsSaved && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-fadeIn">
                      Saved ✓
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Take Sundays off guilt-free. Your study streak safely carries from Saturday to Monday.
                </p>
              </div>
            </div>

            {/* Status Pill */}
            <div className="self-start sm:self-auto">
              {settings.sundayRestDay ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  Rest Day Active 🛡️
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 bg-gray-800/40 border border-gray-700/50 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-gray-500" />
                  Disabled (Normal Day)
                </span>
              )}
            </div>
          </div>

          {/* Toggle Banner */}
          <div className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            settings.sundayRestDay
              ? 'bg-purple-950/20 border-purple-500/40 shadow-sm'
              : 'bg-[#181818] border-[#282828]'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🛌</span>
              <div>
                <p className={`text-xs font-bold ${settings.sundayRestDay ? 'text-purple-300' : 'text-white'}`}>
                  {settings.sundayRestDay ? 'Sunday Rest Mode is ON' : 'Enable Sunday Rest Day'}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 max-w-lg leading-relaxed">
                  {settings.sundayRestDay
                    ? `Sunday is marked as 0h rest. Your streak will never break over Sunday as long as Saturday's goal was met. (Active since ${settings.effectiveFrom || 'today'})`
                    : 'When enabled, Sundays will automatically have a 0h study target and won\'t break your active streak. Toggle this on whenever you need a scheduled weekly buffer.'}
                </p>
              </div>
            </div>

            {/* Switch Toggle */}
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-end sm:self-center">
              <input
                type="checkbox"
                checked={Boolean(settings.sundayRestDay)}
                onChange={(e) => handleToggleSundayRest(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
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
                  item.isRest
                    ? 'border-purple-500/40 bg-purple-500/10'
                    : item.isToday
                    ? 'border-purple-500 bg-purple-500/10'
                    : item.met
                    ? 'border-green-500/30 bg-green-500/5'
                    : 'border-[#262626] bg-[#181818]'
                }`}
              >
                <span className={`text-[10px] font-black ${item.isRest ? 'text-purple-300' : item.isToday ? 'text-purple-300 font-bold' : 'text-gray-400'}`}>
                  {item.day}
                </span>
                <span className={`text-xs font-mono font-bold mt-1 ${item.isRest ? 'text-purple-300 text-[11px]' : 'text-white'}`}>
                  {item.isRest ? 'Rest' : (item.actualSec > 0 ? `${Math.round(item.actualSec / 3600 * 10) / 10}h` : '0h')}
                </span>
                <span className="text-[10px] mt-0.5">
                  {item.isRest ? '🛋️' : item.met ? '✓' : item.isToday ? '⏳' : item.isPast ? '·' : '·'}
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
                {(longestSession.totalSeconds || 0) > 0 ? formatDuration(longestSession.totalSeconds) : '0m'}
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
