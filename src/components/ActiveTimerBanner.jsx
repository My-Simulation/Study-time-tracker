/**
 * ActiveTimerBanner.jsx
 * Shows a sticky top banner when the user's timer is currently running,
 * visible when they navigate to /history, /watch, /plan, etc.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { formatTime } from '../utils/formatTime'
import { getSession } from '../utils/auth'

const STORAGE_PREFIX = 'stt_stopwatch_state_'

export default function ActiveTimerBanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeState, setActiveState] = useState(null)
  const [displayTime, setDisplayTime] = useState('')
  const rafRef = useRef(null)

  // Don't show banner on the main stopwatch page or auth pages
  const isExcludedRoute =
    location.pathname === '/' ||
    location.pathname === '/welcome' ||
    location.pathname === '/signin' ||
    location.pathname === '/signup'

  useEffect(() => {
    if (isExcludedRoute) {
      setActiveState(null)
      return
    }

    const session = getSession()
    if (!session?.username) {
      setActiveState(null)
      return
    }

    const storageKey = `${STORAGE_PREFIX}${session.username.toLowerCase()}`

    const checkTimer = () => {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) {
          setActiveState(null)
          return
        }
        const saved = JSON.parse(raw)
        if (saved.isRunning && saved.startTimestamp) {
          setActiveState(saved)
        } else {
          setActiveState(null)
        }
      } catch {
        setActiveState(null)
      }
    }

    checkTimer()
    // Periodic check in case storage changes
    const interval = setInterval(checkTimer, 1000)
    return () => clearInterval(interval)
  }, [location.pathname, isExcludedRoute])

  // Real-time tick
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!activeState?.isRunning || !activeState?.startTimestamp) return

    const baseElapsed = Number(activeState.baseElapsed) || 0
    const startMs = Number(activeState.startTimestamp)

    const tick = () => {
      const current = baseElapsed + Math.max(0, Date.now() - startMs)
      setDisplayTime(formatTime(current))
      rafRef.current = requestAnimationFrame(tick)
    }

    tick()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [activeState])

  if (isExcludedRoute || !activeState) return null

  return (
    <div
      onClick={() => navigate('/')}
      className="sticky top-0 z-50 w-full bg-[#16271a] border-b border-green-500/30 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[#1a3320] transition-colors"
      style={{ animation: 'slideDown 200ms ease-out' }}
      title="Click to return to your stopwatch"
    >
      <div className="flex items-center gap-2 max-w-lg mx-auto w-full justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-300 font-medium">Your timer is running</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-green-400 tabular-nums">
            {displayTime}
          </span>
          <span className="text-xs bg-green-500/20 text-green-300 border border-green-500/40 rounded-full px-2 py-0.5 font-medium hover:bg-green-500/30">
            Open Timer →
          </span>
        </div>
      </div>
    </div>
  )
}
