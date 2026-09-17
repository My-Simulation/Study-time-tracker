/**
 * useStopwatch.js
 * Persistent, accurate stopwatch with localStorage persistence and Firestore live status sync.
 * - Survives page changes (navigating to Watch, History, Plan, etc.)
 * - Survives browser refreshes
 * - Synchronizes real-time live status to Firestore with exact epoch timestamps
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { formatTime } from '../utils/formatTime'
import { updateLiveStatus, subscribeToLiveStatus } from '../utils/firestoreHelpers'
import { backgroundTimer } from '../utils/backgroundTimer'

const STORAGE_PREFIX = 'stt_stopwatch_state_'

export function useStopwatch(userName) {
  const storageKey = userName ? `${STORAGE_PREFIX}${userName.toLowerCase()}` : null
  const deviceIdRef = useRef(
    `dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  )
  const lastLocalActionRef = useRef(0)

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

  // ── Heartbeat to Firestore while running (every 10 seconds) ───────────────
  useEffect(() => {
    if (!userName) return

    if (isRunning && startTimestampRef.current) {
      // Periodic heartbeat
      heartbeatRef.current = setInterval(() => {
        updateLiveStatus(userName, {
          isRunning: true,
          baseElapsed: baseElapsedRef.current,
          startTimestamp: startTimestampRef.current,
          deviceId: deviceIdRef.current,
          laps,
        }).catch(() => {})
      }, 10000)
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [isRunning, userName, laps])

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (isRunning) return
    lastLocalActionRef.current = Date.now()

    const now = Date.now()
    startTimestampRef.current = now
    setIsRunning(true)

    // Immediately start audio and inform backgroundTimer with exact timestamps
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
      }).catch(() => {})
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [isRunning, laps, persistState, tick, userName])

  // ── Stop (pause) ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!isRunning) return
    lastLocalActionRef.current = Date.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    const now = Date.now()
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
      }).catch(() => {})
    }
  }, [isRunning, laps, persistState, userName])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (isRunning) return
    lastLocalActionRef.current = Date.now()
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    baseElapsedRef.current = 0
    startTimestampRef.current = null
    setElapsed(0)
    setDisplayTime('0:00:00.00')
    setLaps([])
    setIsRunning(false)

    backgroundTimer.setTimerState({
      isRunning: false,
      startTimestamp: null,
      baseElapsed: 0,
    })
    backgroundTimer.pauseAudio()
    backgroundTimer.releaseWakeLock()

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
      }).catch(() => {})
    }
  }, [isRunning, storageKey, userName])

  // ── Lap ───────────────────────────────────────────────────────────────────
  const lap = useCallback(() => {
    if (!isRunning || !startTimestampRef.current) return
    lastLocalActionRef.current = Date.now()
    const now = Date.now()
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
        }).catch(() => {})
      }

      return formatted
    })
  }, [isRunning, persistState, userName])

  // ── Real-Time Cross-Device Subscription (Laptop <-> Mobile) ───────────────
  useEffect(() => {
    if (!userName) return

    const unsubscribe = subscribeToLiveStatus(userName, (remote) => {
      if (!remote) return
      // Ignore echoes from this same device tab/session
      if (remote.deviceId && remote.deviceId === deviceIdRef.current) return

      // If user performed an action locally in the last 1500ms, ignore updates from before/around that action
      if (Date.now() - lastLocalActionRef.current < 1500) return

      const remoteRunning = Boolean(remote.isRunning)
      const remoteStart = remote.startedAtMs || remote.startTimestamp || null
      const remoteBase = Number(remote.baseElapsed) || 0
      const remoteLaps = Array.isArray(remote.laps) ? remote.laps : []

      if (remoteRunning && remoteStart) {
        // Remote device started timer or is actively running
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
        // Remote device paused or reset
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

        if (remoteBase === 0 && remoteLaps.length === 0) {
          if (storageKey) {
            try { localStorage.removeItem(storageKey) } catch {}
          }
        } else {
          persistState(false, null, remoteBase, remoteLaps)
        }
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [userName, storageKey, persistState, tick])

  // Clean up animation frame on unmount (does NOT stop the timer)
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
        // When document is hidden, keep React state synchronized as the background worker ticks
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          setElapsed(liveElapsed)
          setDisplayTime(liveDisplayTime)
        }
      },
    })
  }, [start, stop, lap])

  // Resync immediately when tab/app becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isRunning && startTimestampRef.current) {
        const now = Date.now()
        const current = baseElapsedRef.current + Math.max(0, now - startTimestampRef.current)
        setElapsed(current)
        setDisplayTime(formatTime(current))
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [isRunning, tick])

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
