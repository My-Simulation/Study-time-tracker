/**
 * Stopwatch.jsx — Main timer page.
 * New in this version:
 *  - Live status synced to Firestore (useLiveStatus)
 *  - Daily goal progress bar (from weekly plan)
 *  - Profile pill (top-left: avatar + username)
 *  - Plan button (📅 icon → /plan)
 *  - Watch partner button (👁️ icon → /watch)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useStopwatch } from '../hooks/useStopwatch'
import StopwatchDisplay from '../components/StopwatchDisplay'
import LapTable from '../components/LapTable'
import SaveModal from '../components/SaveModal'
import Toast from '../components/Toast'
import ExamCountdown from '../components/ExamCountdown'
import DailyMissions from '../components/DailyMissions'
import ShareCardModal from '../components/ShareCardModal'
import {
  getWeeklyPlan, getTargetForDate, getSessionsByDate, getSyllabus,
  getDayPlanner, calculateDayNumber, getUserSessions, groupSessionsByDate, calculateStreaks,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration } from '../utils/formatTime'
import { clearSession, getSession } from '../utils/auth'
import { backgroundTimer } from '../utils/backgroundTimer'

export default function Stopwatch({ userName }) {
  const navigate = useNavigate()
  const { elapsed, isRunning, laps, displayTime, start, stop, reset, lap, togglePictureInPicture } = useStopwatch(userName)

  const location = useLocation()
  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })
  const [dailyGoal, setDailyGoal] = useState(null)   // { targetMinutes, subjects }
  const [todayStudied, setTodayStudied] = useState(0) // seconds studied today
  const [syllabus, setSyllabus] = useState([])
  const [activeSubject, setActiveSubject] = useState(location.state?.subject || '')
  const [activeTopic, setActiveTopic] = useState(location.state?.topic || '')
  const [dayPlan, setDayPlan] = useState(null)
  const [dayNum, setDayNum] = useState(1)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isStandalone, setIsStandalone] = useState(false)
  const [timerMode, setTimerMode] = useState('stopwatch') // 'stopwatch' | 'pomodoro'
  const [pomoMinutes, setPomoMinutes] = useState(25)
  const [pomoBreakMinutes, setPomoBreakMinutes] = useState(5)
  const [isZenMode, setIsZenMode] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const pomoAlertFiredRef = useRef(false)

  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'granted'
  })
  const captureRef = useRef(null)

  const hasTime = elapsed > 0

  const playChime = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.8)
    } catch (e) {
      console.warn('Audio chime error:', e)
    }
  }, [])

  // ── Keyboard shortcuts (Space = Start/Pause, F = Zen Fullscreen, Esc = Exit Zen) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        if (isRunning) stop()
        else start()
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        setIsZenMode((prev) => !prev)
      } else if (e.code === 'Escape' && isZenMode) {
        setIsZenMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isRunning, start, stop, isZenMode])

  const handleEnableNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission()
        setNotifPermission(perm)
        if (perm === 'granted') {
          setToast({ visible: true, message: 'Notification & Lock Screen timer enabled! 🔔✅' })
        }
      } catch (e) {
        console.warn(e)
      }
    }
  }

  // ── PWA Install Prompt Listener ───────────────────────────────────────────
  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handlePrompt)
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsStandalone(true)
    }
    return () => window.removeEventListener('beforeinstallprompt', handlePrompt)
  }, [])

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setIsStandalone(true)
      }
    } else {
      alert('📲 To install this app on your phone:\n1. Tap the 3-dots (⋮) in your mobile browser.\n2. Tap "Install App" or "Add to Home Screen".\nOnce installed, it opens full-screen like a native app!')
    }
  }

  // ── Update backgroundTimer metadata with active subject & topic ───────────
  useEffect(() => {
    backgroundTimer.update({
      isRunning,
      displayTime,
      subject: activeSubject,
      topic: activeTopic,
    })
  }, [isRunning, displayTime, activeSubject, activeTopic])

  // ── Load today's goal, syllabus, day plan and studied time ─────────────────
  useEffect(() => {
    async function loadData() {
      try {
        const [plan, todaySessions, syl, dPlan, dNum, allUserSessions] = await Promise.all([
          getWeeklyPlan(userName),
          getSessionsByDate(userName, todayString()),
          getSyllabus(userName),
          getDayPlanner(userName, todayString()),
          calculateDayNumber(userName, todayString()),
          getUserSessions(userName),
        ])
        const goal = getTargetForDate(todayString(), plan, dPlan ? { [todayString()]: dPlan } : null)
        setDailyGoal(goal)
        setDayPlan(dPlan)
        setDayNum(dNum || 1)

        if (allUserSessions && allUserSessions.length > 0) {
          const groups = groupSessionsByDate(allUserSessions)
          const st = calculateStreaks(groups)
          setStreakCount(st.currentStreak || 0)
        }

        const todaySec = (todaySessions || []).reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
        setTodayStudied(todaySec)

        // If the stopwatch is paused and its elapsed time matches an already saved session,
        // cleanly reset it to 0 so it never double-counts on the dashboard
        if (!isRunning && elapsed > 0 && todaySessions && todaySessions.length > 0) {
          const currentSec = Math.floor(elapsed / 1000)
          const alreadySaved = todaySessions.some((s) => Math.abs((s.totalSeconds || 0) - currentSec) <= 3)
          if (alreadySaved) {
            reset()
          }
        }

        if (Array.isArray(syl) && syl.length > 0) {
          setSyllabus(syl)
        }
      } catch (err) {
        console.warn('Could not load stopwatch extra data:', err)
      }
    }
    loadData()
  }, [userName])

  // Update active subject/topic if navigated with state
  useEffect(() => {
    if (location.state?.subject) setActiveSubject(location.state.subject)
    if (location.state?.topic) setActiveTopic(location.state.topic)
  }, [location.state])

  const session = getSession()
  const avatarColor = session?.avatarColor || '#7c3aed'

  const handleSwitchUser = () => {
    clearSession()
    navigate('/welcome', { replace: true })
  }

  const handleSaved = useCallback(
    async (date) => {
      setShowModal(false)
      setToast({ visible: true, message: `Saved for ${date} ✅` })
      reset()
      if (userName) {
        try {
          const [todaySessions, allUserSessions] = await Promise.all([
            getSessionsByDate(userName, todayString()),
            getUserSessions(userName),
          ])
          const todaySec = (todaySessions || []).reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
          setTodayStudied(todaySec)
          if (allUserSessions && allUserSessions.length > 0) {
            const groups = groupSessionsByDate(allUserSessions)
            const st = calculateStreaks(groups)
            setStreakCount(st.currentStreak || 0)
          }
        } catch {
          const added = Math.floor(elapsed / 1000)
          setTodayStudied((prev) => prev + added)
        }
      }
    },
    [reset, elapsed, userName]
  )

  const dismissToast = useCallback(() => setToast({ visible: false, message: '' }), [])
  const totalSeconds = Math.floor(elapsed / 1000)

  // ── Pomodoro Logic ────────────────────────────────────────────────────────
  const pomoTargetSec = pomoMinutes * 60
  const pomoRemainingSec = Math.max(0, pomoTargetSec - (totalSeconds % pomoTargetSec))

  useEffect(() => {
    if (timerMode !== 'pomodoro' || !isRunning) return
    if (totalSeconds > 0 && totalSeconds % pomoTargetSec === 0 && !pomoAlertFiredRef.current) {
      pomoAlertFiredRef.current = true
      playChime()
      setToast({
        visible: true,
        message: `🎉 Pomodoro ${pomoMinutes}m focus completed! Time for a ${pomoBreakMinutes}m break! ☕`,
      })
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    } else if (totalSeconds % pomoTargetSec !== 0) {
      pomoAlertFiredRef.current = false
    }
  }, [timerMode, isRunning, totalSeconds, pomoTargetSec, pomoMinutes, pomoBreakMinutes, playChime])

  function formatPomodoroTime(seconds) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  // ── Daily goal progress ───────────────────────────────────────────────────
  const goalProgress = (() => {
    // Determine effective target: DayPlanner targetHours takes precedence, else dailyGoal from weekly plan
    const targetMinutes = (dayPlan?.targetHours && Number(dayPlan.targetHours) > 0)
      ? Math.round(Number(dayPlan.targetHours) * 60)
      : (dailyGoal?.targetMinutes || 0)

    const studiedSec = todayStudied + Math.floor(elapsed / 1000)

    if (!targetMinutes || targetMinutes <= 0) {
      return {
        hasTarget: false,
        pct: 0,
        targetSec: 0,
        studiedSec,
        studiedLabel: formatHoursMinutes(studiedSec),
      }
    }

    const targetSec = targetMinutes * 60
    const pct = Math.min(100, Math.round((studiedSec / targetSec) * 100))
    const isAchieved = studiedSec >= targetSec
    const remainingSec = Math.max(0, targetSec - studiedSec)

    return {
      hasTarget: true,
      pct,
      targetSec,
      studiedSec,
      targetMinutes,
      isAchieved,
      remainingSec,
      label: formatHoursMinutes(targetSec),
      studiedLabel: formatHoursMinutes(studiedSec),
      remainingLabel: formatHoursMinutes(remainingSec),
      source: (dayPlan?.targetHours && Number(dayPlan.targetHours) > 0) ? `Day ${dayNum} Target` : 'Weekly Plan Goal',
    }
  })()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d0d0d' }}>

      {/* ── Top bar ── */}
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-2 sm:px-4 pt-3 sm:pt-4 pb-0 max-w-lg mx-auto w-full">
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink min-w-0">
          {/* Profile pill */}
          <ProfilePill userName={userName} avatarColor={avatarColor} photoUrl={session?.photoUrl} onLogout={handleSwitchUser} />
          {!isStandalone && (
            <button
              onClick={handleInstallApp}
              title="Install as Mobile App"
              className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all flex items-center gap-1 font-semibold flex-shrink-0"
            >
              <span>📲</span>
              <span className="hidden sm:inline">Install</span>
            </button>
          )}
          {notifPermission === 'default' && (
            <button
              onClick={handleEnableNotification}
              title="Turn on Lock Screen Timer"
              className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all flex items-center gap-1 font-semibold flex-shrink-0"
            >
              <span>🔔</span>
              <span className="hidden sm:inline">Timer</span>
            </button>
          )}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
          {/* Day Planner Sheet icon */}
          <IconButton onClick={() => navigate('/planner')} title="Daily Study Planner" aria-label="Day Planner">
            <span className="text-sm sm:text-base leading-none">🌸</span>
          </IconButton>
          {/* Syllabus tracker icon */}
          <IconButton onClick={() => navigate('/syllabus')} title="Syllabus & Topics" aria-label="Syllabus">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </IconButton>
          {/* Plan icon */}
          <IconButton onClick={() => navigate('/plan')} title="Study Plan" aria-label="Study Plan">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="3" y1="9" x2="21" y2="9" />
            </svg>
          </IconButton>
          {/* Watch partner */}
          <IconButton onClick={() => navigate('/watch')} title="Watch Partner" aria-label="Watch Partner">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
            </svg>
          </IconButton>
          {/* Analytics icon */}
          <IconButton onClick={() => navigate('/analytics')} title="Study Analytics" aria-label="Study Analytics">
            <span className="text-sm sm:text-base leading-none">📈</span>
          </IconButton>
          {/* History icon */}
          <IconButton onClick={() => navigate('/history')} title="History" aria-label="View history">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </IconButton>
          {/* Floating Mini Stopwatch (PiP) */}
          <IconButton onClick={togglePictureInPicture} title="Floating Mini Stopwatch (Picture-in-Picture)" aria-label="Float Mini Timer">
            <span className="text-sm sm:text-base leading-none">🖼️</span>
          </IconButton>
        </div>
      </div>

      {/* ── Mode Selector (Stopwatch / Pomodoro) & Fullscreen ── */}
      <div className="flex items-center justify-center gap-2 px-4 pt-3 pb-1">
        <div className="inline-flex p-0.5 rounded-full bg-[#181818] border border-[#2a2a2a] shadow-inner">
          <button
            onClick={() => setTimerMode('stopwatch')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all ${
              timerMode === 'stopwatch'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            ⏱️ Stopwatch
          </button>
          <button
            onClick={() => setTimerMode('pomodoro')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1 ${
              timerMode === 'pomodoro'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🍅 Pomodoro
          </button>
        </div>

        {/* Zen / Fullscreen Mode button */}
        <button
          onClick={() => setIsZenMode(true)}
          title="Zen Fullscreen Mode (Press F)"
          className="p-1.5 rounded-full bg-[#181818] hover:bg-[#252525] border border-[#2a2a2a] text-gray-300 hover:text-white transition-all text-xs flex items-center justify-center"
        >
          <span className="text-sm">⛶</span>
        </button>
      </div>

      {/* ── Direct One-Tap Notification Permission Banner ── */}
      {notifPermission === 'default' && (
        <div className="px-4 pt-1 pb-1 max-w-lg mx-auto w-full">
          <div
            onClick={handleEnableNotification}
            className="p-3 rounded-2xl flex items-center justify-between gap-3 border border-amber-500/40 bg-amber-500/10 cursor-pointer hover:bg-amber-500/20 transition-all shadow-md btn-press"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-xl flex-shrink-0">🔔</span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-amber-200 truncate">Enable Lock Screen & Notification Timer</p>
                <p className="text-[10px] text-gray-300 mt-0.5 truncate">Tap to show running stopwatch on top of your screen</p>
              </div>
            </div>
            <span className="text-xs font-bold text-black bg-amber-400 px-3 py-1 rounded-full flex-shrink-0 shadow-sm">
              Turn On
            </span>
          </div>
        </div>
      )}

      {/* ── Day Study Planner Sheet Banner ── */}
      <div className="px-4 pt-1 max-w-lg mx-auto w-full">
        <div
          onClick={() => navigate('/planner')}
          className="p-3 rounded-2xl flex items-center justify-between gap-3 border border-pink-500/30 cursor-pointer hover:border-pink-500/60 transition-all btn-press shadow-md"
          style={{
            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-xl flex-shrink-0">🌸</span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-pink-300 uppercase tracking-wider whitespace-nowrap">
                  DAY {dayNum} PLAN
                </span>
                {dayPlan?.goals?.[0] && (
                  <span className="text-[11px] text-gray-300 truncate">
                    · {dayPlan.goals[0]}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                {dayPlan?.rows?.length
                  ? `${dayPlan.rows.filter((r) => r.done).length}/${dayPlan.rows.length} topics done today`
                  : 'Open today’s planner sheet & set your top goals'}
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-pink-300 bg-pink-500/20 border border-pink-500/30 px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0">
            Open Sheet →
          </span>
        </div>
      </div>

      {/* ── Exam D-Day Countdown & Target Hours Widget ── */}
      <div className="px-4 pt-1.5 max-w-lg mx-auto w-full">
        <ExamCountdown userName={userName} totalStudiedSeconds={todayStudied + totalSeconds} />
      </div>

      {/* ── Daily goal progress bar ── */}
      {goalProgress && (
        <div className="px-4 pt-2 pb-0 max-w-lg mx-auto w-full">
          {goalProgress.hasTarget ? (
            <div
              className="card px-4 py-3 flex flex-col gap-2.5 transition-all shadow-sm"
              style={{
                background: goalProgress.isAchieved
                  ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12) 0%, rgba(20, 20, 20, 0.95) 100%)'
                  : '#1a1a1a',
                border: goalProgress.isAchieved ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid #2a2a2a',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{goalProgress.isAchieved ? '🎉' : '🎯'}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white tracking-wide">
                        Today's Study Goal
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                        {goalProgress.source}
                      </span>
                    </div>
                    {dailyGoal?.subjects && (
                      <span className="text-[11px] text-gray-400 block truncate max-w-[200px]">
                        {dailyGoal.subjects}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-bold font-mono ${goalProgress.isAchieved ? 'text-green-400' : 'text-purple-400'}`}>
                    {goalProgress.studiedLabel} / {goalProgress.label}
                  </span>
                  <span className="block text-[10px] text-gray-400 font-medium">
                    {goalProgress.pct}% done
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 rounded-full bg-[#262626] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${goalProgress.pct}%`,
                    background: goalProgress.isAchieved
                      ? 'linear-gradient(90deg, #10b981, #22c55e)'
                      : 'linear-gradient(90deg, #7c3aed, #ec4899)',
                    boxShadow: goalProgress.isAchieved ? '0 0 10px rgba(34, 197, 94, 0.5)' : '0 0 10px rgba(124, 58, 237, 0.3)',
                  }}
                />
              </div>

              {/* Status Message */}
              <div className="flex items-center justify-between text-[11px]">
                {goalProgress.isAchieved ? (
                  <span className="text-green-400 font-medium flex items-center gap-1">
                    ✓ Daily goal achieved for today! Great job! 🎉
                  </span>
                ) : goalProgress.studiedSec > 0 ? (
                  <span className="text-amber-400/90 font-medium">
                    ⏳ In Progress · {goalProgress.remainingLabel} left to reach target
                  </span>
                ) : (
                  <span className="text-gray-400">
                    Not started yet today · Target: {goalProgress.label}
                  </span>
                )}
                <button
                  onClick={() => navigate('/planner')}
                  className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-0.5 hover:underline"
                >
                  Day Sheet →
                </button>
              </div>
            </div>
          ) : (
            /* If no target set yet today */
            <div
              onClick={() => navigate('/planner')}
              className="card px-3.5 py-2.5 flex items-center justify-between border-dashed border-[#333] hover:border-purple-500/50 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <div>
                  <p className="text-xs font-semibold text-gray-300">Set Today's Target Hours</p>
                  <p className="text-[10px] text-gray-500">
                    {goalProgress.studiedSec > 0
                      ? `Studied ${goalProgress.studiedLabel} today · Set a goal to track completion!`
                      : 'Define how many hours you want to study today'}
                  </p>
                </div>
              </div>
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 font-medium transition-all">
                + Set Goal
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Active Topic Tagging ── */}
      {syllabus.length > 0 && (
        <div className="px-4 pt-2 max-w-lg mx-auto w-full flex items-center justify-between text-xs">
          <span className="text-gray-500 font-medium text-[11px]">Topic Tag:</span>
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-[80%]">
            <select
              value={activeSubject}
              onChange={(e) => {
                setActiveSubject(e.target.value)
                setActiveTopic('')
              }}
              className="rounded-lg bg-[#141414] border border-[#2a2a2a] text-white text-[11px] px-2 py-1 outline-none focus:border-purple-500"
            >
              <option value="">Select Subject</option>
              {syllabus.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
            {activeSubject && (
              <select
                value={activeTopic}
                onChange={(e) => setActiveTopic(e.target.value)}
                className="rounded-lg bg-[#141414] border border-[#2a2a2a] text-white text-[11px] px-2 py-1 outline-none focus:border-purple-500 max-w-[130px] truncate"
              >
                <option value="">Select Topic</option>
                {(syllabus.find((s) => s.name === activeSubject)?.topics || []).map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* ── Main card ── */}
      <div className="flex-1 flex flex-col px-4 pb-3 max-w-lg mx-auto w-full">
        <div className="card flex flex-col flex-1 overflow-hidden mt-2">
          <div ref={captureRef} className="bg-[#1a1a1a] rounded-2xl overflow-hidden">
            {/* Pomodoro countdown bar */}
            {timerMode === 'pomodoro' && (
              <div className="px-4 py-2.5 bg-[#141b24] border-b border-[#223344] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🍅</span>
                  <div className="text-left">
                    <span className="text-xs font-extrabold text-teal-300">
                      Focus Countdown: {formatPomodoroTime(pomoRemainingSec)}
                    </span>
                    <span className="text-[10px] text-gray-400 block">
                      {pomoMinutes}m target focus block
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPomoMinutes(25)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                      pomoMinutes === 25 ? 'bg-teal-500 text-black shadow-sm' : 'bg-[#222] text-gray-300'
                    }`}
                  >
                    25m
                  </button>
                  <button
                    onClick={() => setPomoMinutes(50)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                      pomoMinutes === 50 ? 'bg-teal-500 text-black shadow-sm' : 'bg-[#222] text-gray-300'
                    }`}
                  >
                    50m
                  </button>
                </div>
              </div>
            )}

            <StopwatchDisplay displayTime={displayTime} />
            {laps.length > 0 && <div className="border-t border-[#2a2a2a]" />}
            <div className="overflow-y-auto" style={{ maxHeight: '260px' }}>
              <LapTable laps={laps} />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2.5 p-4 pt-3">
            <div className="flex gap-2 w-full">
              {hasTime && (
                <button
                  onClick={() => {
                    if (isRunning) stop()
                    setShowModal(true)
                  }}
                  className="pill-btn flex-1"
                  style={{ background: '#8b5cf6', color: 'white' }}
                >
                  Save Session
                </button>
              )}
              <button
                onClick={() => setShowShareModal(true)}
                title="Generate shareable study card for WhatsApp & Instagram"
                className={`pill-btn flex items-center justify-center gap-1.5 ${hasTime ? 'w-auto px-4' : 'w-full'}`}
                style={{ background: '#1c1b29', border: '1px solid #373554', color: '#c4b5fd' }}
              >
                <span>✨</span>
                <span className="text-xs font-semibold">{hasTime ? 'Share' : 'Share Focus Card'}</span>
              </button>
            </div>
            {isRunning && (
              <button onClick={lap} className="pill-btn w-full" style={{ background: '#3b82f6', color: 'white' }}>
                Lap
              </button>
            )}
            <div className="flex gap-3">
              <button
                onClick={reset}
                disabled={isRunning || elapsed === 0}
                className="pill-btn flex-1"
                style={{ background: '#2a2a2a', color: isRunning || elapsed === 0 ? '#555' : 'white', cursor: isRunning || elapsed === 0 ? 'not-allowed' : 'pointer' }}
              >
                Reset
              </button>
              <button
                onClick={isRunning ? stop : start}
                className="pill-btn flex-1"
                style={{ background: isRunning ? '#ef4444' : '#22c55e', color: isRunning ? 'white' : 'black' }}
              >
                {isRunning ? 'Stop' : 'Start'}
              </button>
            </div>

            {/* Lock Screen & Background Controller active banner */}
            {isRunning && (
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#181229] border border-purple-500/30 text-[11px] mt-1 shadow-sm">
                <div className="flex items-center gap-2 text-purple-200 min-w-0">
                  <span className="relative flex h-2 w-2 flex-shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="font-medium truncate">Lock Screen & Notification Active</span>
                </div>
                <button
                  onClick={togglePictureInPicture}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/40 hover:bg-purple-500/30 transition-all flex items-center gap-1 flex-shrink-0"
                  title="Open Floating Picture-in-Picture Mini Timer"
                >
                  <span>🖼️ Float Timer</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Daily Missions / Micro-Goals Checklist ── */}
      <div className="px-4 pb-8 max-w-lg mx-auto w-full">
        <DailyMissions userName={userName} />
      </div>

      <SaveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
        captureTargetRef={captureRef}
        displayTime={displayTime}
        totalSeconds={totalSeconds}
        laps={laps}
        userName={userName}
        initialSubject={activeSubject}
        initialTopic={activeTopic}
      />
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        userName={userName}
        photoUrl={session?.photoUrl}
        todayStudiedSec={todayStudied + totalSeconds}
        dayNum={dayNum}
        streakCount={streakCount}
        dayPlan={dayPlan}
        activeSubject={activeSubject}
      />
      <Toast message={toast.message} visible={toast.visible} onDismiss={dismissToast} />

      {/* ── Zen / Fullscreen Focus Mode Overlay ── */}
      {isZenMode && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col justify-between p-4 sm:p-10 text-white select-none animate-fadeIn">
          {/* Top Header */}
          <div className="flex items-center justify-between w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                {timerMode === 'pomodoro' ? '🍅 Pomodoro' : '⏱️ Stopwatch'}
              </span>
              {activeSubject && (
                <span className="text-xs font-semibold text-gray-400 truncate max-w-[120px] sm:max-w-none">
                  • {activeSubject} {activeTopic ? `(${activeTopic})` : ''}
                </span>
              )}
            </div>

            <button
              onClick={() => setIsZenMode(false)}
              className="px-3 sm:px-3.5 py-1.5 rounded-full bg-[#1e1e1e] hover:bg-[#2c2c2c] border border-[#333] text-xs font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
            >
              <span>✕</span>
              <span>Exit (Esc / F)</span>
            </button>
          </div>

          {/* Center Immense Timer */}
          <div className="flex flex-col items-center justify-center my-auto text-center w-full max-w-4xl mx-auto px-2 sm:px-4 overflow-hidden">
            {timerMode === 'pomodoro' ? (
              <>
                <span className="text-xs sm:text-sm font-bold uppercase tracking-widest text-teal-400 mb-2">
                  Focus Countdown
                </span>
                <div
                  className="font-black font-mono tracking-tight text-white drop-shadow-2xl text-center select-none w-full"
                  style={{
                    fontSize: 'clamp(44px, 15vw, 110px)',
                    lineHeight: 1.05,
                    fontFamily: '"Roboto Mono", ui-monospace, monospace',
                  }}
                >
                  {formatPomodoroTime(pomoRemainingSec)}
                </div>
                <span className="text-xs sm:text-sm font-mono text-gray-400 mt-2">
                  Total Elapsed: {displayTime}
                </span>
              </>
            ) : (
              <div
                className="font-black font-mono tracking-tight text-white drop-shadow-2xl text-center select-none w-full overflow-hidden"
                style={{
                  fontSize: 'clamp(28px, 9.2vw, 90px)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.02em',
                  fontFamily: '"Roboto Mono", ui-monospace, monospace',
                }}
              >
                {displayTime}
              </div>
            )}

            {/* Goal progress sub-bar */}
            {goalProgress && goalProgress.hasTarget && (
              <div className="mt-8 w-full max-w-md">
                <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                  <span>Today: {goalProgress.studiedLabel}</span>
                  <span>Target: {goalProgress.label} ({goalProgress.pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-[#202020] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-cyan-400"
                    style={{ width: `${goalProgress.pct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex flex-col items-center gap-3 w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <button
                onClick={isRunning ? stop : start}
                className="px-8 py-3.5 rounded-full font-extrabold text-base transition-all shadow-xl hover:scale-105"
                style={{
                  background: isRunning ? '#ef4444' : '#22c55e',
                  color: isRunning ? 'white' : 'black',
                  minWidth: '160px',
                }}
              >
                {isRunning ? 'Pause (Space)' : 'Start (Space)'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">Space</kbd> to Start/Pause · <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">F</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">Esc</kbd> to Exit
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Profile Pill ──────────────────────────────────────────────────────────────
function ProfilePill({ userName, avatarColor, photoUrl, onLogout }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  const shareLink = `${window.location.origin}/watch/${userName}`
  const copyLink = () => {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors hover:bg-[#1a1a1a] flex-shrink-0"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
          style={{ background: avatarColor }}
        >
          {photoUrl ? (
            <img src={photoUrl} alt={userName} className="w-full h-full object-cover" />
          ) : (
            userName[0].toUpperCase()
          )}
        </div>
        <span className="text-xs sm:text-sm text-gray-300 font-medium max-w-[65px] sm:max-w-[100px] truncate">@{userName}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-10 z-50 card p-3 flex flex-col gap-1 min-w-[190px]" style={{ animation: 'scaleIn 150ms ease-out' }}>
            {/* Avatar header */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0 overflow-hidden"
                style={{ background: avatarColor }}
              >
                {photoUrl ? (
                  <img src={photoUrl} alt={userName} className="w-full h-full object-cover" />
                ) : (
                  userName[0].toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">@{userName}</p>
                <p className="text-xs text-gray-600">Your account</p>
              </div>
            </div>
            <div className="border-t border-[#2a2a2a] my-1" />
            <MenuBtn icon="👤" label="My Profile & Stats" onClick={() => { navigate('/profile'); setOpen(false) }} />
            <MenuBtn icon="✏️" label="Edit Profile" onClick={() => { navigate('/profile'); setOpen(false) }} />
            <MenuBtn icon="📈" label="Study Analytics" onClick={() => { navigate('/analytics'); setOpen(false) }} />
            <MenuBtn icon="📋" label="Weekly Plan" onClick={() => { navigate('/plan'); setOpen(false) }} />
            <MenuBtn icon="👁️" label="Watch Partner" onClick={() => { navigate('/watch'); setOpen(false) }} />
            <MenuBtn icon={copied ? '✓' : '🔗'} label={copied ? 'Copied!' : 'Copy Live Link'} onClick={copyLink} />
            <div className="border-t border-[#2a2a2a] my-1" />
            <MenuBtn icon="🚪" label="Logout" onClick={onLogout} danger />
          </div>
        </>
      )}
    </div>
  )
}

function MenuBtn({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left w-full ${
        danger ? 'hover:bg-red-950/30 text-red-400' : 'hover:bg-[#2a2a2a] text-gray-300'
      }`}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}

function IconButton({ children, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#1a1a1a] flex-shrink-0"
    >
      {children}
    </button>
  )
}

function stringToColor(str) {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
