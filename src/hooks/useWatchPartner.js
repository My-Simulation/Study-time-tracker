/**
 * useWatchPartner.js
 * Real-time synchronization hook for watching a partner's live stopwatch.
 * - Millisecond-accurate live counting using startedAtMs + requestAnimationFrame
 * - Instant update on pause, reset, or resume
 */

import { useState, useEffect, useRef } from 'react'
import { subscribeToPartnerStatus } from '../utils/firestoreHelpers'
import { formatTime } from '../utils/formatTime'

export function useWatchPartner(partnerName) {
  const [status, setStatus] = useState(null)
  const [displayTime, setDisplayTime] = useState('0:00:00.00')
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const rafRef = useRef(null)

  // Subscribe to partner's live status in Firestore
  useEffect(() => {
    if (!partnerName) return
    setIsLoading(true)
    setNotFound(false)

    const unsub = subscribeToPartnerStatus(partnerName, (data) => {
      setIsLoading(false)
      if (!data) {
        setNotFound(true)
        setStatus(null)
        setIsLive(false)
        return
      }
      setStatus(data)
      setIsLive(Boolean(data.isRunning))
      setNotFound(false)
    })

    return () => unsub()
  }, [partnerName])

  // Real-time animation frame tick
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!status) {
      setDisplayTime('0:00:00.00')
      return
    }

    const baseElapsed = Number(status.baseElapsed) || 0
    const startMs =
      Number(status.startedAtMs) ||
      (status.startedAt?.seconds ? status.startedAt.seconds * 1000 : null)

    const tick = () => {
      let current = baseElapsed
      if (status.isRunning && startMs) {
        const diff = Date.now() - startMs
        current += Math.max(0, diff)
      }
      setDisplayTime(formatTime(current))

      if (status.isRunning && startMs) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    tick()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [status])

  // Human-readable last seen text
  const lastSeenText = (() => {
    if (!status) return ''
    const ts =
      Number(status.updatedAtMs) ||
      (status.updatedAt?.seconds ? status.updatedAt.seconds * 1000 : null)
    if (!ts) return ''
    const diffSec = Math.floor((Date.now() - ts) / 1000)
    if (diffSec < 45) return 'just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    return `${Math.floor(diffSec / 3600)}h ago`
  })()

  return {
    status,
    displayTime,
    isLoading,
    notFound,
    isLive,
    lastSeenText,
  }
}
