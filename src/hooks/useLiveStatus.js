/**
 * useLiveStatus.js
 * Writes the user's live timer status to Firestore so partners can watch.
 * Updates when isRunning changes, and every 30s while running.
 */

import { useEffect, useRef } from 'react'
import { updateLiveStatus } from '../utils/firestoreHelpers'

export function useLiveStatus(userName, isRunning, elapsed) {
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!userName) return

    // Write status whenever isRunning or elapsed changes at start/stop
    const write = () => {
      updateLiveStatus(userName, { isRunning, baseElapsed: elapsed }).catch(() => {})
    }

    write()

    // While running, refresh every 30s so the watcher knows we're still alive
    if (isRunning) {
      intervalRef.current = setInterval(write, 30000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isRunning, userName]) // eslint-disable-line react-hooks/exhaustive-deps

  // On unmount, write stopped status
  useEffect(() => {
    return () => {
      if (userName) {
        updateLiveStatus(userName, { isRunning: false, baseElapsed: elapsed }).catch(() => {})
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}
