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
import DailyMissions from '../components/DailyMissions'
import ShareCardModal from '../components/ShareCardModal'
import BackgroundModal from '../components/BackgroundModal'
import AICoachDrawer from '../components/AICoachDrawer'
import SessionTimeline from '../components/SessionTimeline'
import AuthModal from '../components/AuthModal'
import AdminTimerBoosterModal from '../components/AdminTimerBoosterModal'
import { ADMIN_USERNAMES } from '../utils/doubtHelpers'
import { buildUserAIContext } from '../utils/aiService'
import {
  getWallpaper,
  setWallpaper as saveWallpaperPref,
  getWallpaperConfig,
  setWallpaperConfig as saveWallpaperConfigPref,
  clearWallpaper as clearWallpaperPref,
} from '../utils/wallpaperStorage'
import {
  getWeeklyPlan, getTargetForDate, getSessionsByDate, getSyllabus,
  getDayPlanner, calculateDayNumber, getUserSessions, groupSessionsByDate, calculateStreaks,
  getUserDoc, getUserSettings, isRestDay, saveSession,
} from '../utils/firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration, toLocalDateStr } from '../utils/formatTime'
import { clearSession, getSession, updateCurrentSession } from '../utils/auth'
import { backgroundTimer } from '../utils/backgroundTimer'

