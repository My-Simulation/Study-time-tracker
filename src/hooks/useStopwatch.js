/**
 * useStopwatch.js
 * Persistent, accurate stopwatch with localStorage persistence and Firestore live status sync.
 * - Survives page changes (navigating to Watch, History, Plan, etc.)
 * - Survives browser refreshes
 * - Synchronizes real-time live status to Firestore with exact epoch timestamps
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { formatTime } from '../utils/formatTime'
import { updateLiveStatus } from '../utils/firestoreHelpers'
import { backgroundTimer } from '../utils/backgroundTimer'

const STORAGE_PREFIX = 'stt_stopwatch_state_'

export function useStopwatch(userName) {
  const storageKey = userName ? `${STORAGE_PREFIX}${userName.toLowerCase()}` : null

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
        } else {
          startTimestampRef.current = null
          setElapsed(baseElapsedRef.current)
          setDisplayTime(formatTime(baseElapsedRef.current))
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
        }).catch(() => {})
      }, 10000)
    } else {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
  }, [isRunning, userName])

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (isRunning) return
    const now = Date.now()
    startTimestampRef.current = now
    // baseElapsed is whatever was accumulated previously
    setIsRunning(true)

    persistState(true, now, baseElapsedRef.current, laps)

    backgroundTimer.requestWakeLock()

    if (userName) {
      updateLiveStatus(userName, {
        isRunning: true,
        baseElapsed: baseElapsedRef.current,
        startTimestamp: now,
      }).catch(() => {})
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(tick)
  }, [isRunning, laps, persistState, tick, userName])

  // ── Stop (pause) ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!isRunning) return
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

    persistState(false, null, finalElapsed, laps)
    backgroundTimer.releaseWakeLock()

    if (userName) {
      updateLiveStatus(userName, {
        isRunning: false,
        baseElapsed: finalElapsed,
        startTimestamp: null,
      }).catch(() => {})
    }
  }, [isRunning, laps, persistState, userName])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (isRunning) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    baseElapsedRef.current = 0
    startTimestampRef.current = null
    setElapsed(0)
    setDisplayTime('0:00:00.00')
    setLaps([])
    setIsRunning(false)
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
      }).catch(() => {})
    }
  }, [isRunning, storageKey, userName])

  // ── Lap ───────────────────────────────────────────────────────────────────
  const lap = useCallback(() => {
    if (!isRunning || !startTimestampRef.current) return
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
      return formatted
    })
  }, [isRunning, persistState])

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
    })
  }, [start, stop, lap])

  useEffect(() => {
    backgroundTimer.update({ isRunning, displayTime })
  }, [isRunning, displayTime])

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
