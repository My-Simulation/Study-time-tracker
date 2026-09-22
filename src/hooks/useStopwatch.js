/**
 * useStopwatch.js
 * Persistent, accurate stopwatch with localStorage persistence and Firestore live status sync.
 * - Survives page changes (navigating to Watch, History, Plan, etc.)
 * - Survives browser refreshes
 * - Synchronizes real-time live status to Firestore with exact epoch timestamps
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { formatTime } from '../utils/formatTime'
import { updateLiveStatus, subscribeToLiveStatus, getLiveStatus } from '../utils/firestoreHelpers'
import { backgroundTimer } from '../utils/backgroundTimer'

const STORAGE_PREFIX = 'stt_stopwatch_state_'

export function useStopwatch(userName) {
  const storageKey = userName ? `${STORAGE_PREFIX}${userName.toLowerCase()}` : null
  const deviceIdRef = useRef(
    `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  )
  const lastLocalActionRef = useRef(0)
  const lastLocalActionType = useRef('')

  // Initialize state from localStorage if available
  const [elapsed, setElapsed] = useState(() => {
    if (!storageKey) return 0
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return 0
      const saved = JSON.parse(raw)
      if (saved.isRunning && saved.startTimestamp) {
        return (saved.baseElapsed || 0) + Math.max(0, Date.now() - saved.startTimestamp)
      }
      return saved.baseElapsed || 0
    } catch {
      return 0
    }
  })

  const [isRunning, setIsRunning] = useState(() => {
    if (!storageKey) return false
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return false
      return Boolean(JSON.parse(raw).isRunning)
    } catch {
      return false
    }
  })

  const [laps, setLaps] = useState(() => {
    if (!storageKey) return []
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return []
      return JSON.parse(raw).laps || []
    } catch {
      return []
    }
  })

  const [displayTime, setDisplayTime] = useState(() => formatTime(elapsed))

  // Refs for animation and timestamp tracking
  const rafRef = useRef(null)
  const startTimestampRef = useRef(null)
  const baseElapsedRef = useRef(0)
  const heartbeatRef = useRef(null)

  // Load initial refs from localStorage
  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw)
        baseElapsedRef.current = Number(saved.baseElapsed) || 0
        if (saved.isRunning && saved.startTimestamp) {
          startTimestampRef.current = Number(saved.startTimestamp)
          const current = baseElapsedRef.current + Math.max(0, Date.now() - startTimestampRef.current)
          setElapsed(current)
          setDisplayTime(formatTime(current))
          backgroundTimer.setTimerState({
            isRunning: true,
            startTimestamp: startTimestampRef.current,
            baseElapsed: baseElapsedRef.current,
          })
        } else {
          startTimestampRef.current = null
          setElapsed(baseElapsedRef.current)
          setDisplayTime(formatTime(baseElapsedRef.current))
          backgroundTimer.setTimerState({
            isRunning: false,
            startTimestamp: null,
            baseElapsed: baseElapsedRef.current,
          })
        }
      }
    } catch (e) {
      console.warn('Error reading stopwatch from storage:', e)
    }
  }, [storageKey])

  // Save current state to localStorage helper
  const persistState = useCallback((running, startMs, baseMs, currentLaps) => {
    if (!storageKey) return
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          isRunning: running,
          startTimestamp: startMs,
          baseElapsed: baseMs,
          laps: currentLaps,
          updatedAt: Date.now(),
        })
      )
    } catch (e) {
      console.warn('Failed to persist stopwatch state:', e)
    }
  }, [storageKey])

  // ── Tick loop (requestAnimationFrame) ─────────────────────────────────────
  const tick = useCallback(() => {
    if (!startTimestampRef.current) return
    const now = Date.now()
    const current = baseElapsedRef.current + Math.max(0, now - startTimestampRef.current)
    setElapsed(current)
    setDisplayTime(formatTime(current))
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // Auto-start ticking if initialized as running
  useEffect(() => {
    if (isRunning && startTimestampRef.current) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isRunning, tick])

  // ── Heartbeat to Firestore while running (every 30 seconds) ───────────────
  useEffect(() => {
    if (!userName) return

    if (isRunning && startTimestampRef.current) {
      heartbeatRef.current = setInterval(async () => {
        if (!startTimestampRef.current) return

        // 1. ALWAYS verify remote state first, even if backgrounded!
        try {
          const fresh = await getLiveStatus(userName, true)
          if (fresh) {
            const freshReset = Number(fresh.resetAtMs) || 0
            const freshSaved = Number(fresh.lastSavedAtMs) || 0
            const localStart = startTimestampRef.current
            const isFreshReset =
              fresh.action === 'reset' ||
              fresh.action === 'save_reset' ||
              (!fresh.isRunning && Number(fresh.baseElapsed || 0) === 0) ||
              (Boolean(localStart) && freshReset > 0 && freshReset >= localStart - 500) ||
              (Boolean(localStart) && freshSaved > 0 && freshSaved >= localStart - 500)

            if (isFreshReset && (!fresh.deviceId || fresh.deviceId !== deviceIdRef.current)) {
              reconcileWithRemote(fresh, true)
              return
            }
          }
        } catch {}

        // Guard: Don't blast heartbeats if document is backgrounded/sleeping or timer stopped
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
          return
        }
        if (!startTimestampRef.current) return

        updateLiveStatus(userName, {
          isRunning: true,
          baseElapsed: baseElapsedRef.current,
          startTimestamp: startTimestampRef.current,
          deviceId: deviceIdRef.current,
          laps,
          action: 'heartbeat',
        }).catch(() => {})
      }, 30000)
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [isRunning, userName, laps, reconcileWithRemote])

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (isRunning) return
    const now = Date.now()
    lastLocalActionRef.current = now
    lastLocalActionType.current = 'start'

    startTimestampRef.current = now
    setIsRunning(true)

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {})
      } catch (e) {}
    }

    backgroundTimer.setTimerState({
      isRunning: true,
      startTimestamp: now,
      baseElapsed: baseElapsedRef.current,
    })
    backgroundTimer.startAudio()
    backgroundTimer.requestWakeLock()

    persistState(true, now, baseElapsedRef.current, laps)

    if (userName) {
      updateLiveStatus(userName, {
        isRunning: true,
        baseElapsed: baseElapsedRef.current,
        startTimestamp: now,
        deviceId: deviceIdRef.current,
        laps,
        action: 'start',
      }).catch(() => {})
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [isRunning, laps, persistState, tick, userName])

  // ── Stop (pause) ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!isRunning) return
    const now = Date.now()
    lastLocalActionRef.current = now
    lastLocalActionType.current = 'stop'

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const finalElapsed = startTimestampRef.current
      ? baseElapsedRef.current + Math.max(0, now - startTimestampRef.current)
      : baseElapsedRef.current

    baseElapsedRef.current = finalElapsed
    startTimestampRef.current = null
    setElapsed(finalElapsed)
    setDisplayTime(formatTime(finalElapsed))
    setIsRunning(false)

    backgroundTimer.setTimerState({
      isRunning: false,
      startTimestamp: null,
      baseElapsed: finalElapsed,
    })
    backgroundTimer.pauseAudio()
    backgroundTimer.releaseWakeLock()

    persistState(false, null, finalElapsed, laps)

    if (userName) {
      updateLiveStatus(userName, {
        isRunning: false,
        baseElapsed: finalElapsed,
        startTimestamp: null,
        deviceId: deviceIdRef.current,
        laps,
        action: 'stop',
      }).catch(() => {})
    }
  }, [isRunning, laps, persistState, userName])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    const now = Date.now()
    lastLocalActionRef.current = now
    lastLocalActionType.current = 'reset'

    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    baseElapsedRef.current = 0
    startTimestampRef.current = null
    setElapsed(0)
    setDisplayTime('0:00:00.00')
    setLaps([])
    setIsRunning(false)

    backgroundTimer.resetState()

    if (storageKey) {
      try {
        localStorage.removeItem(storageKey)
      } catch {}
    }

    if (userName) {
      updateLiveStatus(userName, {
        isRunning: false,
        baseElapsed: 0,
        startTimestamp: null,
        deviceId: deviceIdRef.current,
        laps: [],
        action: 'reset',
        resetAtMs: now,
        lastSavedAtMs: now,
      }).catch(() => {})
    }
  }, [storageKey, userName])

  // ── Lap ───────────────────────────────────────────────────────────────────
  const lap = useCallback(() => {
    if (!isRunning || !startTimestampRef.current) return
    const now = Date.now()
    lastLocalActionRef.current = now
    lastLocalActionType.current = 'lap'

    const currentTotal = baseElapsedRef.current + Math.max(0, now - startTimestampRef.current)

    setLaps((prev) => {
      const lastLapTotalMs = prev.length > 0 ? prev[0].totalMs : 0
      const splitMs = Math.max(0, currentTotal - lastLapTotalMs)

      const newLap = {
        lapNo: prev.length + 1,
        split: formatTime(splitMs),
        total: formatTime(currentTotal),
        splitMs,
        totalMs: currentTotal,
      }

      const updatedLaps = [newLap, ...prev]
      const splitValues = updatedLaps.map((l) => l.splitMs)
      const minSplit = Math.min(...splitValues)
      const maxSplit = Math.max(...splitValues)

      const formatted = updatedLaps.map((l) => ({
        ...l,
        color:
          updatedLaps.length < 2
            ? 'normal'
            : l.splitMs === minSplit
            ? 'green'
            : l.splitMs === maxSplit
            ? 'red'
            : 'normal',
      }))

      persistState(true, startTimestampRef.current, baseElapsedRef.current, formatted)

      if (userName) {
        updateLiveStatus(userName, {
          isRunning: true,
          baseElapsed: baseElapsedRef.current,
          startTimestamp: startTimestampRef.current,
          deviceId: deviceIdRef.current,
          laps: formatted,
          action: 'lap',
        }).catch(() => {})
      }

      return formatted
    })
  }, [isRunning, persistState, userName])

  // ── Real-Time Cross-Device Reconciliation ──────────────────────────────────
  const reconcileWithRemote = useCallback(
    (remote, isDirectFetch = false) => {
      if (!remote) return
      // Ignore echoes from this same device tab/session unless waking up directly
      if (!isDirectFetch && remote.deviceId && remote.deviceId === deviceIdRef.current) return

      const remoteUpdated = Number(remote.updatedAtMs) || 0
      const remoteResetAt = Number(remote.resetAtMs) || 0
      const remoteLastSavedAt = Number(remote.lastSavedAtMs) || 0
      const localLastAction = lastLocalActionRef.current
      const localStart = startTimestampRef.current

      // Check if remote state represents an authoritative Reset or Save
      const isRemoteReset =
        remote.action === 'reset' ||
        remote.action === 'save_reset' ||
        (!remote.isRunning && Number(remote.baseElapsed || 0) === 0) ||
        (Boolean(localStart) && remoteResetAt > 0 && remoteResetAt >= localStart - 500) ||
        (Boolean(localStart) && remoteLastSavedAt > 0 && remoteLastSavedAt >= localStart - 500)

      if (isRemoteReset) {
        // Only ignore if user explicitly clicked "Start" locally strictly AFTER the remote reset/save
        const remoteActionTime = Math.max(remoteUpdated, remoteResetAt, remoteLastSavedAt)
        if (
          localLastAction > 0 &&
          lastLocalActionType.current === 'start' &&
          localLastAction > remoteActionTime + 1000
        ) {
          return
        }

        // Apply clean reset: Mobile/other device stops and resets to 0:00 immediately
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        startTimestampRef.current = null
        baseElapsedRef.current = 0
        setElapsed(0)
        setDisplayTime('0:00:00.00')
        setIsRunning(false)
        setLaps([])

        backgroundTimer.resetState()

        if (storageKey) {
          try {
            localStorage.removeItem(storageKey)
          } catch {}
        }
        return
      }

      // If user performed a local manual action strictly AFTER remote update, local takes precedence
      if (localLastAction > 0 && localLastAction > remoteUpdated + 500) {
        return
      }

      const remoteRunning = Boolean(remote.isRunning)
      const remoteStart = remote.startedAtMs || remote.startTimestamp || null
      const remoteBase = Number(remote.baseElapsed) || 0
      const remoteLaps = Array.isArray(remote.laps) ? remote.laps : []

      if (remoteRunning && remoteStart) {
        startTimestampRef.current = remoteStart
        baseElapsedRef.current = remoteBase
        const current = remoteBase + Math.max(0, Date.now() - remoteStart)

        setElapsed(current)
        setDisplayTime(formatTime(current))
        setIsRunning(true)
        setLaps(remoteLaps)

        persistState(true, remoteStart, remoteBase, remoteLaps)

        backgroundTimer.setTimerState({
          isRunning: true,
          startTimestamp: remoteStart,
          baseElapsed: remoteBase,
        })
        backgroundTimer.startAudio()
        backgroundTimer.requestWakeLock()

        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      } else {
        // Remote device paused
        if (rafRef.current) cancelAnimationFrame(rafRef.current)

        startTimestampRef.current = null
        baseElapsedRef.current = remoteBase

        setElapsed(remoteBase)
        setDisplayTime(formatTime(remoteBase))
        setIsRunning(false)
        setLaps(remoteLaps)

        backgroundTimer.setTimerState({
          isRunning: false,
          startTimestamp: null,
          baseElapsed: remoteBase,
        })
        backgroundTimer.pauseAudio()
        backgroundTimer.releaseWakeLock()

        persistState(false, null, remoteBase, remoteLaps)
      }
    },
    [persistState, storageKey, tick]
  )

  // ── Firestore Snapshot Subscription ───────────────────────────────────────
  useEffect(() => {
    if (!userName) return

    const unsubscribe = subscribeToLiveStatus(userName, (remote) => {
      reconcileWithRemote(remote, false)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [userName, reconcileWithRemote])

  // ── App Wake-Up / Visibility Change / Reconnect Reconciliation ────────────
  // When device wakes up from lock screen or returns to tab: immediately fetch authoritative cloud state
  useEffect(() => {
    if (!userName) return

    const checkServer = async () => {
      try {
        const remote = await getLiveStatus(userName, true)
        if (remote) reconcileWithRemote(remote, true)
      } catch (e) {}
    }

    // 1. Initial direct check on mount
    checkServer()

    // 2. On wake-up, screen unlock, focus, or online reconnect
    const handleWakeup = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkServer()
        setTimeout(checkServer, 1000)
        setTimeout(checkServer, 2500)
      }
    }

    document.addEventListener('visibilitychange', handleWakeup)
    window.addEventListener('focus', handleWakeup)
    window.addEventListener('pageshow', handleWakeup)
    window.addEventListener('online', handleWakeup)

    return () => {
      document.removeEventListener('visibilitychange', handleWakeup)
      window.removeEventListener('focus', handleWakeup)
      window.removeEventListener('pageshow', handleWakeup)
      window.removeEventListener('online', handleWakeup)
    }
  }, [userName, reconcileWithRemote])

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [])

  // Sync with backgroundTimer (MediaSession / Lock Screen controls / Tab Title / Silent Audio)
  useEffect(() => {
    backgroundTimer.setCallbacks({
      onPlay: start,
      onPause: stop,
      onLap: lap,
      onTick: (liveElapsed, liveDisplayTime) => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          setElapsed(liveElapsed)
          setDisplayTime(liveDisplayTime)
        }
      },
      onVerifyRemote: async () => {
        if (!userName) return
        try {
          const fresh = await getLiveStatus(userName, true)
          if (fresh) {
            reconcileWithRemote(fresh, true)
          }
        } catch (e) {}
      },
    })
  }, [start, stop, lap, userName, reconcileWithRemote])

  useEffect(() => {
    backgroundTimer.update({ isRunning, displayTime, elapsed })
  }, [isRunning, displayTime, elapsed])

  // If timer was already running on load or refresh, resume audio on first touch/click
  useEffect(() => {
    if (!isRunning) return
    const handleInteraction = () => {
      backgroundTimer.startAudio()
    }
    window.addEventListener('click', handleInteraction, { once: true })
    window.addEventListener('touchstart', handleInteraction, { once: true })
    return () => {
      window.removeEventListener('click', handleInteraction)
      window.removeEventListener('touchstart', handleInteraction)
    }
  }, [isRunning])

  const togglePictureInPicture = useCallback(() => {
    return backgroundTimer.togglePictureInPicture()
  }, [])

  return {
    elapsed,
    isRunning,
    laps,
    displayTime,
    start,
    stop,
    reset,
    lap,
    togglePictureInPicture,
  }
}
