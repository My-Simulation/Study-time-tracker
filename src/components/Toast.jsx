/**
 * Toast.jsx
 * Bottom-center toast notification that auto-dismisses.
 */

import React, { useEffect, useState } from 'react'

export default function Toast({ message, visible, onDismiss }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (visible) {
      setShow(true)
      const timer = setTimeout(() => {
        setShow(false)
        setTimeout(onDismiss, 300) // wait for fade-out before clearing
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [visible, onDismiss])

  if (!visible && !show) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 pointer-events-none"
      style={{ transform: 'translateX(-50%)' }}
    >
      <div
        className="flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium text-white shadow-2xl"
        style={{
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          transition: 'opacity 300ms ease, transform 300ms ease',
          opacity: show ? 1 : 0,
          transform: show ? 'translateY(0)' : 'translateY(12px)',
        }}
      >
        <span className="h-2 w-2 rounded-full bg-green-400 inline-block flex-shrink-0" />
        {message}
      </div>
    </div>
  )
}
