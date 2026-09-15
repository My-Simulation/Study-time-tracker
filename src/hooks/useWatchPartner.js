/**
 * useWatchPartner.js
 * Subscribes to a partner's live status from Firestore.
 * Returns their current elapsed ms (calculated locally from startedAt).
 */

import { useState, useEffect, useRef } from 'react'
import { subscribeToPartnerStatus } from '../utils/firestoreHelpers'
import { formatTime } from '../utils/formatTime'

export function useWatchPartner(partnerName) {
  const [status, setStatus] = useState(null)         // raw Firestore doc
  const [displayTime, setDisplayTime] = useState('0:00:00.00')
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const tickRef = useRef(null)

  // Subscribe to Firestore real-time updates
  useEffect(() => {
    if (!partnerName) return
    setIsLoading(true)
    setNotFound(false)

    const unsub = subscribeToPartnerStatus(partnerName, (data) => {
      setIsLoading(false)
      if (!data) {
        setNotFound(true)
        return
      }
      setStatus(data)
      setNotFound(false)
    })

    return () => unsub()
  }, [partnerName])

  // Local tick to update displayed time smoothly
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current)

    if (!status) return

    const tick = () => {
      let current = status.baseElapsed || 0
      if (status.isRunning && status.startedAt) {
        const startMs =
          status.startedAt.seconds * 1000 +
          Math.floor(status.startedAt.nanoseconds / 1e6)
        current = status.baseElapsed + (Date.now() - startMs)
        if (current < 0) current = status.baseElapsed
      }
      setDisplayTime(formatTime(current))
    }

    tick() // immediate
    tickRef.current = setInterval(tick, 100)

    return () => clearInterval(tickRef.current)
  }, [status])

  // Time since last update (for "last studied X ago" display)
  const lastSeenText = (() => {
    if (!status?.updatedAt?.seconds) return ''
    const diffSec = Math.floor(Date.now() / 1000 - status.updatedAt.seconds)
    if (diffSec < 60) return 'just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    return `${Math.floor(diffSec / 3600)}h ago`
  })()

  return {
    status,
    displayTime,
    isLoading,
    notFound,
    isLive: status?.isRunning === true,
    lastSeenText,
  }
}
