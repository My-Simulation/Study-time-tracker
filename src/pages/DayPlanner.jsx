/**
 * DayPlanner.jsx
 * Digital Study Planner Sheet inspired by "My Plan. My Time. My Success."
 * Features:
 *  - Day 1, Day 2, Day 3... sequential tracking & history
 *  - Target Study Hours vs Actual Stopwatch Time comparison (with Goal Met / Missed badges)
 *  - Top 3 Goals & Affirmation cards
 *  - Subject + Topic + Time + Plan schedule table
 *  - Rollover item badge (⚠️ Backlog from Day N: Kal nahi ho paya tha)
 *  - Direct "▶️ Start Timer" link for each topic row
 *  - Revision notes & Emoji progress rating (😟 😐 🙂 🤩)
 *  - "🏁 Complete Day & Move to Day {N+1}" button (auto-carries uncompleted tasks & locks past day)
 *  - Day Locking (🔒 read-only past records prevention)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getDayPlanner, saveDayPlanner, calculateDayNumber,
  getSyllabus, getUserSessions, finalizeAndRolloverDay,
  getWeeklyPlan, syncTargetHours,
  getUserSettings, isRestDay as checkIsRestDay, getUserDoc,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatTargetHoursText, parseHoursInput, toLocalDateStr, getLocalWeekdayId } from '../utils/formatTime'
import AITimeTableModal from '../components/AITimeTableModal'
import AICoachDrawer from '../components/AICoachDrawer'
import AuthModal from '../components/AuthModal'
import { buildUserAIContext } from '../utils/aiService'

const TARGET_HOURS_OPTIONS = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 18, 20
]

const DEFAULT_SUBJECTS = [
  { subject: 'राजनीति / Polity', color: '#9d72e7', bg: 'rgba(157, 114, 231, 0.15)' },
  { subject: 'इतिहास / History', color: '#34d399', bg: 'rgba(52, 211, 153, 0.15)' },
  { subject: 'भूगोल / Geography', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  { subject: 'अर्थशास्त्र / Economy', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
  { subject: 'सामान्य विज्ञान / Science', color: '#f472b6', bg: 'rgba(244, 114, 182, 0.15)' },
  { subject: 'रीजनिंग / Reasoning', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  { subject: 'गणित / Maths', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.15)' },
  { subject: 'हिंदी / Hindi', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.15)' },
  { subject: 'Current Affairs', color: '#22d3ee', bg: 'rgba(34, 211, 238, 0.15)' },
  { subject: 'Revision / Practice', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.15)' },
]

export const SLOT_TYPES = [
  { id: 'Core Study', label: '📘 Core Study', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { id: 'Revision', label: '🧠 Revision', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  { id: 'Mock Test', label: '📝 Mock Test', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { id: 'Practice', label: '🎯 Practice', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { id: 'Break', label: '☕ Break', badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
]

export const TIME_BLOCKS = [
  { id: 'Morning', label: '🌅 Morning' },
  { id: 'Afternoon', label: '☀️ Afternoon' },
  { id: 'Evening', label: '🌆 Evening' },
  { id: 'Night', label: '🌙 Night' },
]

const QUOTES = [
  'Be proud of how far you’ve come. Keep going! 💕',
  'Small steps every day lead to big results. 💜',
  'Discipline is choosing between what you want now and what you want most. ✨',
  'Don’t stop until you’re proud. 🌟',
  'Your future is created by what you do today, not tomorrow. 🌸',
]

export default function DayPlanner({ userName }) {
  const { date: paramDate } = useParams()
  const navigate = useNavigate()

  const [currentDate, setCurrentDate] = useState(paramDate || todayString())
  const [dayNumber, setDayNumber] = useState(1)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)

  // Pre-load from local cache to render instantly on page load / refresh
  const cachedInitial = useMemo(() => {
    try {
      const u = (userName || '').toLowerCase()
      const raw = localStorage.getItem(`stt_day_plan_${u}_${currentDate}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') return parsed
      }
    } catch {}
    return null
  }, [userName, currentDate])

  // Sheet fields
  const [targetHours, setTargetHours] = useState(() => {
    if (cachedInitial?.targetHours !== undefined) return Number(cachedInitial.targetHours)
    return 6
  })
  const [isRestDay, setIsRestDay] = useState(() => Boolean(cachedInitial?.isRestDay))
  const [restType, setRestType] = useState('rest') // 'rest' | 'mock' | 'revision'
  const [customInputMode, setCustomInputMode] = useState(false)
  const [customInputVal, setCustomInputVal] = useState('')
  const [actualSeconds, setActualSeconds] = useState(0)
  const [targetSynced, setTargetSynced] = useState(false)
  const [isLocked, setIsLocked] = useState(() => Boolean(cachedInitial?.isLocked || cachedInitial?.isRestDay))
  const [settings, setSettings] = useState(() => {
    try {
      const u = (userName || '').toLowerCase()
      const raw = localStorage.getItem(`stt_settings_${u}`)
      if (raw) return JSON.parse(raw)
    } catch {}
    return { sundayRestDay: false, effectiveFrom: '' }
  })

  // Memoized available target options (dynamically adds current targetHours if unique)
  const availableTargetOptions = React.useMemo(() => {
    const list = [...TARGET_HOURS_OPTIONS]
    const cur = Number(targetHours)
    if (!isNaN(cur) && cur >= 0 && !list.includes(cur)) {
      list.push(cur)
      list.sort((a, b) => a - b)
    }
    return list
  }, [targetHours])
  const [goals, setGoals] = useState(() => cachedInitial?.goals || ['', '', ''])
  const [rows, setRows] = useState(() => cachedInitial?.rows || [])
  const [notes, setNotes] = useState(() => cachedInitial?.notes || '')
  const [progressRating, setProgressRating] = useState(() => cachedInitial?.progressRating || 'good')
  const [availableSubjects, setAvailableSubjects] = useState([])

  // Rollover modal
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting] = useState(false)

  // AI Integration states
  const [showAIModal, setShowAIModal] = useState(false)
  const [showAICoach, setShowAICoach] = useState(false)
  const [userAIContext, setUserAIContext] = useState(null)

  const handleOpenAIModal = async () => {
    if (!userName) {
      setShowAuthModal(true)
      return
    }
    const ctx = await buildUserAIContext(userName)
    setUserAIContext(ctx)
    setShowAIModal(true)
  }

  const handleOpenAICoach = async () => {
    if (!userName) {
      setShowAuthModal(true)
      return
    }
    const ctx = await buildUserAIContext(userName)
    if (ctx && currentDate === todayString() && actualSeconds > 0) {
      ctx.todayStudiedHours = Number((actualSeconds / 3600).toFixed(1))
    }
    setUserAIContext(ctx)
    setShowAICoach(true)
  }

  const handleApplyAISlots = async (newSlots, newTargetHours) => {
    setRows(newSlots)
    let effHours = targetHours
    if (newTargetHours && !isNaN(newTargetHours) && newTargetHours > 0) {
      effHours = newTargetHours
      setTargetHours(newTargetHours)
      await syncTargetHours(userName, currentDate, newTargetHours)
    }

    const planData = {
      date: currentDate,
      dayNumber,
      targetHours: effHours,
      isLocked: false,
      goals,
      rows: newSlots,
      notes,
      progressRating,
      updatedAt: Date.now(),
    }
    await saveDayPlanner(userName, currentDate, planData)
    setSavedBadge(true)
    setTimeout(() => setSavedBadge(false), 2500)
  }

  // Load data for currentDate
  const loadDay = useCallback(async (targetDate) => {
    // Only show full loading spinner if we don't already have data from local cache
    if (!cachedInitial && rows.length === 0) {
      setLoading(true)
    }
    try {
      const [savedPlan, syllabus, sessions, weeklyPlan, userSettings, userDoc] = await Promise.all([
        getDayPlanner(userName, targetDate),
        getSyllabus(userName),
        getUserSessions(userName),
        getWeeklyPlan(userName),
        getUserSettings(userName),
        getUserDoc(userName),
      ])

      const computedDay = await calculateDayNumber(userName, targetDate, sessions, userDoc)

      setSettings(userSettings || { sundayRestDay: false, effectiveFrom: '' })
      setDayNumber(computedDay || 1)
      if (syllabus && syllabus.length > 0) {
        setAvailableSubjects(syllabus.map((s) => s.name))
      } else {
        setAvailableSubjects(DEFAULT_SUBJECTS.map((s) => s.subject))
      }

      // Calculate actual studied time from sessions recorded on targetDate
      const daySessions = (sessions || []).filter((s) => s.date === targetDate)
      let sec = daySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

      // If viewing today, also include active running stopwatch time if active
      if (targetDate === todayString() && userName) {
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
      setActualSeconds(sec)

      // Determine day-of-week key (Sun..Sat) and whether this is a rest day
      const dayKey = getLocalWeekdayId(targetDate)
      const isRest = checkIsRestDay(targetDate, userSettings)

      // Target hours priority:
      // If rest day -> strictly 0
      // Otherwise: savedPlan -> weeklyPlan for day of week -> default 6
      let effectiveTargetHours = 6
      if (isRest) {
        effectiveTargetHours = 0
      } else if (savedPlan && savedPlan.targetHours !== undefined && !isNaN(Number(savedPlan.targetHours))) {
        effectiveTargetHours = Number(savedPlan.targetHours)
      } else if (weeklyPlan && weeklyPlan[dayKey]?.targetMinutes > 0) {
        effectiveTargetHours = Number((weeklyPlan[dayKey].targetMinutes / 60).toFixed(2))
      }

      setTargetHours(effectiveTargetHours)
      setIsRestDay(isRest)
      setRestType('rest')

      if (savedPlan) {
        setIsLocked(isRest ? true : Boolean(savedPlan.isLocked))
        const hasCustomGoals = savedPlan.goals && savedPlan.goals.some((g) => g && g.trim().length > 0)
        if (!hasCustomGoals && isRest) {
          setGoals([
            '🛋️ Full Rest & Recovery 🔋',
            '🧘 Relax and recharge your mind',
            '🌟 Prepare mindset for next week',
          ])
        } else {
          setGoals(savedPlan.goals || ['', '', ''])
        }
        setRows(savedPlan.rows || [])
        setNotes(savedPlan.notes || (isRest ? 'Rest & recovery day. Streak protected. 🛡️' : ''))
        setProgressRating(savedPlan.progressRating || (isRest ? 'excellent' : 'good'))
      } else {
        setIsLocked(isRest ? true : false)
        if (isRest) {
          setGoals([
            '🛋️ Full Rest & Recovery 🔋',
            '🧘 Relax and recharge your mind',
            '🌟 Prepare mindset for next week',
          ])
          setNotes('Rest & recovery day. Streak protected. 🛡️')
          setProgressRating('excellent')
          setRows([])
        } else {
          let initialRows = []
          if (weeklyPlan && weeklyPlan[dayKey]?.subjects) {
            const subjList = weeklyPlan[dayKey].subjects
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            initialRows = subjList.map((subj, idx) => ({
              id: `slot_${Date.now()}_${idx}`,
              time: '',
              block: 'Morning',
              slotType: 'Core Study',
              subject: subj,
              topic: '',
              plan: '',
              done: false,
            }))
          } else if (syllabus && syllabus.length > 0) {
            initialRows = syllabus.slice(0, 8).map((sub, idx) => ({
              id: `row_${Date.now()}_${idx}`,
              time: '',
              subject: sub.name,
              topic: '',
              plan: '',
              done: false,
            }))
          } else {
            initialRows = DEFAULT_SUBJECTS.map((s, idx) => ({
              id: `row_${Date.now()}_${idx}`,
              time: '',
              subject: s.subject,
              topic: '',
              plan: '',
              done: false,
            }))
          }
          setGoals(['', '', ''])
          setRows(initialRows)
          setNotes('')
          setProgressRating('good')
        }
      }
    } catch (err) {
      console.warn('Error loading day planner:', err)
    } finally {
      setLoading(false)
    }
  }, [userName])

  useEffect(() => {
    loadDay(currentDate)
  }, [currentDate, loadDay])

  // Real-time synchronization listeners across tabs & pages
  useEffect(() => {
    const handleUpdate = () => {
      loadDay(currentDate)
    }
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    window.addEventListener('study_settings_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
      window.removeEventListener('study_settings_updated', handleUpdate)
    }
  }, [currentDate, loadDay])

  const handleSaveNotes = async (newNotes) => {
    if (!userName) return
    try {
      const planData = {
        date: currentDate,
        dayNumber,
        targetHours: Number(targetHours) || 0,
        isRestDay: Boolean(isRestDay),
        restType,
        isLocked: Boolean(isLocked),
        goals,
        rows,
        notes: newNotes,
        progressRating,
        updatedAt: Date.now(),
      }
      await saveDayPlanner(userName, currentDate, planData)
      setSavedBadge(true)
      setTimeout(() => setSavedBadge(false), 2000)
    } catch (e) {
      console.warn('Auto-save notes failed:', e)
    }
  }

  // Instant Target Hours dropdown change with bidirectional sync
  const handleTargetChange = async (newVal) => {
    const hoursNum = parseHoursInput(newVal)
    setTargetHours(hoursNum)
    if (hoursNum === 0) {
      setIsRestDay(true)
      setRestType('rest')
    }
    setTargetSynced(true)
    setTimeout(() => setTargetSynced(false), 2500)

    // Automatically sync target hours to both dayPlanners and weeklyPlan in Firestore
    await syncTargetHours(userName, currentDate, hoursNum)
  }

  // Apply quick Rest Day presets (0h Full Rest, 2h Mock, 3h Revision)
  const handleApplyRestPreset = async (presetHours, presetType, defaultGoals, defaultNote) => {
    setTargetHours(presetHours)
    setIsRestDay(true)
    setRestType(presetType)
    setGoals(defaultGoals)
    if (!notes || notes.trim().length === 0 || notes.includes('Rest & Buffer Day') || notes.includes('Mock Test')) {
      setNotes(defaultNote)
    }
    setTargetSynced(true)
    setTimeout(() => setTargetSynced(false), 2500)

    await syncTargetHours(userName, currentDate, presetHours)
    const planData = {
      date: currentDate,
      dayNumber,
      targetHours: presetHours,
      isRestDay: true,
      restType: presetType,
      isLocked,
      goals: defaultGoals,
      rows,
      notes: defaultNote,
      progressRating: 'excellent',
      updatedAt: Date.now(),
    }
    await saveDayPlanner(userName, currentDate, planData)
  }

  // Toggle Rest Day Mode
  const handleToggleRestMode = async () => {
    const nextRest = !isRestDay
    setIsRestDay(nextRest)
    const newTarget = nextRest ? 0 : 6
    setTargetHours(newTarget)
    if (nextRest) {
      const restGoals = [
        '🛋️ Full Rest & Recovery 🔋',
        '📝 Mock Analysis / Light Revision (Optional)',
        '🌟 Relax & Prepare Mindset for Next Week',
      ]
      setGoals(restGoals)
      setNotes('Sunday Rest & Buffer Day — Streak Shield Active 🛡️')
      await syncTargetHours(userName, currentDate, 0)
      await saveDayPlanner(userName, currentDate, {
        date: currentDate,
        dayNumber,
        targetHours: 0,
        isRestDay: true,
        restType: 'rest',
        goals: restGoals,
        rows,
        notes: 'Sunday Rest & Buffer Day — Streak Shield Active 🛡️',
        progressRating: 'excellent',
        updatedAt: Date.now(),
      })
    } else {
      await syncTargetHours(userName, currentDate, 6)
      await saveDayPlanner(userName, currentDate, {
        date: currentDate,
        dayNumber,
        targetHours: 6,
        isRestDay: false,
        goals,
        rows,
        notes,
        progressRating,
        updatedAt: Date.now(),
      })
    }
  }

  // Handle custom target manual entry submission (e.g. 5:30 or 5.5)
  const handleCustomSubmit = (e) => {
    e?.preventDefault()
    if (!customInputVal.trim()) {
      setCustomInputMode(false)
      return
    }
    const parsed = parseHoursInput(customInputVal)
    handleTargetChange(parsed)
    setCustomInputMode(false)
    setCustomInputVal('')
  }

  // Save current sheet
  const handleSave = async (lockStatus = isLocked) => {
    if (!userName) {
      setShowAuthModal(true)
      return
    }
    setSaving(true)
    const planData = {
      date: currentDate,
      dayNumber,
      targetHours: Number(targetHours) || 0,
      isRestDay: Boolean(isRestDay),
      restType,
      isLocked: Boolean(lockStatus),
      goals,
      rows,
      notes,
      progressRating,
      updatedAt: Date.now(),
    }
    await saveDayPlanner(userName, currentDate, planData)
    // Also sync to weekly plan for this day of week
    await syncTargetHours(userName, currentDate, Number(targetHours) || 0)
    setSaving(false)
    setSavedBadge(true)
    setTimeout(() => setSavedBadge(false), 2000)
  }

  // Navigate date
  const changeDateBy = (offset) => {
    const [y, m, d] = currentDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + offset)
    const ny = dt.getFullYear()
    const nm = String(dt.getMonth() + 1).padStart(2, '0')
    const nd = String(dt.getDate()).padStart(2, '0')
    setDayNumber((prev) => Math.max(1, prev + offset))
    setCurrentDate(`${ny}-${nm}-${nd}`)
  }

  // Update top goals
  const updateGoal = (idx, text) => {
    if (isLocked) return
    const updated = [...goals]
    updated[idx] = text
    setGoals(updated)
  }

  // Update schedule rows
  const updateRow = (id, field, value) => {
    if (isLocked) return
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const addCustomRow = (block = 'Morning') => {
    if (isLocked) return
    const defaultTimeMap = {
      Morning: '06:30 AM - 08:30 AM',
      Afternoon: '02:00 PM - 04:00 PM',
      Evening: '05:30 PM - 07:30 PM',
      Night: '09:00 PM - 10:30 PM',
    }
    const newRow = {
      id: `slot_${Date.now()}`,
      block,
      time: defaultTimeMap[block] || '08:00 AM - 10:00 AM',
      slotType: 'Core Study',
      subject: DEFAULT_SUBJECTS[0].subject,
      topic: '',
      plan: '',
      done: false,
    }
    setRows((prev) => [...prev, newRow])
  }

  const deleteRow = (id) => {
    if (isLocked) return
    setRows(rows.filter((r) => r.id !== id))
  }

  // Start Timer for this row
  const handleStartTimer = (row) => {
    if (isRestDay) {
      alert('Today is designated as a Rest Day. Timer and study logging are disabled to protect your rest!')
      return
    }
    handleSave()
    navigate('/', {
      state: {
        subject: row.subject || '',
        topic: row.topic || row.plan || '',
      },
    })
  }

  // Complete Day & Rollover uncompleted tasks to next day
  const handleCompleteAndRollover = async () => {
    if (!userName) {
      setShowAuthModal(true)
      return
    }
    setCompleting(true)
    const [y, m, d] = currentDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    const nextDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

    const currentPlanData = {
      date: currentDate,
      dayNumber,
      targetHours: Number(targetHours) || 0,
      isRestDay: Boolean(isRestDay),
      restType,
      goals,
      rows,
      notes,
      progressRating,
    }

    try {
      await finalizeAndRolloverDay(userName, currentDate, nextDate, currentPlanData)
      setShowCompleteModal(false)
      setIsLocked(true)
      // Navigate to next day!
      setCurrentDate(nextDate)
    } catch (err) {
      console.error('Failed to complete & rollover day:', err)
      alert('Could not rollover day. Please check your connection and try again.')
    } finally {
      setCompleting(false)
    }
  }

  // Progress metrics
  const completedCount = rows.filter((r) => r.done).length
  const totalCount = rows.length
  const uncompletedRows = rows.filter(
    (r) => !r.done && (r.topic || r.plan || (r.subject && r.subject !== 'New Subject'))
  )
  const uncompletedGoalsCount = goals.filter((g) => g && g.trim().length > 0).length

  // Study hours comparison
  const targetSec = (Number(targetHours) || 6) * 3600
  const hoursPct = targetSec > 0 ? Math.min(100, Math.round((actualSeconds / targetSec) * 100)) : 0
  const goalMet = targetSec > 0 && actualSeconds >= targetSec
  const quote = QUOTES[(dayNumber - 1) % QUOTES.length]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 max-w-4xl mx-auto w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Timer</span>
        </button>

        <div className="flex items-center gap-2">
          {!userName && (
            <button
              type="button"
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              <span>✨</span>
              <span>Sign In</span>
            </button>
          )}

          {/* Kit Plan Button */}
          <button
            type="button"
            onClick={handleOpenAIModal}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-[0.98] cursor-pointer"
            title="Generate custom study timetable with Kit"
          >
            <span>✨</span>
            <span className="hidden sm:inline">Kit Plan</span>
            <span className="sm:hidden">Kit Plan</span>
          </button>

          {/* Kit AI Mentor Button */}
          <button
            type="button"
            onClick={handleOpenAICoach}
            className="px-3 py-1.5 rounded-xl bg-[#1d1d28] hover:bg-[#272738] border border-purple-500/30 text-purple-300 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Chat with Kit AI"
          >
            <span>🤖</span>
            <span>Kit AI</span>
          </button>

          {savedBadge && (
            <span className="text-xs text-green-400 font-semibold bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full animate-pulse">
              ✓ Saved!
            </span>
          )}

          {!isLocked ? (
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="pill-btn px-4 h-9 text-xs font-semibold"
              style={{ background: '#8b5cf6', color: 'white' }}
            >
              {saving ? 'Saving…' : 'Save Plan'}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full flex items-center gap-1">
                <span>🔒</span>
                <span>Day Finalized</span>
              </span>
              <button
                onClick={() => {
                  if (window.confirm('Unlock this day to make changes?')) {
                    setIsLocked(false)
                    handleSave(false)
                  }
                }}
                className="text-xs text-gray-400 hover:text-white underline transition-colors"
              >
                Unlock
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col px-3 pb-24 sm:pb-16 max-w-4xl mx-auto w-full gap-4">
        {/* ── Main Planner Sheet Container ── */}
        <div
          className="rounded-3xl p-4 sm:p-7 border border-[#2a2a2a] flex flex-col gap-5 relative shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #141416 0%, #111112 100%)',
            boxShadow: '0 0 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Locked Notice Banner */}
          {isLocked && !isRestDay && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
              <div className="flex items-center gap-2">
                <span className="text-base">🔒</span>
                <span className="font-bold">
                  DAY {dayNumber} IS FINALIZED & LOCKED
                </span>
                <span className="text-gray-400 text-[11px] hidden sm:inline">
                  (Records are preserved. Unfinished tasks were carried over to next day.)
                </span>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Unlock this day to edit?')) {
                    setIsLocked(false)
                    handleSave(false)
                  }
                }}
                className="font-semibold underline hover:text-white ml-2"
              >
                Edit Anyway
              </button>
            </div>
          )}

          {/* ── Day Badge, Date & Quote Bar ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#18181b] p-3 sm:p-4 rounded-2xl border border-[#2b2b30]">
            {/* Day Badge & Nav */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div
                className="px-3.5 py-1.5 rounded-full font-black text-white text-xs sm:text-sm flex items-center gap-1.5 shadow-md whitespace-nowrap flex-shrink-0 select-none"
                style={{
                  background:
                    dayNumber % 2 === 1
                      ? 'linear-gradient(135deg, #ec4899, #d946ef)'
                      : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                }}
              >
                <span className="whitespace-nowrap">DAY {dayNumber}</span>
                <span>🌸</span>
              </div>

              {/* Prev / Next day buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => changeDateBy(-1)}
                  className="w-7 h-7 rounded-lg bg-[#222] hover:bg-[#333] text-gray-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  title="Previous Day"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => changeDateBy(1)}
                  className="w-7 h-7 rounded-lg bg-[#222] hover:bg-[#333] text-gray-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                  title="Next Day"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2 text-xs text-gray-300 flex-shrink-0">
              <span className="text-gray-400 font-medium">Date:</span>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="rounded-xl bg-[#111] border border-[#333] text-white px-3 py-1.5 text-xs outline-none focus:border-purple-500"
              />
            </div>

            {/* Daily Quote */}
            <div className="text-xs text-pink-300 italic font-medium text-center sm:text-right flex-1 min-w-0 truncate">
              "{quote}"
            </div>
          </div>

          {/* ── Rest & Buffer Day Shield Banner ── */}
          {isRestDay && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 via-[#181824] to-indigo-950/40 border border-purple-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🛋️</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-wide">
                      Sunday Rest & Buffer Day
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                      <span>🛡️</span> Streak Shield Active
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Rest & recovery day. Your study streak is completely protected. Study slots and timers are locked for rest; you can write reflections in the notes below.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-purple-300 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30">
                  0h · Rest Day
                </span>
              </div>
            </div>
          )}

          {/* ── Daily Study Target Hours vs Actual Stopwatch Time Card ── */}
          <div className="p-4 rounded-2xl bg-[#161619] border border-[#2a2a2f] flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#242428] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">⏱️</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Daily Study Goal & Actual Recorded Time
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Planned Target Hours Dropdown & Custom Time Input with Instant Sync */}
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <span className="text-gray-400 font-medium">🎯 Target:</span>

                  {isRestDay ? (
                    <span className="text-xs font-bold text-purple-300 bg-purple-950/40 px-2.5 py-1 rounded-xl border border-purple-500/30 flex items-center gap-1">
                      <span>🛋️</span>
                      <span>0h (Rest Day)</span>
                    </span>
                  ) : customInputMode ? (
                    <form onSubmit={handleCustomSubmit} className="flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={customInputVal}
                        onChange={(e) => setCustomInputVal(e.target.value)}
                        placeholder="e.g. 5:30, 5.5"
                        className="w-24 px-2 py-1 rounded-xl bg-[#13131c] border border-purple-500 text-purple-300 font-bold font-mono text-xs outline-none focus:ring-1 focus:ring-purple-500 shadow-inner"
                      />
                      <button
                        type="submit"
                        className="px-2 py-1 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-colors shadow"
                        title="Set target"
                      >
                        Set
                      </button>
                      <button
                        type="button"
                        onClick={() => setCustomInputMode(false)}
                        className="px-1.5 py-1 text-gray-400 hover:text-gray-200 text-xs transition-colors"
                        title="Cancel"
                      >
                        ✕
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-1">
                      <select
                        value={targetHours}
                        disabled={isLocked || isRestDay}
                        onChange={(e) => {
                          if (e.target.value === 'custom') {
                            setCustomInputVal(String(targetHours))
                            setCustomInputMode(true)
                          } else {
                            handleTargetChange(e.target.value)
                          }
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[#13131c] border border-[#2e2e42] text-purple-300 font-bold font-mono text-xs outline-none focus:border-purple-500 disabled:opacity-60 cursor-pointer hover:border-purple-500/50 transition-all shadow-inner"
                      >
                        {availableTargetOptions.map((h) => (
                          <option key={h} value={h} className="bg-[#13131c] text-white">
                            {formatTargetHoursText(h, true)}
                          </option>
                        ))}
                        <option value="custom" className="bg-[#13131c] text-purple-400 font-semibold">
                          ✏️ Custom (type 5:30, etc.)...
                        </option>
                      </select>

                      {!isLocked && !isRestDay && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomInputVal(String(targetHours))
                            setCustomInputMode(true)
                          }}
                          className="text-gray-400 hover:text-purple-300 p-1 rounded-lg hover:bg-purple-500/10 transition-colors text-xs"
                          title="Type custom target (e.g. 5:30 or 5.5)"
                        >
                          ✏️
                        </button>
                      )}
                    </div>
                  )}

                  {targetSynced && (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-fadeIn whitespace-nowrap">
                      Synced ✓
                    </span>
                  )}
                </div>

                {/* Status Badge */}
                {isRestDay && targetHours === 0 ? (
                  actualSeconds > 0 ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 whitespace-nowrap flex items-center gap-1">
                      <span>🛋️</span>
                      <span>+{formatHoursMinutes(actualSeconds)} Bonus Study (Streak Safe 🛡️)</span>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 whitespace-nowrap flex items-center gap-1">
                      <span>🛋️</span>
                      <span>Rest Day · Streak Shield Active 🛡️</span>
                    </span>
                  )
                ) : goalMet ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/40 whitespace-nowrap">
                    ✓ Goal Achieved! 🎉
                  </span>
                ) : actualSeconds > 0 ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                    ⏳ In Progress ({hoursPct}%)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 whitespace-nowrap">
                    Not Started
                  </span>
                )}
              </div>
            </div>

            {/* Progress Meter */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">
                  Actual Time Studied: <strong className="text-white font-mono">{formatHoursMinutes(actualSeconds)}</strong>
                </span>
                <span className="font-mono font-bold text-purple-400">
                  {isRestDay && targetHours === 0
                    ? actualSeconds > 0
                      ? `+${formatHoursMinutes(actualSeconds)} Bonus Studied`
                      : '0h Target (Rest Day 🛋️)'
                    : `${formatHoursMinutes(actualSeconds)} / ${formatTargetHoursText(targetHours, false)} (${hoursPct}%)`}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-[#252528] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width:
                      isRestDay && targetHours === 0
                        ? actualSeconds > 0
                          ? '100%'
                          : '100%'
                        : `${hoursPct}%`,
                    background:
                      isRestDay && targetHours === 0
                        ? actualSeconds > 0
                          ? 'linear-gradient(90deg, #10b981, #22c55e)'
                          : 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                        : goalMet
                        ? '#22c55e'
                        : 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Today's Top 3 Priorities & Goals Card ── */}
          <div className="p-4 rounded-2xl bg-[#161619] border border-[#2a2a2f] flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#242428] pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Today's Top 3 Priorities & Goals
                </span>
              </div>
              <span className="text-[11px] text-purple-400 font-medium hidden sm:inline">
                Focus on the most important targets today
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[#121214] border border-[#242428] focus-within:border-purple-500/80 transition-colors shadow-inner"
                >
                  <span className="w-5 h-5 rounded-full bg-purple-500/15 text-purple-400 font-bold text-xs flex items-center justify-center font-mono flex-shrink-0">
                    {idx + 1}
                  </span>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={goals[idx] || ''}
                    onChange={(e) => updateGoal(idx, e.target.value)}
                    placeholder={`Priority #${idx + 1}...`}
                    className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none disabled:opacity-75"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Datalist for fast subject auto-completion */}
          <datalist id="dayplanner-subjects">
            {availableSubjects.map((sub, i) => (
              <option key={i} value={sub} />
            ))}
          </datalist>

          {/* ── Modern Daily Study Time Table ── */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <span>📋</span>
                  <span>Daily Study Time Table</span>
                </span>
                <span className="text-xs font-mono text-purple-300 bg-purple-500/15 border border-purple-500/30 px-2.5 py-0.5 rounded-full">
                  {completedCount}/{totalCount} Slots Done
                </span>
              </div>

              {!isLocked && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenAIModal}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow transition-all cursor-pointer"
                    title="Generate personalized study schedule with Kit"
                  >
                    <span>✨</span>
                    <span>Kit Generated Plan</span>
                  </button>

                  <div className="flex items-center bg-[#18181c] border border-[#2e2e38] rounded-xl p-0.5">
                    <button
                      type="button"
                      onClick={() => addCustomRow('Morning')}
                      className="text-xs px-2.5 py-1 rounded-lg hover:bg-[#272730] text-gray-200 transition-colors"
                      title="Add Morning Slot"
                    >
                      + Morning
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomRow('Afternoon')}
                      className="text-xs px-2.5 py-1 rounded-lg hover:bg-[#272730] text-gray-200 transition-colors hidden sm:inline"
                      title="Add Afternoon Slot"
                    >
                      + Afternoon
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomRow('Evening')}
                      className="text-xs px-2.5 py-1 rounded-lg hover:bg-[#272730] text-gray-200 transition-colors hidden sm:inline"
                      title="Add Evening Slot"
                    >
                      + Evening
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomRow('Night')}
                      className="text-xs px-2.5 py-1 rounded-lg hover:bg-[#272730] text-gray-200 transition-colors hidden sm:inline"
                      title="Add Night Slot"
                    >
                      + Night
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomRow('Morning')}
                      className="text-xs px-2 py-1 rounded-lg bg-purple-600/30 text-purple-300 hover:bg-purple-600 hover:text-white transition-colors sm:hidden font-semibold"
                    >
                      + Slot
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Time Table / Schedule Grid */}
            {rows.length === 0 ? (
              <div className={`p-8 rounded-2xl border border-dashed text-center flex flex-col items-center justify-center gap-3 ${
                isRestDay ? 'border-purple-500/30 bg-purple-950/10' : 'border-[#2f2f38] bg-[#131316]'
              }`}>
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-2xl">
                  {isRestDay ? '🛋️' : '📅'}
                </div>
                <h4 className="text-sm font-bold text-white">
                  {isRestDay ? 'Sunday Rest & Recovery Day' : `No Study Slots Added for Day ${dayNumber}`}
                </h4>
                <p className="text-xs text-gray-400 max-w-sm">
                  {isRestDay
                    ? 'No study slots scheduled. Take rest, relax, and recharge your energy for next week! Streak Shield is active.'
                    : 'Apne routine aur exam ke hisaab se Kit se best timetable banwayein, ya manually slots add karein.'}
                </p>
                {!isRestDay && !isLocked && (
                  <div className="flex items-center gap-2.5 mt-2">
                    <button
                      type="button"
                      onClick={handleOpenAIModal}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                    >
                      <span>✨</span>
                      <span>Kit Generated Plan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addCustomRow('Morning')}
                      className="px-4 py-2 rounded-xl bg-[#222] hover:bg-[#2b2b30] border border-[#333] text-gray-200 font-semibold text-xs"
                    >
                      + Add Slot Manually
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#2b2b30] bg-[#121214] shadow-inner">
                <table className="w-full min-w-[860px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#2b2b30] text-gray-400 font-bold uppercase tracking-wider bg-[#17171b]">
                      <th className="p-3 w-40 whitespace-nowrap">BLOCK & TIME ⏰</th>
                      <th className="p-3 w-32 whitespace-nowrap">TYPE 🏷️</th>
                      <th className="p-3 w-44 whitespace-nowrap">SUBJECT 📑</th>
                      <th className="p-3 w-52 whitespace-nowrap">TOPIC / CHAPTER ✏️</th>
                      <th className="p-3 whitespace-nowrap">TARGET & PLAN 💡</th>
                      <th className="p-3 w-16 text-center whitespace-nowrap">DONE ✓</th>
                      <th className="p-3 w-24 text-center whitespace-nowrap">TIMER ▶️</th>
                      {!isLocked && <th className="p-3 w-10 text-center"></th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#202025]">
                    {rows.map((row) => {
                      const currentType = SLOT_TYPES.find((t) => t.id === row.slotType) || SLOT_TYPES[0]
                      return (
                        <tr
                          key={row.id}
                          className={`transition-colors hover:bg-[#18181c] ${
                            row.done ? 'bg-[#101012] opacity-75' : ''
                          }`}
                        >
                          {/* Block & Time */}
                          <td className="p-2.5">
                            <div className="flex flex-col gap-1">
                              <select
                                disabled={isLocked}
                                value={row.block || 'Morning'}
                                onChange={(e) => updateRow(row.id, 'block', e.target.value)}
                                className="w-full bg-[#16161a] border border-[#2a2a35] rounded px-1.5 py-0.5 text-[11px] font-semibold text-gray-300 outline-none focus:border-purple-500 cursor-pointer disabled:opacity-75"
                              >
                                {TIME_BLOCKS.map((tb) => (
                                  <option key={tb.id} value={tb.id} className="bg-[#16161a] text-white">
                                    {tb.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                disabled={isLocked}
                                value={row.time || ''}
                                onChange={(e) => updateRow(row.id, 'time', e.target.value)}
                                placeholder="09:00 - 10:30 AM"
                                className="w-full bg-transparent border-b border-transparent focus:border-purple-500 px-1 py-0.5 text-[11px] font-mono text-gray-400 outline-none disabled:opacity-75"
                              />
                            </div>
                          </td>

                          {/* Slot Type */}
                          <td className="p-2.5">
                            <select
                              disabled={isLocked}
                              value={row.slotType || 'Core Study'}
                              onChange={(e) => updateRow(row.id, 'slotType', e.target.value)}
                              className={`rounded-lg px-2 py-1 text-[11px] font-bold border outline-none cursor-pointer disabled:opacity-75 ${currentType.badge} bg-[#16161d]`}
                            >
                              {SLOT_TYPES.map((st) => (
                                <option key={st.id} value={st.id} className="bg-[#16161a] text-white">
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Subject */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              disabled={isLocked}
                              list={`subj-list-${row.id}`}
                              value={row.subject || ''}
                              onChange={(e) => updateRow(row.id, 'subject', e.target.value)}
                              placeholder="Select / Type Subject"
                              className="w-full bg-[#16161a] border border-[#2a2a35] focus:border-purple-500 rounded px-2 py-1 text-xs text-white outline-none disabled:opacity-75"
                            />
                            <datalist id={`subj-list-${row.id}`}>
                              {availableSubjects.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </td>

                          {/* Topic */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.topic || ''}
                              onChange={(e) => updateRow(row.id, 'topic', e.target.value)}
                              placeholder="e.g. Fundamental Rights"
                              className={`w-full bg-transparent border-b border-transparent focus:border-purple-500 px-1 py-1 text-xs text-white outline-none disabled:opacity-75 ${
                                row.done ? 'line-through text-gray-500' : ''
                              }`}
                            />
                          </td>

                          {/* Target & Plan */}
                          <td className="p-2.5">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={row.plan || ''}
                              onChange={(e) => updateRow(row.id, 'plan', e.target.value)}
                              placeholder="e.g. 25 PYQs + revision notes"
                              className={`w-full bg-transparent border border-transparent focus:border-[#333] rounded px-1.5 py-1 text-xs text-gray-300 outline-none disabled:opacity-75 ${
                                row.done ? 'line-through text-gray-600' : ''
                              }`}
                            />
                          </td>

                          {/* Done Checkbox */}
                          <td className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={row.done || false}
                              onChange={(e) => updateRow(row.id, 'done', e.target.checked)}
                              className="w-4 h-4 rounded accent-purple-500 cursor-pointer disabled:opacity-60"
                            />
                          </td>

                          {/* Start Timer Action */}
                          <td className="p-2.5 text-center">
                            <button
                              type="button"
                              disabled={isLocked || isRestDay}
                              onClick={() => handleStartTimer(row)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all whitespace-nowrap shadow-sm ${
                                isRestDay
                                  ? 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                                  : 'bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white hover:shadow-purple-500/30'
                              }`}
                              title={isRestDay ? 'Timer disabled on Rest Day' : 'Open Stopwatch with this topic'}
                            >
                              ▶️ Start
                            </button>
                          </td>

                          {/* Delete */}
                          {!isLocked && (
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => deleteRow(row.id)}
                                className="text-gray-500 hover:text-red-400 text-xs p-1 rounded hover:bg-red-500/10 transition-colors"
                                title="Delete slot"
                              >
                                🗑️
                              </button>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Revision / Notes & Progress Rating Area ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#242426] pt-4">
            {/* Revision / Notes Box */}
            <div className="md:col-span-2 flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">📖</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  REVISION / NOTES
                </span>
                {isRestDay && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Editable on Rest Day ✏️
                  </span>
                )}
              </div>
              <textarea
                disabled={isLocked && !isRestDay}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={(e) => handleSaveNotes(e.target.value)}
                placeholder={isRestDay ? "Write your reflections, relaxation notes, or thoughts for next week..." : "Write key takeaways, weak areas to revise, or formulas to remember..."}
                rows={3}
                className={`w-full rounded-xl bg-[#141417] border p-3 text-xs text-white placeholder-gray-600 outline-none transition-colors ${
                  isRestDay ? 'border-purple-500/40 focus:border-purple-500' : 'border-[#2b2b30] focus:border-purple-500 disabled:opacity-75'
                }`}
              />
            </div>

            {/* Today's Progress Emoji Selector */}
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-[#18181c] border border-[#2b2b30] justify-center items-center text-center">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                TODAY'S PROGRESS
              </span>
              <div className="flex items-center gap-3 py-1">
                {[
                  { key: 'not_good', emoji: '😟', label: 'Not Good' },
                  { key: 'average', emoji: '😐', label: 'Average' },
                  { key: 'good', emoji: '🙂', label: 'Good' },
                  { key: 'excellent', emoji: '🤩', label: 'Excellent' },
                ].map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    disabled={isLocked}
                    onClick={() => setProgressRating(p.key)}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      progressRating === p.key
                        ? 'scale-125 opacity-100 font-bold'
                        : 'opacity-40 hover:opacity-80 scale-100'
                    }`}
                  >
                    <span className="text-2xl">{p.emoji}</span>
                    <span className="text-[9px] text-gray-300 whitespace-nowrap">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Complete Day & Move to Next Day Button ── */}
          {!isLocked ? (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-pink-950/40 border border-purple-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>{isRestDay ? '🛋️' : '🏁'}</span>
                  <span>
                    {isRestDay
                      ? `Complete Rest Day ${dayNumber} & Proceed to Day ${dayNumber + 1}?`
                      : `Finish Day ${dayNumber} & Lock Today's Record?`}
                  </span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {isRestDay
                    ? `Day ${dayNumber} is marked as Rest Day with Streak Shield 🛡️. Backlogs roll over cleanly to Day ${dayNumber + 1}.`
                    : uncompletedRows.length > 0
                    ? `${uncompletedRows.length} unfinished topic(s) will automatically rollover to Day ${dayNumber + 1}.`
                    : 'All planned topics were checked off! Ready for tomorrow.'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {isRestDay && (
                  <button
                    type="button"
                    onClick={handleCompleteAndRollover}
                    disabled={completing}
                    className="pill-btn px-4 h-10 text-xs font-bold bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white transition-all whitespace-nowrap shadow-sm"
                  >
                    {completing ? 'Moving…' : `🛋️ Skip / Rest Done → Day ${dayNumber + 1}`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowCompleteModal(true)}
                  className="pill-btn px-5 h-10 text-xs font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 whitespace-nowrap hover:scale-105 transition-all"
                >
                  🏁 {isRestDay ? 'Finalize Day & Move →' : `Complete Day & Move to Day ${dayNumber + 1} →`}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-[#18181c] border border-[#2b2b30] flex items-center justify-between">
              <span className="text-xs text-gray-400">
                Day {dayNumber} is finalized. Ready to check tomorrow's plan?
              </span>
              <button
                onClick={() => changeDateBy(1)}
                className="pill-btn px-4 h-8 text-xs font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white"
              >
                Go to Day {dayNumber + 1} →
              </button>
            </div>
          )}

          {/* ── Footer Motivation Note ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-[#242426] pt-3 text-center sm:text-left">
            <p className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
              <span>👑</span>
              <span>You Can Do It! Keep Learning, Keep Growing.</span>
              <span>📚</span>
            </p>
            <p className="text-[11px] text-gray-500">
              Future is created by What you do Today, not Tomorrow. ✨
            </p>
          </div>
        </div>
      </div>

      {/* ── Confirmation Modal: End Day & Rollover ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 flex flex-col gap-4" style={{ animation: 'scaleIn 150ms ease-out' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🏁</span>
                <span>Complete Day {dayNumber}?</span>
              </h3>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-500 hover:text-gray-300 text-lg">
                ×
              </button>
            </div>

            <div className="flex flex-col gap-2.5 text-xs text-gray-300">
              <p>
                Aapka Day {dayNumber} final lock ho jayega taaki pichla record secure rahe aur badla na ja sake.
              </p>

              {/* Stats Summary */}
              <div className="p-3 rounded-xl bg-[#111] border border-[#2a2a2a] flex flex-col gap-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Study Time:</span>
                  <span className="font-mono font-bold text-white">{formatHoursMinutes(actualSeconds)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Target Goal:</span>
                  <span className="font-bold text-purple-400">
                    {isRestDay && targetHours === 0
                      ? '0h · Rest Day (Streak Safe 🛡️)'
                      : `${formatTargetHoursText(targetHours, true)} (${goalMet ? 'Achieved ✓' : 'Incomplete'})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed Topics:</span>
                  <span className="font-bold text-green-400">{completedCount} / {totalCount}</span>
                </div>
              </div>

              {/* Streak Shield Notice */}
              {isRestDay && (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-2 text-[11px]">
                  <span className="text-base">🛡️</span>
                  <span>
                    <strong>Streak Shield Active:</strong> Aaj rest lene par bhi aapki continuous study streak safe rahegi!
                  </span>
                </div>
              )}

              {/* Uncompleted Items Rollover Alert */}
              {uncompletedRows.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-1.5">
                  <span className="font-bold text-amber-300 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>Ye {uncompletedRows.length} topics kal ke targets me jud jayenge:</span>
                  </span>
                  <ul className="list-disc list-inside text-gray-300 pl-1">
                    {uncompletedRows.map((r) => (
                      <li key={r.id} className="truncate">
                        <strong>{r.subject}:</strong> {r.topic || r.plan || 'Task'}
                      </li>
                    ))}
                  </ul>
                  <span className="text-[10px] text-amber-400/80 italic mt-0.5">
                    "Kal nahi ho paya tha, aaj pehle ye karna hai!" tag ke saath aayenge.
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="pill-btn flex-1 h-10 text-xs"
                style={{ background: '#2a2a2a', color: 'white' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completing}
                onClick={handleCompleteAndRollover}
                className="pill-btn flex-1 h-10 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-purple-600 hover:opacity-90"
              >
                {completing ? 'Rolling over…' : `Yes, Move to Day ${dayNumber + 1} →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Floating Kit AI Button ── */}
      <button
        type="button"
        onClick={handleOpenAICoach}
        className="fixed bottom-6 right-6 z-40 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 text-white shadow-xl shadow-purple-600/40 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer border border-purple-400/30 group"
        title="Chat with Kit AI"
      >
        <span className="text-lg">🤖</span>
        <span className="text-xs font-bold tracking-wide">
          Kit AI
        </span>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
      </button>

      {/* ── AI Timetable Generator Modal ── */}
      <AITimeTableModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
        userContext={userAIContext}
        onApply={handleApplyAISlots}
      />

      {/* ── AI Coach Drawer ── */}
      <AICoachDrawer
        isOpen={showAICoach}
        onClose={() => setShowAICoach(false)}
        userContext={userAIContext}
      />

      {/* ── Guest Auth Modal ── */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false)
          window.location.reload()
        }}
        title="Save Your Day Plan"
        subtitle="Sign in or create an account to save your study goals, to-do list, and sync across devices."
        actionContext="plan"
      />
    </div>
  )
}
