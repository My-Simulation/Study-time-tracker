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

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getDayPlanner, saveDayPlanner, calculateDayNumber,
  getSyllabus, getUserSessions, finalizeAndRolloverDay,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes } from '../utils/formatTime'

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedBadge, setSavedBadge] = useState(false)

  // Sheet fields
  const [targetHours, setTargetHours] = useState(6)
  const [actualSeconds, setActualSeconds] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [goals, setGoals] = useState(['', '', ''])
  const [rows, setRows] = useState([])
  const [notes, setNotes] = useState('')
  const [progressRating, setProgressRating] = useState('good') // 'not_good' | 'average' | 'good' | 'excellent'

  // Rollover modal
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completing, setCompleting] = useState(false)

  // Load data for currentDate
  const loadDay = useCallback(async (targetDate) => {
    setLoading(true)
    try {
      const [savedPlan, computedDay, syllabus, sessions] = await Promise.all([
        getDayPlanner(userName, targetDate),
        calculateDayNumber(userName, targetDate),
        getSyllabus(userName),
        getUserSessions(userName),
      ])

      setDayNumber(computedDay || 1)

      // Calculate actual studied time from sessions recorded on targetDate
      const daySessions = (sessions || []).filter((s) => s.date === targetDate)
      const sec = daySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
      setActualSeconds(sec)

      if (savedPlan) {
        setTargetHours(savedPlan.targetHours !== undefined ? savedPlan.targetHours : 6)
        setIsLocked(Boolean(savedPlan.isLocked))
        setGoals(savedPlan.goals || ['', '', ''])
        setRows(savedPlan.rows || [])
        setNotes(savedPlan.notes || '')
        setProgressRating(savedPlan.progressRating || 'good')
      } else {
        // Initialize default empty schedule based on syllabus or default subjects
        let initialRows = []
        if (syllabus && syllabus.length > 0) {
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
        setTargetHours(6)
        setIsLocked(false)
        setGoals(['', '', ''])
        setRows(initialRows)
        setNotes('')
        setProgressRating('good')
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

  // Save current sheet
  const handleSave = async (lockStatus = isLocked) => {
    setSaving(true)
    const planData = {
      date: currentDate,
      dayNumber,
      targetHours: Number(targetHours) || 6,
      isLocked: Boolean(lockStatus),
      goals,
      rows,
      notes,
      progressRating,
      updatedAt: Date.now(),
    }
    await saveDayPlanner(userName, currentDate, planData)
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

  const addCustomRow = () => {
    if (isLocked) return
    const newRow = {
      id: `row_${Date.now()}`,
      time: '',
      subject: 'New Subject',
      topic: '',
      plan: '',
      done: false,
    }
    setRows([...rows, newRow])
  }

  const deleteRow = (id) => {
    if (isLocked) return
    setRows(rows.filter((r) => r.id !== id))
  }

  // Start Timer for this row
  const handleStartTimer = (row) => {
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
    setCompleting(true)
    const [y, m, d] = currentDate.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + 1)
    const nextDate = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`

    const currentPlanData = {
      date: currentDate,
      dayNumber,
      targetHours: Number(targetHours) || 6,
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

      <div className="flex-1 flex flex-col px-3 pb-16 max-w-4xl mx-auto w-full gap-4">
        {/* ── Main Planner Sheet Container ── */}
        <div
          className="rounded-3xl p-4 sm:p-7 border border-[#2a2a2a] flex flex-col gap-5 relative shadow-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #141416 0%, #111112 100%)',
            boxShadow: '0 0 40px rgba(0,0,0,0.8)',
          }}
        >
          {/* Locked Notice Banner */}
          {isLocked && (
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

          {/* Header Banners & Sticky Notes */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-[#242426] pb-5">
            {/* Left Sticky Note */}
            <div
              className="p-3 rounded-2xl transform -rotate-1 shadow-md max-w-[190px] border"
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
              }}
            >
              <p className="text-[11px] font-bold text-amber-300 tracking-tight leading-snug">
                📌 Little Progress Everyday Adds to Big Results ⭐
              </p>
            </div>

            {/* Center Title */}
            <div className="text-center flex flex-col items-center">
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 tracking-tight">
                ✨ My Plan. My Time. My Success. ✨
              </h1>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5 font-medium">
                <span>💕 Discipline Today, Success Tomorrow.</span>
                <span>🌱</span>
              </p>
            </div>

            {/* Right Sticky Note */}
            <div
              className="p-3 rounded-2xl transform rotate-1 shadow-md max-w-[190px] border text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(236, 72, 153, 0.04) 100%)',
                borderColor: 'rgba(236, 72, 153, 0.3)',
              }}
            >
              <p className="text-[11px] font-black text-pink-300 tracking-wider uppercase leading-snug">
                FOCUS • STUDY<br />IMPROVE • REPEAT 💕
              </p>
            </div>
          </div>

          {/* ── Day Badge, Date & Quote Bar ── */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#18181b] p-3 sm:p-4 rounded-2xl border border-[#2b2b30]">
            {/* Day Badge & Nav */}
            <div className="flex items-center gap-3">
              <div
                className="px-4 py-1.5 rounded-full font-black text-white text-sm sm:text-base flex items-center gap-1.5 shadow-md"
                style={{
                  background:
                    dayNumber % 2 === 1
                      ? 'linear-gradient(135deg, #ec4899, #d946ef)'
                      : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                }}
              >
                <span>DAY {dayNumber}</span>
                <span>🌸</span>
              </div>

              {/* Prev / Next day buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => changeDateBy(-1)}
                  className="w-7 h-7 rounded-lg bg-[#222] hover:bg-[#333] text-gray-300 flex items-center justify-center text-xs transition-colors"
                  title="Previous Day"
                >
                  ◀
                </button>
                <button
                  onClick={() => changeDateBy(1)}
                  className="w-7 h-7 rounded-lg bg-[#222] hover:bg-[#333] text-gray-300 flex items-center justify-center text-xs transition-colors"
                  title="Next Day"
                >
                  ▶
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="text-gray-400 font-medium">Date:</span>
              <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="rounded-xl bg-[#111] border border-[#333] text-white px-3 py-1.5 text-xs outline-none focus:border-purple-500"
              />
            </div>

            {/* Daily Quote */}
            <div className="text-xs text-pink-300 italic font-medium text-center sm:text-right">
              "{quote}"
            </div>
          </div>

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
                {/* Planned Target Hours Input */}
                <div className="flex items-center gap-1.5 text-xs text-gray-300">
                  <span className="text-gray-500">Planned Target:</span>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={targetHours}
                    disabled={isLocked}
                    onChange={(e) => setTargetHours(e.target.value)}
                    className="w-12 text-center rounded-lg bg-[#111] border border-[#333] text-purple-300 font-bold font-mono py-0.5 outline-none focus:border-purple-500 disabled:opacity-60"
                  />
                  <span className="font-semibold text-gray-400">Hours</span>
                </div>

                {/* Status Badge */}
                {goalMet ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-green-500/20 text-green-300 border border-green-500/40 whitespace-nowrap">
                    ✓ Goal Achieved! 🎉
                  </span>
                ) : actualSeconds > 0 ? (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                    ⏳ In Progress ({hoursPct}%)
                  </span>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 whitespace-nowrap">
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
                  {formatHoursMinutes(actualSeconds)} / {targetHours}h ({hoursPct}%)
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-[#252528] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${hoursPct}%`,
                    background:
                      goalMet
                        ? '#22c55e'
                        : 'linear-gradient(90deg, #ec4899, #8b5cf6)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── 3 Focus & Affirmation Cards Row ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Card 1: TODAY'S FOCUS */}
            <div
              className="p-4 rounded-2xl flex flex-col gap-2.5 border"
              style={{
                background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.07) 0%, rgba(244, 114, 182, 0.02) 100%)',
                borderColor: 'rgba(244, 114, 182, 0.25)',
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-pink-500/20 pb-1.5">
                <span className="text-xs font-black text-pink-300 tracking-wider uppercase">
                  TODAY'S FOCUS
                </span>
                <span className="ml-auto text-xs">⭐</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-pink-400 text-xs">❤️</span>
                  <span>Plan your study</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-pink-400 text-xs">❤️</span>
                  <span>Stay away from distractions</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-pink-400 text-xs">❤️</span>
                  <span>Be consistent</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-pink-400 text-xs">❤️</span>
                  <span>Trust the process</span>
                </li>
              </ul>
            </div>

            {/* Card 2: TODAY'S TOP 3 GOALS */}
            <div
              className="p-4 rounded-2xl flex flex-col gap-2.5 border"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.02) 100%)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
              }}
            >
              <div className="flex items-center justify-between border-b border-purple-500/20 pb-1.5">
                <span className="text-xs font-black text-purple-300 tracking-wider uppercase">
                  TODAY'S TOP 3 GOALS
                </span>
                <span className="text-xs">⭐️</span>
              </div>
              <div className="flex flex-col gap-2 pt-0.5">
                {[0, 1, 2].map((idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="font-bold text-xs text-purple-400 font-mono">{idx + 1}.</span>
                    <input
                      type="text"
                      disabled={isLocked}
                      value={goals[idx] || ''}
                      onChange={(e) => updateGoal(idx, e.target.value)}
                      placeholder={`Goal #${idx + 1}...`}
                      className="flex-1 bg-transparent border-b border-[#333] focus:border-purple-400 text-xs text-white placeholder-gray-600 outline-none pb-0.5 transition-colors disabled:opacity-75"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Card 3: TODAY I WILL... */}
            <div
              className="p-4 rounded-2xl flex flex-col gap-2.5 border"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.07) 0%, rgba(59, 130, 246, 0.02) 100%)',
                borderColor: 'rgba(59, 130, 246, 0.25)',
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-blue-500/20 pb-1.5">
                <span className="text-xs font-black text-blue-300 tracking-wider uppercase">
                  TODAY I WILL...
                </span>
                <span className="ml-auto text-xs">😊</span>
              </div>
              <ul className="flex flex-col gap-1.5 text-xs text-gray-300">
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs">💜</span>
                  <span>Give my 100%</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs">💜</span>
                  <span>Learn with interest</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs">💜</span>
                  <span>Make my family proud</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs">💜</span>
                  <span>Achieve my dreams 💕</span>
                </li>
              </ul>
            </div>
          </div>

          {/* ── Subject & Topic Schedule Table ── */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white uppercase tracking-wider">
                  📖 Daily Study Schedule
                </span>
                <span className="text-xs font-mono text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  {completedCount}/{totalCount} Done
                </span>
              </div>
              {!isLocked && (
                <button
                  onClick={addCustomRow}
                  className="text-xs px-2.5 py-1 rounded-xl bg-[#222] hover:bg-[#333] text-gray-300 border border-[#333] transition-colors"
                >
                  + Add Row
                </button>
              )}
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto rounded-2xl border border-[#2b2b30] bg-[#121214]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#2b2b30] text-gray-400 font-bold uppercase tracking-wider bg-[#18181c]">
                    <th className="p-3 w-28 whitespace-nowrap">TIME ⏰</th>
                    <th className="p-3 w-48 whitespace-nowrap">SUBJECT 📑</th>
                    <th className="p-3 w-48 whitespace-nowrap">TOPIC / CHAPTER ✏️</th>
                    <th className="p-3 whitespace-nowrap">PLAN (What will I study?) 💡</th>
                    <th className="p-3 w-16 text-center whitespace-nowrap">DONE ✓</th>
                    <th className="p-3 w-28 text-center whitespace-nowrap">TIMER ▶️</th>
                    {!isLocked && <th className="p-3 w-10"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222226]">
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors hover:bg-[#19191d] ${
                        row.done ? 'bg-[#101012] opacity-75' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={row.time || ''}
                          onChange={(e) => updateRow(row.id, 'time', e.target.value)}
                          placeholder="09:00 - 11:00"
                          className="w-full bg-transparent border border-transparent focus:border-[#333] rounded px-1.5 py-1 text-xs text-gray-300 font-mono outline-none disabled:opacity-75"
                        />
                      </td>

                      {/* Subject with Backlog badge if rolled over */}
                      <td className="p-2.5">
                        <div className="flex flex-col gap-1">
                          {row.isRollover && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap w-fit">
                              ⚠️ Backlog (Kal nahi hua tha)
                            </span>
                          )}
                          <input
                            type="text"
                            disabled={isLocked}
                            value={row.subject || ''}
                            onChange={(e) => updateRow(row.id, 'subject', e.target.value)}
                            className="w-full font-bold text-xs bg-transparent border border-transparent focus:border-[#333] rounded px-1.5 py-1 text-purple-300 outline-none disabled:opacity-75"
                          />
                        </div>
                      </td>

                      {/* Topic / Chapter */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={row.topic || ''}
                          onChange={(e) => updateRow(row.id, 'topic', e.target.value)}
                          placeholder="e.g. Chapter 4..."
                          className={`w-full bg-transparent border border-transparent focus:border-[#333] rounded px-1.5 py-1 text-xs text-white outline-none disabled:opacity-75 ${
                            row.done ? 'line-through text-gray-500' : ''
                          }`}
                        />
                      </td>

                      {/* Plan */}
                      <td className="p-2.5">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={row.plan || ''}
                          onChange={(e) => updateRow(row.id, 'plan', e.target.value)}
                          placeholder="e.g. 30 PYQs & revise notes"
                          className="w-full bg-transparent border border-transparent focus:border-[#333] rounded px-1.5 py-1 text-xs text-gray-300 outline-none disabled:opacity-75"
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
                          onClick={() => handleStartTimer(row)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-600/20 text-purple-300 border border-purple-500/40 hover:bg-purple-600 hover:text-white transition-all whitespace-nowrap"
                          title="Open Stopwatch with this topic"
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
                            className="text-gray-600 hover:text-red-400 text-xs"
                            title="Delete row"
                          >
                            ✕
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              </div>
              <textarea
                disabled={isLocked}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Write key takeaways, weak areas to revise, or formulas to remember..."
                rows={3}
                className="w-full rounded-xl bg-[#141417] border border-[#2b2b30] p-3 text-xs text-white placeholder-gray-600 outline-none focus:border-purple-500 transition-colors disabled:opacity-75"
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
                  <span>🏁</span>
                  <span>Finish Day {dayNumber} & Lock Today's Record?</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {uncompletedRows.length > 0
                    ? `${uncompletedRows.length} unfinished topic(s) will automatically rollover to Day ${dayNumber + 1}.`
                    : 'All planned topics were checked off! Ready for tomorrow.'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className="pill-btn px-5 h-10 text-xs font-bold bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg shadow-purple-500/20 whitespace-nowrap hover:scale-105 transition-all"
              >
                🏁 Complete Day & Move to Day {dayNumber + 1} →
              </button>
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
                  <span className="font-bold text-purple-400">{targetHours} Hours ({goalMet ? 'Achieved ✓' : 'Incomplete'})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Completed Topics:</span>
                  <span className="font-bold text-green-400">{completedCount} / {totalCount}</span>
                </div>
              </div>

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
    </div>
  )
}