export default function Stopwatch({ userName }) {
  const navigate = useNavigate()
  const { elapsed, isRunning, laps, displayTime, timeline, startTimestamp, start, stop, reset, lap, togglePictureInPicture } = useStopwatch(userName)

  const location = useLocation()
  const timerAlertFiredRef = useRef(false)
  const [showModal, setShowModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authModalConfig, setAuthModalConfig] = useState({ title: '', subtitle: '', sessionDuration: '' })
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
  const [timerMode, setTimerMode] = useState(() => {
    try {
      return localStorage.getItem('stt_timer_mode') || 'stopwatch'
    } catch {
      return 'stopwatch'
    }
  }) // 'stopwatch' | 'timer'
  const [countdownTargetSec, setCountdownTargetSec] = useState(() => {
    try {
      const val = Number(localStorage.getItem('stt_countdown_target_sec'))
      return val > 0 ? val : 3600 // 1 hour default
    } catch {
      return 3600
    }
  })

  const [countdownBaselineElapsed, setCountdownBaselineElapsed] = useState(() => {
    try {
      const val = Number(localStorage.getItem('stt_countdown_baseline_elapsed'))
      return isNaN(val) ? 0 : val
    } catch {
      return 0
    }
  })

  const updateCountdownBaseline = useCallback((val) => {
    setCountdownBaselineElapsed(val)
    try {
      localStorage.setItem('stt_countdown_baseline_elapsed', String(val))
    } catch {}
  }, [])
  const [showCustomTimePicker, setShowCustomTimePicker] = useState(false)
  const [showTimerCompleteModal, setShowTimerCompleteModal] = useState(false)
  const [isZenMode, setIsZenMode] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showAICoach, setShowAICoach] = useState(false)
  const [userAIContext, setUserAIContext] = useState(null)
  const [showWallpaperModal, setShowWallpaperModal] = useState(false)
  const [showTimerBoosterModal, setShowTimerBoosterModal] = useState(false)
  const [showAppsMenu, setShowAppsMenu] = useState(false)
  const [wallpaper, setWallpaper] = useState(() => getWallpaper(userName))
  const [wallpaperConfig, setWallpaperConfig] = useState(() => getWallpaperConfig(userName))
  const [streakCount, setStreakCount] = useState(0)
  const [settings, setSettings] = useState({ sundayRestDay: false, effectiveFrom: '' })
  const isTodayRest = isRestDay(todayString(), settings)
  const [userProfile, setUserProfile] = useState(() => {
    const s = getSession()
    return {
      photoUrl: s?.photoUrl || '',
      avatarColor: s?.avatarColor || '#7c3aed',
      displayName: s?.displayName || userName,
    }
  })
  // Prevent background scrolling when apps sheet is open
  useEffect(() => {
    if (showAppsMenu) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [showAppsMenu])

  // Sync wallpaper when userName switches or when updated locally/cloud
  useEffect(() => {
    const updateWp = () => {
      setWallpaper(getWallpaper(userName))
      setWallpaperConfig(getWallpaperConfig(userName))
    }
    updateWp()
    window.addEventListener('study_wallpaper_changed', updateWp)
    return () => window.removeEventListener('study_wallpaper_changed', updateWp)
  }, [userName])

  const handleSelectWallpaper = (url) => {
    setWallpaper(url)
    saveWallpaperPref(userName, url)
    setToast({ visible: true, message: '✨ Focus wallpaper updated!' })
  }

  const handleUpdateWallpaperConfig = (newCfg) => {
    setWallpaperConfig((prev) => {
      const merged = { ...prev, ...newCfg }
      saveWallpaperConfigPref(userName, merged)
      return merged
    })
  }

  const handleResetWallpaper = () => {
    setWallpaper(null)
    clearWallpaperPref(userName)
    setToast({ visible: true, message: '↺ Reset to minimalist default dark' })
  }

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

  const playAlarmSound = useCallback(() => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return
      const ctx = new AudioContextClass()
      if (ctx.state === 'suspended') {
        ctx.resume()
      }
      // Celebratory melodic bell chime sequence: C5, E5, G5, C6 repeated twice
      const chords = [
        { f: 523.25, t: 0.00 }, // C5
        { f: 659.25, t: 0.16 }, // E5
        { f: 783.99, t: 0.32 }, // G5
        { f: 1046.50, t: 0.48 }, // C6
        { f: 523.25, t: 0.80 }, // C5
        { f: 659.25, t: 0.96 }, // E5
        { f: 783.99, t: 1.12 }, // G5
        { f: 1046.50, t: 1.28 }, // C6
      ]
      chords.forEach(({ f, t }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(f, ctx.currentTime + t)
        gain.gain.setValueAtTime(0, ctx.currentTime + t)
        gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + t + 0.03)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.55)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + t)
        osc.stop(ctx.currentTime + t + 0.6)
      })
    } catch (e) {
      console.warn('Audio alarm error:', e)
    }
  }, [])

  // ── Reverse Countdown Timer Logic (Clock-style test timer) ──────────────────
  const elapsedInCountdown = Math.max(0, elapsed - countdownBaselineElapsed)
  const countdownRemainingSec = Math.max(0, countdownTargetSec - Math.floor(elapsedInCountdown / 1000))
  const countdownProgressPct = countdownTargetSec > 0
    ? Math.min(100, Math.round((Math.floor(elapsedInCountdown / 1000) / countdownTargetSec) * 100))
    : 0

  function formatCountdownDisplay(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  function formatCountdownDuration(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    if (m > 0 && s > 0) return `${m}m ${s}s`
    if (m > 0) return `${m}m`
    return `${s}s`
  }

  const elapsedRef = useRef(elapsed)
  elapsedRef.current = elapsed

  const countdownRemainingSecRef = useRef(countdownRemainingSec)
  countdownRemainingSecRef.current = countdownRemainingSec

  const timerModeRef = useRef(timerMode)
  timerModeRef.current = timerMode

  const handleStartStop = useCallback(() => {
    if (isRunning) {
      stop()
    } else {
      if (timerModeRef.current === 'timer' && countdownRemainingSecRef.current === 0) {
        updateCountdownBaseline(elapsedRef.current)
        timerAlertFiredRef.current = false
      }
      start()
    }
  }, [isRunning, start, stop, updateCountdownBaseline])

  // ── Keyboard shortcuts (Space = Start/Pause, F = Zen Fullscreen, Esc = Exit Zen) ──
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return
      }

      if (e.code === 'Space') {
        e.preventDefault()
        if (isTodayRest) return
        handleStartStop()
      } else if (e.code === 'KeyF') {
        e.preventDefault()
        setIsZenMode((prev) => !prev)
      } else if (e.code === 'Escape' && isZenMode) {
        setIsZenMode(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleStartStop, isTodayRest, isZenMode])

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

  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning
  elapsedRef.current = elapsed
  const resetRef = useRef(reset)
  resetRef.current = reset

  // ── Load today's goal, syllabus, day plan and studied time ─────────────────
  const loadData = useCallback(async () => {
    if (!userName) return
    try {
      const [allUserSessions, userDoc, userSettings] = await Promise.all([
        getUserSessions(userName),
        getUserDoc(userName),
        getUserSettings(userName),
      ])

      const plan = userDoc?.weeklyPlan || {}
      const syl = userDoc?.syllabus || []
      const dPlan = userDoc?.dayPlanners?.[todayString()] || null
      const dNum = await calculateDayNumber(userName, todayString(), allUserSessions, userDoc)
      const todaySessions = (allUserSessions || []).filter((s) => s.date === todayString())

      const goal = getTargetForDate(todayString(), plan, dPlan ? { [todayString()]: dPlan } : null, userSettings)
      setDailyGoal(goal)
      setDayPlan(dPlan)
      setDayNum(dNum || 1)
      setSettings(userSettings || { sundayRestDay: false, effectiveFrom: '' })

      if (allUserSessions && allUserSessions.length > 0) {
        const groups = groupSessionsByDate(allUserSessions)
        const st = calculateStreaks(groups, userSettings || plan)
        setStreakCount(st.currentStreak || 0)
      }

      const todaySec = todaySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
      setTodayStudied(todaySec)

      // Check if current stopwatch session was already saved in todaySessions (on laptop or any device)
      if (elapsedRef.current > 0 && todaySessions.length > 0) {
        const currentSec = Math.floor(elapsedRef.current / 1000)
        // Only auto-reset if current timer seconds exactly match a session already saved today
        const exactMatch = todaySessions.some((s) => Math.abs((s.totalSeconds || 0) - currentSec) <= 4)

        if (exactMatch) {
          resetRef.current()
        }
      }

      if (Array.isArray(syl) && syl.length > 0) {
        setSyllabus(syl)
      }

      // Sync fresh profile attributes (photoUrl, avatarColor) from cloud
      if (userDoc) {
        const freshPhoto = userDoc.photoUrl || ''
        const freshColor = userDoc.avatarColor || '#7c3aed'
        const freshName = userDoc.displayName || userName
        setUserProfile((prev) => {
          if (prev.photoUrl !== freshPhoto || prev.avatarColor !== freshColor || prev.displayName !== freshName) {
            return { photoUrl: freshPhoto, avatarColor: freshColor, displayName: freshName }
          }
          return prev
        })
        const curSession = getSession()
        if (curSession && (curSession.photoUrl !== freshPhoto || curSession.avatarColor !== freshColor || curSession.displayName !== freshName)) {
          updateCurrentSession({
            photoUrl: freshPhoto,
            avatarColor: freshColor,
            displayName: freshName,
          })
        }
      }
    } catch (err) {
      console.warn('Could not load stopwatch extra data:', err)
    }
  }, [userName])

  useEffect(() => {
    loadData()
    const handleRefreshOnFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        loadData()
      }
    }
    document.addEventListener('visibilitychange', handleRefreshOnFocus)
    window.addEventListener('focus', handleRefreshOnFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleRefreshOnFocus)
      window.removeEventListener('focus', handleRefreshOnFocus)
    }
  }, [loadData])

  // ── Saturday midnight to Sunday Rest rollover check ──
  const stopRef = useRef(stop)
  stopRef.current = stop
  const activeSubjectRef = useRef(activeSubject)
  activeSubjectRef.current = activeSubject
  const activeTopicRef = useRef(activeTopic)
  activeTopicRef.current = activeTopic
  const loadDataRef = useRef(loadData)
  loadDataRef.current = loadData

  useEffect(() => {
    if (!userName) return
    const checkMidnightRollover = async () => {
      try {
        const uSettings = await getUserSettings(userName)
        const today = todayString()
        if (!isRestDay(today, uSettings)) return

        const storageKey = `stt_stopwatch_state_${userName.toLowerCase()}`
        const raw = localStorage.getItem(storageKey)
        if (!raw) return

        const saved = JSON.parse(raw)
        if (saved.isRunning && saved.startTimestamp) {
          const startDate = toLocalDateStr(new Date(saved.startTimestamp))
          if (startDate < today) {
            // Started on previous day (e.g. Saturday)
            const satMidnightEpoch = new Date(startDate + 'T23:59:59.999').getTime()
            const satElapsedMs = (saved.baseElapsed || 0) + Math.max(0, satMidnightEpoch - saved.startTimestamp)
            const satSec = Math.max(1, Math.floor(satElapsedMs / 1000))

            stopRef.current()
            resetRef.current()

            await saveSession({
              userName,
              totalSeconds: satSec,
              date: startDate,
              subject: activeSubjectRef.current || 'Focus Study',
              topic: activeTopicRef.current || 'Saturday Session',
              notes: 'Auto-saved at midnight before Sunday Rest Day 🛋️',
            })

            loadDataRef.current()
          } else {
            // Started today on Rest Day -> stop and reset immediately
            stopRef.current()
            resetRef.current()
          }
        }
      } catch (err) {
        console.warn('Midnight rollover check error:', err)
      }
    }

    checkMidnightRollover()
    const timer = setInterval(checkMidnightRollover, 60000)
    return () => clearInterval(timer)
  }, [userName])

  // Real-time synchronization listeners for study plan and sessions
  useEffect(() => {
    const handleUpdate = () => {
      loadData()
    }
    window.addEventListener('study_plan_updated', handleUpdate)
    window.addEventListener('study_sessions_updated', handleUpdate)
    window.addEventListener('study_settings_updated', handleUpdate)
    return () => {
      window.removeEventListener('study_plan_updated', handleUpdate)
      window.removeEventListener('study_sessions_updated', handleUpdate)
      window.removeEventListener('study_settings_updated', handleUpdate)
    }
  }, [loadData])

  // Update active subject/topic if navigated with state
  useEffect(() => {
    if (location.state?.subject) setActiveSubject(location.state.subject)
    if (location.state?.topic) setActiveTopic(location.state.topic)
  }, [location.state])

  // Real-time listener for profile changes across tabs/modals
  useEffect(() => {
    const handleProfileUpdate = () => {
      const s = getSession()
      if (s) {
        setUserProfile({
          photoUrl: s.photoUrl || '',
          avatarColor: s.avatarColor || '#7c3aed',
          displayName: s.displayName || userName,
        })
      }
    }
    window.addEventListener('profile_updated', handleProfileUpdate)
    window.addEventListener('storage', handleProfileUpdate)
    return () => {
      window.removeEventListener('profile_updated', handleProfileUpdate)
      window.removeEventListener('storage', handleProfileUpdate)
    }
  }, [userName])

  const session = getSession()
  const avatarColor = userProfile.avatarColor || session?.avatarColor || '#7c3aed'

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
          const allUserSessions = await getUserSessions(userName, true)
          const todaySessions = (allUserSessions || []).filter((s) => s.date === todayString())
          const todaySec = todaySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)
          setTodayStudied(todaySec)
          if (allUserSessions && allUserSessions.length > 0) {
            const groups = groupSessionsByDate(allUserSessions)
            const st = calculateStreaks(groups, settings)
            setStreakCount(st.currentStreak || 0)
          }
        } catch {
          const added = Math.floor(elapsedRef.current / 1000)
          setTodayStudied((prev) => prev + added)
        }
      }
    },
    [reset, userName, settings]
  )

  const dismissToast = useCallback(() => setToast({ visible: false, message: '' }), [])
  const totalSeconds = Math.floor(elapsed / 1000)

  useEffect(() => {
    if (timerMode !== 'timer' || !isRunning || countdownTargetSec <= 0) return
    if (countdownRemainingSec === 0 && !timerAlertFiredRef.current) {
      timerAlertFiredRef.current = true
      stop()
      playAlarmSound()
      setShowTimerCompleteModal(true)
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 500])
      setToast({
        visible: true,
        message: `⏰ Time's Up! ${formatCountdownDuration(countdownTargetSec)} Test Complete! 🔔`,
      })
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('⏰ JeetPrep — Test Timer Complete!', {
            body: `Aapka ${formatCountdownDuration(countdownTargetSec)} ka focus timer pura ho gaya hai!`,
            icon: '/pwa-192x192.png',
          })
        }
      } catch {}
    } else if (countdownRemainingSec > 0) {
      timerAlertFiredRef.current = false
    }
  }, [timerMode, isRunning, countdownRemainingSec, countdownTargetSec, stop, playAlarmSound])

  const handleSetPreset = (sec) => {
    setCountdownTargetSec(sec)
    updateCountdownBaseline(elapsed)
    try {
      localStorage.setItem('stt_countdown_target_sec', String(sec))
    } catch {}
    setToast({ visible: true, message: `⏳ Timer set to ${formatCountdownDuration(sec)}` })
  }

  const handleAdjustTarget = (deltaSec) => {
    setCountdownTargetSec((prev) => {
      const next = Math.max(60, Math.min(86400, prev + deltaSec))
      try {
        localStorage.setItem('stt_countdown_target_sec', String(next))
      } catch {}
      return next
    })
    updateCountdownBaseline(elapsed)
  }

  // ── Daily goal progress ───────────────────────────────────────────────────
  const goalProgress = (() => {
    // Determine effective target: DayPlanner targetHours takes precedence, else dailyGoal from weekly plan
    let targetMinutes = (dayPlan?.targetHours && Number(dayPlan.targetHours) > 0)
      ? Math.round(Number(dayPlan.targetHours) * 60)
      : (dailyGoal?.targetMinutes || 0)

    // For guest users, provide a default 6h target so the target progress bar is active and engaging
    if (!userName && (!targetMinutes || targetMinutes <= 0)) {
      targetMinutes = 360
    }

    const studiedSec = todayStudied + Math.floor(elapsed / 1000)

    if (userName && (isTodayRest || (dailyGoal?.isRestDay && (!dayPlan?.targetHours || Number(dayPlan.targetHours) === 0)))) {
      return {
        hasTarget: false,
        isRestDay: true,
        pct: 100,
        targetSec: 0,
        studiedSec,
        studiedLabel: formatHoursMinutes(studiedSec),
        label: 'Rest Day (0h Goal)',
        source: 'Streak Shield Active',
      }
    }

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
      source: !userName
        ? 'Daily Focus Target (6h Plan)'
        : (dayPlan?.targetHours && Number(dayPlan.targetHours) > 0)
        ? `Day ${dayNum} Target`
        : 'Weekly Plan Goal',
    }
  })()

  const [zenMainTime, zenCentis] = (displayTime || '0:00:00.00').split('.')

  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden bg-transparent">

      {/* ── Top bar (Spans max-w-7xl on desktop, responsive on mobile) ── */}
      <div className="relative z-40 flex items-center justify-between px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-0 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink min-w-0">
          {/* Profile pill for logged-in user OR Get Started button for Guest */}
          {userName ? (
            <ProfilePill
              userName={userName}
              avatarColor={userProfile.avatarColor || avatarColor}
              photoUrl={userProfile.photoUrl}
              onLogout={handleSwitchUser}
              onOpenWallpaper={() => setShowWallpaperModal(true)}
              onOpenTimerBooster={() => setShowTimerBoosterModal(true)}
            />
          ) : (
            <button
              onClick={() => {
                setAuthModalConfig({
                  title: 'Join JeetPrep',
                  subtitle: 'Create a free account or sign in to save your study sessions and streaks.',
                  sessionDuration: elapsed > 0 ? displayTime : '',
                })
                setShowAuthModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-md transition-all active:scale-[0.98] cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                boxShadow: '0 2px 10px rgba(124, 58, 237, 0.4)',
              }}
              title="Sign in or create account"
            >
              <span>✨</span>
              <span>Sign In / Get Started</span>
            </button>
          )}

          {/* JeetPrep Branding Chip */}
          <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-[#282828]">
            <span className="text-xs font-black tracking-tight text-white flex items-center gap-1">
              <span className="text-purple-400 font-bold">⚡</span> JeetPrep
            </span>
            <span className="text-[10px] font-semibold text-gray-400 bg-[#161616] border border-[#2a2a2a] px-1.5 py-0.5 rounded">
              Study Tracker
            </span>
          </div>

          {/* Android App Direct Download Pill */}
          <a
            href="/JeetPrep.apk"
            download="JeetPrep.apk"
            title="Download JeetPrep Android App (.apk 2.1 MB)"
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/35 text-emerald-300 text-xs font-semibold transition-all shadow-sm active:scale-95 no-underline flex-shrink-0"
          >
            <span>📱</span>
            <span className="hidden sm:inline">Get App</span>
            <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/25 text-emerald-200 font-bold font-mono">APK</span>
          </a>

          {notifPermission === 'default' && (
            <button
              onClick={handleEnableNotification}
              title="Turn on Lock Screen Timer"
              className="hidden sm:flex text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all items-center gap-1 font-semibold flex-shrink-0"
            >
              <span>🔔</span>
              <span>Timer</span>
            </button>
          )}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
          {/* Kit AI Coach Button */}
          <button
            onClick={async () => {
              if (!userName) {
                setAuthModalConfig({
                  title: 'Meet Kit AI Coach',
                  subtitle: 'Sign in to get personalized study tips, exam motivation, and smart scheduling advice.',
                  sessionDuration: '',
                })
                setShowAuthModal(true)
                return
              }
              const ctx = await buildUserAIContext(userName)
              if (ctx && todayStudied > 0) {
                ctx.todayStudiedHours = Number(((todayStudied + Math.floor(elapsed / 1000)) / 3600).toFixed(1))
              }
              setUserAIContext(ctx)
              setShowAICoach(true)
            }}
            title="Chat with Kit AI"
            aria-label="Kit AI"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600/25 to-indigo-600/25 hover:from-purple-600/40 hover:to-indigo-600/40 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all cursor-pointer flex-shrink-0 shadow-sm"
          >
            <span>🤖</span>
            <span className="hidden sm:inline">Kit AI</span>
          </button>

          {/* Direct Leaderboard shortcut */}
          <button
            type="button"
            onClick={() => navigate('/leaderboard')}
            title="Study Leaderboard & Ranks"
            aria-label="Leaderboard"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#1c1c28] hover:bg-[#252538] border border-[#2e2e42] text-amber-300 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0"
          >
            <span>🏆</span>
            <span className="hidden sm:inline">Leaderboard</span>
          </button>

          {/* Unified Apps & Tools Trigger Button (Desktop & Mobile) */}
          <button
            type="button"
            onClick={() => setShowAppsMenu(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-purple-950/40 to-[#1c1c28] hover:from-purple-900/40 hover:to-[#252538] border border-purple-500/35 hover:border-purple-500/60 text-purple-200 text-xs font-bold transition-all shadow-sm active:scale-95 cursor-pointer flex-shrink-0 ml-0.5"
            title="Open JeetPrep Apps & Study Tools"
            aria-label="Apps Menu"
          >
            <span className="text-sm">⊞</span>
            <span>Apps</span>
          </button>
        </div>
      </div>

      {/* ── Main Responsive Content Area (Timer #1 on Mobile, 2 Columns on Desktop) ── */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-10 flex flex-col lg:grid lg:grid-cols-12 lg:gap-6 flex-1">
        {/* Left Column: Timer & Controls (Always #1 on Mobile) */}
        <div className="order-1 lg:order-1 lg:col-span-7 xl:col-span-7 flex flex-col gap-3">

          {/* Focus Mode & Visuals Toolbar */}
          <div className="flex items-center justify-between gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-2xl bg-[#14141c]/90 backdrop-blur-md border border-[#2a2a3e] shadow-sm">
            {/* Mode Switcher: Stopwatch vs Reverse Countdown Timer */}
            <div className="inline-flex p-0.5 rounded-xl bg-[#1c1c26] border border-[#2d2d3e] flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTimerMode('stopwatch')
                  try { localStorage.setItem('stt_timer_mode', 'stopwatch') } catch {}
                }}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  timerMode === 'stopwatch'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>⏱️</span>
                <span className="hidden sm:inline ml-1">Stopwatch</span>
                <span className="sm:hidden ml-0.5 text-[11px]">Watch</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimerMode('timer')
                  try { localStorage.setItem('stt_timer_mode', 'timer') } catch {}
                }}
                className={`px-2 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center cursor-pointer ${
                  timerMode === 'timer'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-sm font-extrabold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>⏳</span>
                <span className="hidden sm:inline ml-1">Timer (Test)</span>
                <span className="sm:hidden ml-0.5 text-[11px]">Timer</span>
              </button>
            </div>

            {/* Quick Focus Tools: Wallpaper & Zen Fullscreen */}
            <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowWallpaperModal(true)}
                title="Choose Focus Background Wallpaper"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-[#1c1c28] hover:bg-[#252538] border border-[#2e2e42] text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <span>🎨</span>
                <span className="hidden md:inline text-[11px] font-semibold">Wallpaper</span>
              </button>
              <button
                type="button"
                onClick={() => setIsZenMode(true)}
                title="Zen Fullscreen Mode (Press F)"
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-[#1c1c28] hover:bg-[#252538] border border-[#2e2e42] text-gray-300 hover:text-white text-xs font-medium transition-all cursor-pointer shadow-sm active:scale-95"
              >
                <span>⛶</span>
                <span className="hidden md:inline text-[11px] font-semibold">Fullscreen</span>
                <span className="md:hidden text-[11px] font-semibold">Zen</span>
              </button>
            </div>
          </div>

          {/* Main Stopwatch Timer Card */}
          <div
            className={`card flex flex-col flex-1 overflow-hidden transition-all duration-500 shadow-2xl backdrop-blur-md relative ${
              isRunning
                ? timerMode === 'timer'
                  ? 'bg-[#191512]/95 border-amber-500/50 shadow-[0_0_40px_-5px_rgba(245,158,11,0.35)] ring-1 ring-amber-500/30'
                  : 'bg-[#141424]/95 border-purple-500/50 shadow-[0_0_40px_-5px_rgba(139,92,246,0.35)] ring-1 ring-purple-500/30'
                : 'bg-[#14141a]/95 border-[#2e2e42]'
            }`}
          >
            <div ref={captureRef} className="rounded-2xl overflow-hidden bg-[#181822]/95 backdrop-blur-md">
              {/* Clock-Style Reverse Countdown Timer Panel */}
              {timerMode === 'timer' && (
                <div className="px-3.5 sm:px-4 py-3 bg-[#17141f]/95 border-b border-amber-500/25 flex flex-col gap-2.5">
                  {/* Header & Quick Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base flex-shrink-0">⏳</span>
                      <div className="text-left min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-extrabold text-amber-300 truncate">
                            Countdown: {formatCountdownDisplay(countdownRemainingSec)}
                          </span>
                          {isRunning && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse font-mono font-bold">
                              TEST RUNNING
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 block truncate font-medium">
                          Target: {formatCountdownDuration(countdownTargetSec)} • Synced with Study Stopwatch
                        </span>
                      </div>
                    </div>

                    {/* Set Custom Time Toggle */}
                    {!isRunning && (
                      <button
                        type="button"
                        onClick={() => setShowCustomTimePicker((prev) => !prev)}
                        className="text-[11px] px-2.5 py-1 rounded-xl bg-[#241e33] hover:bg-[#322a48] border border-amber-500/30 text-amber-200 font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95 flex-shrink-0"
                      >
                        <span>⚙️</span>
                        <span>{showCustomTimePicker ? 'Close' : 'Set Time'}</span>
                      </button>
                    )}
                  </div>

                  {/* Custom Clock-Style Time Picker (Hours, Minutes, Seconds) */}
                  {showCustomTimePicker && !isRunning && (
                    <div className="p-2.5 rounded-xl bg-[#0f0c18] border border-amber-500/20 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                        {/* Hours Picker */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-semibold mb-1">HOURS</span>
                          <div className="flex items-center gap-1 bg-[#1a1626] rounded-lg border border-[#2d2540] px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(-3600)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer font-bold select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="24"
                              value={Math.floor(countdownTargetSec / 3600)}
                              onChange={(e) => {
                                const newH = Math.max(0, Math.min(24, parseInt(e.target.value, 10) || 0))
                                const currentM = Math.floor((countdownTargetSec % 3600) / 60)
                                const newSec = Math.max(60, newH * 3600 + currentM * 60)
                                setCountdownTargetSec(newSec)
                                updateCountdownBaseline(elapsed)
                                try { localStorage.setItem('stt_countdown_target_sec', String(newSec)) } catch {}
                              }}
                              className="font-mono font-bold text-sm text-amber-300 w-8 text-center bg-transparent border-none p-0 focus:outline-none focus:bg-amber-500/10 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(3600)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer font-bold select-none"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <span className="text-gray-500 text-lg self-end mb-1">:</span>

                        {/* Minutes Picker */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-semibold mb-1">MINUTES</span>
                          <div className="flex items-center gap-1 bg-[#1a1626] rounded-lg border border-[#2d2540] px-1 py-0.5">
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(-300)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer font-bold select-none"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="59"
                              value={Math.floor((countdownTargetSec % 3600) / 60)}
                              onChange={(e) => {
                                const currentH = Math.floor(countdownTargetSec / 3600)
                                const newM = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
                                const newSec = Math.max(60, currentH * 3600 + newM * 60)
                                setCountdownTargetSec(newSec)
                                updateCountdownBaseline(elapsed)
                                try { localStorage.setItem('stt_countdown_target_sec', String(newSec)) } catch {}
                              }}
                              className="font-mono font-bold text-sm text-amber-300 w-8 text-center bg-transparent border-none p-0 focus:outline-none focus:bg-amber-500/10 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(300)}
                              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded cursor-pointer font-bold select-none"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <span className="text-gray-500 text-lg self-end mb-1">:</span>

                        {/* Quick Step Buttons (+5m, +15m, +30m) */}
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-semibold mb-1">QUICK ADD</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(300)}
                              className="px-2 py-1 rounded bg-[#1e192c] hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              +5m
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(900)}
                              className="px-2 py-1 rounded bg-[#1e192c] hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              +15m
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAdjustTarget(1800)}
                              className="px-2 py-1 rounded bg-[#1e192c] hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold cursor-pointer"
                            >
                              +30m
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowCustomTimePicker(false)}
                        className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer transition-all self-end mb-0.5 shadow-sm"
                      >
                        Done ✓
                      </button>
                    </div>
                  )}

                  {/* Quick Mock Test & Study Presets */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
                    <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex-shrink-0 mr-0.5">
                      Presets:
                    </span>
                    {[
                      { sec: 900, label: '15m' },
                      { sec: 1800, label: '30m' },
                      { sec: 2700, label: '45m' },
                      { sec: 3600, label: '1h Test' },
                      { sec: 7200, label: '2h Exam' },
                      { sec: 10800, label: '3h Mock Test' },
                    ].map((p) => (
                      <button
                        key={p.sec}
                        type="button"
                        disabled={isRunning}
                        onClick={() => handleSetPreset(p.sec)}
                        className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all flex-shrink-0 cursor-pointer ${
                          countdownTargetSec === p.sec
                            ? 'bg-amber-500 text-black shadow-md ring-1 ring-amber-400 font-extrabold'
                            : 'bg-[#1c172a] text-gray-300 hover:text-white border border-[#2d2540]'
                        } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Progress Bar showing test completion */}
                  <div className="w-full flex items-center gap-2 pt-0.5">
                    <div className="flex-1 h-1.5 rounded-full bg-[#1e1a2c] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-400 to-yellow-300 rounded-full transition-all duration-300"
                        style={{ width: `${countdownProgressPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 whitespace-nowrap">
                      {countdownProgressPct}% done
                    </span>
                  </div>
                </div>
              )}

              <StopwatchDisplay
                displayTime={timerMode === 'timer' ? formatCountdownDisplay(countdownRemainingSec) : displayTime}
                isRunning={isRunning}
                timerMode={timerMode}
                activeSubject={activeSubject}
              />

              {/* Subtle compact timeline pill */}
              <div className="flex justify-center pb-2.5 px-3 relative z-20">
                <SessionTimeline
                  timeline={timeline}
                  isRunning={isRunning}
                  startedAtMs={startTimestamp}
                  baseElapsed={elapsed}
                  laps={laps}
                />
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col gap-2.5 p-4 pt-3">
              {isTodayRest && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-purple-950/50 via-[#181428] to-indigo-950/40 border border-purple-500/30 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🛋️</span>
                    <div>
                      <h4 className="text-xs font-bold text-white">Today is your Rest Day</h4>
                      <p className="text-[11px] text-purple-300">Take a break and recharge! Streak Shield is active 🛡️.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/planner')}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-purple-600/25 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-semibold transition-all whitespace-nowrap cursor-pointer"
                  >
                    Day Planner →
                  </button>
                </div>
              )}

              {/* Guest Explorer Mode Banner */}
              {!userName && (
                <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2 text-purple-200 text-xs">
                    <span>🚀</span>
                    <span className="font-medium">Guest Mode — Timer & tools are free to test</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalConfig({
                        title: 'Join JeetPrep',
                        subtitle: 'Create a free account or sign in to save your sessions and build streaks.',
                        sessionDuration: elapsed > 0 ? displayTime : '',
                      })
                      setShowAuthModal(true)
                    }}
                    className="text-[11px] font-bold text-purple-300 hover:text-white underline cursor-pointer"
                  >
                    Sign In to Save →
                  </button>
                </div>
              )}

              <div className="flex gap-2 w-full">
                {hasTime && !isTodayRest && (
                  <button
                    onClick={() => {
                      if (isRunning) stop()
                      if (!userName) {
                        setAuthModalConfig({
                          title: 'Save Your Study Session',
                          subtitle: 'Create a free account or sign in to save this focus session into your permanent stats and streaks.',
                          sessionDuration: displayTime,
                        })
                        setShowAuthModal(true)
                        return
                      }
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
                  className={`pill-btn flex items-center justify-center gap-1.5 ${hasTime && !isTodayRest ? 'w-auto px-4' : 'w-full'}`}
                  style={{ background: '#1c1b29', border: '1px solid #373554', color: '#c4b5fd' }}
                >
                  <span>✨</span>
                  <span className="text-xs font-semibold">{hasTime && !isTodayRest ? 'Share' : 'Share Focus Card'}</span>
                </button>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    reset()
                    updateCountdownBaseline(0)
                    timerAlertFiredRef.current = false
                  }}
                  disabled={isTodayRest || isRunning || elapsed === 0}
                  className="pill-btn flex-1"
                  style={{ background: '#2a2a2a', color: (isTodayRest || isRunning || elapsed === 0) ? '#555' : 'white', cursor: (isTodayRest || isRunning || elapsed === 0) ? 'not-allowed' : 'pointer' }}
                >
                  Reset
                </button>
                {isTodayRest ? (
                  <button
                    disabled={true}
                    className="pill-btn flex-1 cursor-not-allowed opacity-90 shadow-md font-semibold"
                    style={{ background: '#2b1f47', color: '#c4b5fd', border: '1px solid rgba(168, 85, 247, 0.4)' }}
                  >
                    🛋️ Rest Day Active
                  </button>
                ) : (
                  <button
                    onClick={handleStartStop}
                    className="pill-btn flex-1"
                    style={{ background: isRunning ? '#ef4444' : '#22c55e', color: isRunning ? 'white' : 'black' }}
                  >
                    {isRunning ? 'Stop' : 'Start'}
                  </button>
                )}
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
                    <span>🪟 Float Timer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Goal Progress & To-Do Missions (lg:col-span-5 xl:col-span-5) */}
        <div className="order-2 lg:order-2 lg:col-span-5 xl:col-span-5 flex flex-col gap-3">
          {/* Daily Goal Progress Bar */}
          {goalProgress && (
            <div>
              {goalProgress.isRestDay ? (
                <div className="card px-4 py-3.5 flex flex-col gap-2.5 transition-all shadow-lg bg-gradient-to-r from-purple-950/40 via-[#181824] to-indigo-950/40 border border-purple-500/35">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🛋️</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white tracking-wide">
                            Sunday Rest & Buffer Day
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                            <span>🛡️</span> Streak Shield Active
                          </span>
                        </div>
                        <span className="text-[11px] text-gray-400 block mt-0.5">
                          Recharge and recover! Your 6-day study streak will NOT break.
                        </span>
                      </div>
                    </div>
                    {goalProgress.studiedSec > 0 ? (
                      <div className="text-right">
                        <span className="text-xs font-bold font-mono text-emerald-400">
                          +{goalProgress.studiedLabel}
                        </span>
                        <span className="block text-[10px] text-gray-400 font-medium">
                          Bonus Study Time
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate('/planner')}
                        className="text-[11px] px-3 py-1 rounded-xl bg-purple-600/25 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 font-semibold transition-all whitespace-nowrap"
                      >
                        Plan / Mock →
                      </button>
                    )}
                  </div>
                  {goalProgress.studiedSec > 0 && (
                    <div className="text-[11px] text-emerald-400 flex items-center justify-between border-t border-[#2a2a38] pt-2">
                      <span>🎉 Bonus session recorded today! Added to your lifetime total.</span>
                      <button
                        onClick={() => navigate('/planner')}
                        className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold hover:underline"
                      >
                        Day Sheet →
                      </button>
                    </div>
                  )}
                </div>
              ) : goalProgress.hasTarget ? (
                <div
                  className="card px-4 py-3.5 flex flex-col gap-2.5 transition-all shadow-lg bg-[#161622]/90 backdrop-blur-md border border-[#2d2d42]"
                  style={{
                    background: goalProgress.isAchieved
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.18) 0%, rgba(20, 20, 28, 0.95) 100%)'
                      : undefined,
                    borderColor: goalProgress.isAchieved ? 'rgba(34, 197, 94, 0.45)' : undefined,
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
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/25 text-purple-200 font-semibold border border-purple-500/40">
                            {goalProgress.source}
                          </span>
                        </div>
                        {dailyGoal?.subjects && (
                          <span className="text-[11px] text-gray-300 block truncate max-w-[200px]">
                            {dailyGoal.subjects}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold font-mono ${goalProgress.isAchieved ? 'text-green-400' : 'text-purple-300'}`}>
                        {goalProgress.studiedLabel} / {goalProgress.label}
                      </span>
                      <span className="block text-[10px] text-gray-300 font-medium">
                        {goalProgress.pct}% done
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 rounded-full bg-[#262635] overflow-hidden">
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
                      <span className="text-amber-300 font-medium">
                        ⏳ In Progress · {goalProgress.remainingLabel} left to reach target
                      </span>
                    ) : (
                      <span className="text-gray-300">
                        Not started yet today · Target: {goalProgress.label}
                      </span>
                    )}
                    <button
                      onClick={() => navigate('/planner')}
                      className="text-[10px] text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-0.5 hover:underline"
                    >
                      Day Sheet →
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => navigate('/planner')}
                  className="card px-3.5 py-2.5 flex items-center justify-between border-dashed border-[#3d3d52] hover:border-purple-500/60 bg-[#161622]/90 backdrop-blur-md cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎯</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-200">Set Today's Target Hours</p>
                      <p className="text-[10px] text-gray-400">
                        {goalProgress.studiedSec > 0
                          ? `Studied ${goalProgress.studiedLabel} today · Set a goal to track completion!`
                          : 'Define how many hours you want to study today'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 font-medium transition-all">
                    + Set Goal
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Daily Missions Checklist */}
          <div className="backdrop-blur-md rounded-2xl">
            <DailyMissions userName={userName} />
          </div>
        </div>
      </div>

      <SaveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
        captureTargetRef={captureRef}
        displayTime={displayTime}
        totalSeconds={totalSeconds}
        laps={laps}
        timeline={timeline}
        userName={userName}
        initialSubject={activeSubject}
        initialTopic={activeTopic}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={(loggedUsername) => {
          setShowAuthModal(false)
          // Open SaveModal if session had time
          if (elapsed > 0) {
            setShowModal(true)
          }
        }}
        title={authModalConfig.title}
        subtitle={authModalConfig.subtitle}
        sessionDuration={authModalConfig.sessionDuration}
      />
      <ShareCardModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        userName={userName}
        photoUrl={userProfile.photoUrl}
        todayStudiedSec={todayStudied + totalSeconds}
        dayNum={dayNum}
        streakCount={streakCount}
        dayPlan={dayPlan}
        activeSubject={activeSubject}
      />
      <BackgroundModal
        isOpen={showWallpaperModal}
        onClose={() => setShowWallpaperModal(false)}
        userName={userName}
        currentWallpaper={wallpaper}
        wallpaperConfig={wallpaperConfig}
        onSelectWallpaper={handleSelectWallpaper}
        onUpdateConfig={handleUpdateWallpaperConfig}
        onResetDefault={handleResetWallpaper}
      />
      <Toast message={toast.message} visible={toast.visible} onDismiss={dismissToast} />
      {/* ── Kit AI Coach Drawer ── */}
      <AICoachDrawer
        isOpen={showAICoach}
        onClose={() => setShowAICoach(false)}
        userContext={userAIContext}
      />

      {/* ── Zen / Fullscreen Focus Mode Overlay ── */}
      {isZenMode && (
        <div className={`fixed inset-0 z-50 flex flex-col justify-between p-3 sm:p-8 lg:p-10 text-white select-none animate-fadeIn ${wallpaper ? 'bg-transparent' : 'bg-[#0a0a0a]'}`}>
          {/* Zen Mode Wallpaper Background Layer */}
          {wallpaper && (
            <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden select-none">
              <div
                className="w-full h-full transition-all duration-500"
                style={{
                  backgroundImage: `url(${wallpaper})`,
                  backgroundPosition: 'center',
                  backgroundSize: wallpaperConfig.fit === 'contain' ? 'contain' : 'cover',
                  backgroundRepeat: 'no-repeat',
                  filter: wallpaperConfig.blur ? 'blur(6px)' : 'none',
                  transform: wallpaperConfig.blur ? 'scale(1.06)' : 'none',
                }}
              />
              <div
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{ opacity: Math.max(wallpaperConfig.dim ?? 0.45, 0.4) }}
              />
            </div>
          )}

          {/* Top Header */}
          <div className="flex items-center justify-between w-full max-w-5xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 sm:px-3 py-1 rounded-full border ${
                timerMode === 'timer'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
              }`}>
                {timerMode === 'timer' ? '⏳ Reverse Countdown Timer' : '⏱️ Stopwatch'}
              </span>
              {activeSubject && (
                <span className="text-xs font-semibold text-gray-400 truncate max-w-[120px] sm:max-w-none">
                  • {activeSubject} {activeTopic ? `(${activeTopic})` : ''}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowWallpaperModal(true)}
                className="px-2.5 sm:px-3 py-1.5 rounded-full bg-[#1e1e1e]/90 hover:bg-[#2c2c2c] border border-[#333] text-xs font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 backdrop-blur-sm"
                title="Change Focus Wallpaper"
              >
                <span>🎨</span>
                <span className="hidden sm:inline">Wallpaper</span>
              </button>
              <button
                onClick={() => setIsZenMode(false)}
                className="px-3 sm:px-3.5 py-1.5 rounded-full bg-[#1e1e1e]/90 hover:bg-[#2c2c2c] border border-[#333] text-xs font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-1.5 backdrop-blur-sm"
              >
                <span>✕</span>
                <span className="hidden sm:inline">Exit (Esc / F)</span>
                <span className="sm:hidden">Exit</span>
              </button>
            </div>
          </div>

          {/* Center Immense Timer */}
          <div className="flex flex-col items-center justify-center my-auto text-center w-full max-w-5xl mx-auto px-1 sm:px-4">
            {timerMode === 'timer' ? (
              <div className="flex flex-col items-center justify-center w-full">
                <span className="text-[11px] sm:text-sm font-bold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-1.5">
                  <span>⏳</span> Reverse Test Countdown
                </span>
                <div
                  className="font-black font-mono tracking-tight text-amber-100 drop-shadow-[0_0_30px_rgba(245,158,11,0.65)] text-center select-none w-full tabular-nums whitespace-nowrap"
                  style={{
                    fontSize: 'clamp(44px, min(15vw, 20vh), 130px)',
                    lineHeight: 1,
                    fontFamily: '"Roboto Mono", ui-monospace, monospace',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {formatCountdownDisplay(countdownRemainingSec)}
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
                  <span className="text-[11px] sm:text-xs font-mono text-gray-400 bg-white/5 border border-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
                    Stopwatch Logged: {displayTime}
                  </span>
                  <span className="text-[11px] sm:text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full backdrop-blur-sm">
                    Target: {formatCountdownDuration(countdownTargetSec)} ({countdownProgressPct}%)
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-purple-400 mb-2 flex items-center gap-1.5">
                  <span>⏱️</span> Elapsed Study Time
                </span>
                <div className="flex items-baseline justify-center tracking-tight font-mono select-none w-full max-w-full whitespace-nowrap overflow-visible">
                  <span
                    className="font-black text-white drop-shadow-2xl tabular-nums"
                    style={{
                      fontSize: 'clamp(36px, min(12.5vw, 17vh), 110px)',
                      lineHeight: 1,
                      fontFamily: '"Roboto Mono", ui-monospace, monospace',
                      letterSpacing: '-0.03em',
                    }}
                  >
                    {zenMainTime}
                  </span>
                  {zenCentis !== undefined && (
                    <span
                      className="font-bold text-purple-300/85 drop-shadow-lg tabular-nums ml-1 sm:ml-2"
                      style={{
                        fontSize: 'clamp(18px, min(6.5vw, 8.5vh), 54px)',
                        lineHeight: 1,
                        fontFamily: '"Roboto Mono", ui-monospace, monospace',
                      }}
                    >
                      .{zenCentis}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Zen Mode Live Kinetic Equalizer Wave */}
            {isRunning && (
              <div className="flex items-center justify-center gap-1.5 mt-5 h-8">
                {Array.from({ length: 24 }).map((_, idx) => (
                  <span
                    key={idx}
                    className={`w-1.5 rounded-full ${
                      timerMode === 'timer'
                        ? 'bg-gradient-to-t from-amber-500 via-orange-400 to-yellow-300'
                        : 'bg-gradient-to-t from-purple-500 via-indigo-400 to-cyan-300'
                    }`}
                    style={{
                      animation: `${idx % 3 === 0 ? 'eqDance1' : idx % 3 === 1 ? 'eqDance2' : 'eqDance3'} 1.1s ease-in-out ${idx * 70}ms infinite`,
                      boxShadow: timerMode === 'timer'
                        ? '0 0 10px rgba(245, 158, 11, 0.6)'
                        : '0 0 10px rgba(168, 85, 247, 0.6)',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Goal progress sub-bar */}
            {goalProgress && goalProgress.hasTarget && (
              <div className="mt-8 w-full max-w-md px-2">
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
                onClick={handleStartStop}
                className="px-8 py-3.5 rounded-full font-extrabold text-base transition-all shadow-xl hover:scale-105"
                style={{
                  background: isRunning ? '#ef4444' : '#22c55e',
                  color: isRunning ? 'white' : 'black',
                  minWidth: '160px',
                }}
              >
                {isRunning ? 'Pause' : 'Start'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 hidden sm:block">
              Press <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">Space</kbd> to Start/Pause · <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">F</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-[#222] border border-[#333] text-gray-300">Esc</kbd> to Exit
            </p>
            <p className="text-[11px] text-gray-400 sm:hidden">
              Tap Exit to return to dashboard
            </p>
          </div>
        </div>
      )}

      {/* ── Unified Categorized Apps & Tools Modal / Drawer (Desktop & Mobile) ── */}
      {showAppsMenu && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          {/* Backdrop (tap outside to close) */}
          <div
            onClick={() => setShowAppsMenu(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer transition-opacity"
            style={{ animation: 'fadeIn 150ms ease-out' }}
          />

          {/* Modal / Bottom Sheet */}
          <div
            className="relative z-10 w-full max-w-lg md:max-w-xl mx-auto bg-[#14141c] border border-[#2e2e42] rounded-t-3xl md:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] max-h-[85dvh] text-white overflow-hidden"
            style={{ animation: 'slideUp 200ms ease-out' }}
          >
            {/* Drawer top handle for mobile */}
            <div className="pt-3 pb-1 flex justify-center w-full flex-shrink-0 md:hidden">
              <div className="w-12 h-1.5 rounded-full bg-[#3a3a4e]" />
            </div>

            <div className="flex items-center justify-between px-5 py-3 border-b border-[#252538] flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚡</span>
                <span className="text-sm font-black text-white">JeetPrep Apps & Tools</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAppsMenu(false)}
                className="w-8 h-8 rounded-full bg-[#20202e] hover:bg-[#2c2c40] text-gray-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-all active:scale-95"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content with Clean Categorized Sections */}
            <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 flex flex-col gap-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))]">
              {/* Section 1: 📅 Time Table & Planning */}
              <div>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-[11px] font-bold text-pink-400 uppercase tracking-wider">📅 Time Table & Planning</span>
                  <div className="h-px bg-[#26263a] flex-1" />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/planner') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 flex-shrink-0">🌸</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Day Planner</h4>
                      <p className="text-[10px] text-gray-400 truncate">Timetable & daily sheet</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/syllabus') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 flex-shrink-0">📚</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Subject Tracker</h4>
                      <p className="text-[10px] text-gray-400 truncate">Syllabus & topics</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 2: 🏛️ Exam Prep & Doubts */}
              <div>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">🏛️ Exam Prep & Doubts</span>
                  <div className="h-px bg-[#26263a] flex-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/exam-hub') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 flex-shrink-0">🏛️</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Exam Hub Search</h4>
                      <p className="text-[10px] text-gray-400 truncate">Syllabus & real PYQs</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/doubts') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex-shrink-0">👨‍🏫</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Doubt Solver</h4>
                      <p className="text-[10px] text-emerald-400 truncate">1st Free • Mentor written</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/blog') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-purple-500/15 border border-purple-500/30 flex-shrink-0">📰</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Study Blog</h4>
                      <p className="text-[10px] text-purple-400 truncate">Hacks & timetables</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 3: 👥 Live Study & Tools */}
              <div>
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">👥 Live Study & Tools</span>
                  <div className="h-px bg-[#26263a] flex-1" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/watch') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex-shrink-0">👥</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Watch Partner</h4>
                      <p className="text-[10px] text-gray-400 truncate">Live room & share timer</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); navigate('/history') }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 flex-shrink-0">🕒</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Study History</h4>
                      <p className="text-[10px] text-gray-400 truncate">Logs & streaks</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setShowAppsMenu(false); togglePictureInPicture() }}
                    className="p-3 rounded-2xl bg-[#191924] hover:bg-[#222232] border border-[#2a2a3e] flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98"
                  >
                    <span className="text-2xl p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 flex-shrink-0">🪟</span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">Float Timer</h4>
                      <p className="text-[10px] text-gray-400 truncate">Mini screen timer (PiP)</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Download App APK Banner */}
              <a
                href="/JeetPrep.apk"
                download="JeetPrep.apk"
                onClick={() => setShowAppsMenu(false)}
                className="p-3 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-[#191924] hover:bg-[#222232] border border-emerald-500/35 flex items-center gap-3 text-left transition-all cursor-pointer active:scale-98 no-underline"
              >
                <span className="text-2xl p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex-shrink-0">📱</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white truncate">Download Android App</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold font-mono">APK 2.1 MB</span>
                  </div>
                  <p className="text-[10px] text-emerald-300/80 truncate">Install APK directly • Fast & offline ready</p>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Admin Timer Booster Modal (Admin Only) */}
      {ADMIN_USERNAMES.includes(userName?.toLowerCase()) && (
        <AdminTimerBoosterModal
          isOpen={showTimerBoosterModal}
          onClose={() => setShowTimerBoosterModal(false)}
          initialUser="kittu"
        />
      )}

      {/* ── Test / Countdown Timer Completion Modal ── */}
      {showTimerCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowTimerCompleteModal(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer"
            style={{ animation: 'fadeIn 200ms ease-out' }}
          />
          <div
            className="relative z-10 w-full max-w-md bg-[#13131c] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] flex flex-col items-center text-center text-white"
            style={{ animation: 'scaleUp 220ms ease-out' }}
          >
            {/* Pulsing ring bell icon */}
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-4xl mb-3 shadow-[0_0_24px_rgba(245,158,11,0.4)] animate-bounce">
              ⏰
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>TIME'S UP · TEST COMPLETED</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-white mb-1.5">
              Target Completed! 🎯
            </h3>
            <p className="text-sm text-gray-300 mb-5 leading-relaxed">
              Aapka <span className="font-bold text-amber-300">{formatCountdownDuration(countdownTargetSec)}</span> ka test countdown timer pura ho gaya hai! Stopwatch ne aapka focus time sync karke save karne ke liye ready kar diya hai.
            </p>

            {/* Target & elapsed stats pill */}
            <div className="w-full bg-[#1b1b26] border border-[#2b2b3d] rounded-2xl p-4 mb-5 flex items-center justify-around">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Target Test</p>
                <p className="text-lg font-mono font-black text-amber-400">{formatCountdownDuration(countdownTargetSec)}</p>
              </div>
              <div className="w-px h-8 bg-[#2d2d40]" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total Focus Logged</p>
                <p className="text-lg font-mono font-black text-emerald-400">{displayTime?.split('.')[0] || '0:00:00'}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowTimerCompleteModal(false)
                  if (!userName) {
                    setAuthModalConfig({
                      title: 'Save Your Test Session',
                      subtitle: 'Sign in to save this completed test focus session into your permanent history & streaks.',
                      sessionDuration: displayTime,
                    })
                    setShowAuthModal(true)
                  } else {
                    setShowModal(true)
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💾</span>
                <span>Save Study Session</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTimerCompleteModal(false)}
                className="py-3 px-4 rounded-xl font-semibold text-sm bg-[#1e1e2c] hover:bg-[#28283a] text-gray-300 border border-[#303046] active:scale-98 transition-all cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Profile Pill ──────────────────────────────────────────────────────────────
function ProfilePill({ userName, avatarColor, photoUrl, onLogout, onOpenWallpaper, onOpenTimerBooster }) {
  const [open, setOpen] = useState(false)
  const [imgError, setImgError] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    setImgError(false)
  }, [photoUrl])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 sm:gap-2 rounded-full px-1.5 sm:px-2 py-1 sm:py-1.5 transition-colors hover:bg-[#1a1a1a] flex-shrink-0 cursor-pointer"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
          style={{ background: avatarColor }}
        >
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={userName}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            (userName || 'U')[0].toUpperCase()
          )}
        </div>
        <span className="text-xs sm:text-sm text-gray-300 font-medium max-w-[65px] sm:max-w-[100px] truncate">@{userName}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-11 z-50 card p-3 flex flex-col gap-1 min-w-[210px] max-w-[calc(100vw-24px)] bg-[#14141c]/95 backdrop-blur-xl border border-[#2d2d42] shadow-2xl rounded-2xl"
            style={{ animation: 'scaleIn 150ms ease-out' }}
          >
            {/* Avatar header */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0 overflow-hidden shadow-inner"
                style={{ background: avatarColor }}
              >
                {photoUrl && !imgError ? (
                  <img
                    src={photoUrl}
                    alt={userName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (userName || 'U')[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">@{userName}</p>
                <p className="text-xs text-gray-400">Your account</p>
              </div>
            </div>
            <div className="border-t border-[#2a2a2a] my-1" />

            {/* Admin Quick Booster Button (Admin only) */}
            {ADMIN_USERNAMES.includes(userName?.toLowerCase()) && (
              <button
                type="button"
                onClick={() => { onOpenTimerBooster?.(); setOpen(false) }}
                className="flex items-center gap-2 px-2.5 py-2 rounded-xl transition-all text-left w-full bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-300 font-bold border border-amber-500/35 my-0.5 shadow-sm active:scale-98 cursor-pointer"
              >
                <span className="text-sm">⚡</span>
                <span className="text-sm">Admin Timer Booster</span>
              </button>
            )}

            <MenuBtn icon="👤" label="My Profile & Stats" onClick={() => { navigate('/profile'); setOpen(false) }} />
            <MenuBtn icon="🎨" label="Change Wallpaper" onClick={() => { onOpenWallpaper?.(); setOpen(false) }} />
            <a
              href="/JeetPrep.apk"
              download="JeetPrep.apk"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors text-left w-full hover:bg-emerald-950/30 text-emerald-300 no-underline cursor-pointer"
            >
              <span className="text-sm">📱</span>
              <span className="text-sm font-medium">Download App (APK 2.1MB)</span>
            </a>
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
