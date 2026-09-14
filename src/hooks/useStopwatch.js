/**
 * useStopwatch.js
 * Custom hook encapsulating all stopwatch logic.
 * Uses Date.now() timestamps + requestAnimationFrame for accuracy.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { formatTime } from '../utils/formatTime'

/**
 * @typedef {Object} Lap
 * @property {number} lapNo
 * @property {string} split - Formatted split time
 * @property {string} total - Formatted total time
 * @property {number} splitMs - Split in milliseconds (for color comparison)
 */

/**
 * @returns {{
 *   elapsed: number,
 *   isRunning: boolean,
 *   laps: Lap[],
 *   displayTime: string,
 *   start: function,
 *   stop: function,
 *   reset: function,
 *   lap: function,
 * }}
 */
export function useStopwatch() {
  // Total elapsed ms when last stopped/started
  const [elapsed, setElapsed] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [laps, setLaps] = useState([])
  const [displayTime, setDisplayTime] = useState('0:00:00.00')

  // Refs for animation loop
  const rafRef = useRef(null)
  const startTimestampRef = useRef(null) // Date.now() when timer was (re)started
  const baseElapsedRef = useRef(0)       // Elapsed ms already accumulated before this run

  // ── Tick function (called every animation frame) ──────────────────────────
  const tick = useCallback(() => {
    const now = Date.now()
    const current = baseElapsedRef.current + (now - startTimestampRef.current)
    setElapsed(current)
    setDisplayTime(formatTime(current))
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Start ─────────────────────────────────────────────────────────────────
  const start = useCallback(() => {
    if (isRunning) return
    startTimestampRef.current = Date.now()
    // baseElapsed is whatever was accumulated before (0 if fresh, or paused value)
    baseElapsedRef.current = elapsed
    setIsRunning(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [isRunning, elapsed, tick])

  // ── Stop (pause) ──────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    if (!isRunning) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const now = Date.now()
    const finalElapsed = baseElapsedRef.current + (now - startTimestampRef.current)
    baseElapsedRef.current = finalElapsed
    setElapsed(finalElapsed)
    setDisplayTime(formatTime(finalElapsed))
    setIsRunning(false)
  }, [isRunning])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (isRunning) return // Guard: reset only when stopped
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    baseElapsedRef.current = 0
    setElapsed(0)
    setDisplayTime('0:00:00.00')
    setLaps([])
  }, [isRunning])

  // ── Lap ───────────────────────────────────────────────────────────────────
  const lap = useCallback(() => {
    if (!isRunning) return
    const now = Date.now()
    const currentTotal = baseElapsedRef.current + (now - startTimestampRef.current)

    setLaps((prev) => {
      // Split = current total minus most recent lap's total.
      // Laps stored newest-first, so prev[0] is the most recent lap.
      const lastLapTotalMs = prev.length > 0 ? prev[0].totalMs : 0
      const splitMs = currentTotal - lastLapTotalMs

      const newLap = {
        lapNo: prev.length + 1,
        split: formatTime(splitMs),
        total: formatTime(currentTotal),
        splitMs,
        totalMs: currentTotal,
      }

      // Insert new lap at TOP (newest first)
      const updatedLaps = [newLap, ...prev]

      // Recompute color flags: find min and max splitMs
      const splitValues = updatedLaps.map((l) => l.splitMs)
      const minSplit = Math.min(...splitValues)
      const maxSplit = Math.max(...splitValues)

      return updatedLaps.map((l) => ({
        ...l,
        // Only color-code if there are at least 2 laps (need contrast)
        color:
          updatedLaps.length < 2
            ? 'normal'
            : l.splitMs === minSplit
            ? 'green'
            : l.splitMs === maxSplit
            ? 'red'
            : 'normal',
      }))
    })
  }, [isRunning])

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
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
  }
}
