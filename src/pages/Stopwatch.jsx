/**
 * Stopwatch.jsx
 * Main stopwatch page. Full-screen dark theme with tab bar,
 * large timer, lap table, and control buttons.
 */

import React, { useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStopwatch } from '../hooks/useStopwatch'
import StopwatchDisplay from '../components/StopwatchDisplay'
import LapTable from '../components/LapTable'
import SaveModal from '../components/SaveModal'
import Toast from '../components/Toast'

// ── Tab bar items (only "Stopwatch" is active) ──────────────────────────────
const TABS = ['World Clock', 'Alarm', 'Stopwatch', 'Timers']

export default function Stopwatch({ userName }) {
  const navigate = useNavigate()
  const { elapsed, isRunning, laps, displayTime, start, stop, reset, lap } =
    useStopwatch()

  const [showModal, setShowModal] = useState(false)
  const [toast, setToast] = useState({ visible: false, message: '' })
  const captureRef = useRef(null)

  const hasTime = elapsed > 0

  // ── Switch user ─────────────────────────────────────────────────────────
  const handleSwitchUser = () => {
    localStorage.removeItem('studyTrackerUser')
    navigate('/login', { replace: true })
  }

  // ── Save callback ────────────────────────────────────────────────────────
  const handleSaved = useCallback(
    (date, didReset) => {
      setShowModal(false)
      setToast({ visible: true, message: `Saved for ${date} ✅` })
      if (didReset) {
        reset()
      }
    },
    [reset]
  )

  const dismissToast = useCallback(() => {
    setToast({ visible: false, message: '' })
  }, [])

  // ── Total seconds for Firestore ──────────────────────────────────────────
  const totalSeconds = Math.floor(elapsed / 1000)

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#0d0d0d' }}
    >
      {/* ── Top bar: Switch User ── */}
      <div className="flex items-center justify-end px-4 pt-4 pb-0">
        <button
          onClick={handleSwitchUser}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors underline underline-offset-2"
        >
          Switch User
        </button>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex justify-center px-4 pt-3 pb-2">
        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          {TABS.map((tab) => {
            const isActive = tab === 'Stopwatch'
            return (
              <div
                key={tab}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all select-none ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-gray-500 cursor-default'
                }`}
              >
                {tab}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── History icon button ── */}
      <div className="flex justify-end px-5 pt-1">
        <button
          onClick={() => navigate('/history')}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-[#1a1a1a]"
          aria-label="View history"
          title="History"
        >
          <CalendarIcon />
        </button>
      </div>

      {/* ── Main stopwatch card ── */}
      <div className="flex-1 flex flex-col px-4 pb-8 max-w-lg mx-auto w-full">
        <div className="card flex flex-col flex-1 overflow-hidden mt-2">
          {/* Timer display + lap table (this ref is captured by html2canvas) */}
          <div ref={captureRef} className="bg-[#1a1a1a] rounded-2xl">
            <StopwatchDisplay displayTime={displayTime} />

            {/* Divider */}
            {laps.length > 0 && (
              <div className="border-t border-[#2a2a2a]" />
            )}

            {/* Lap table */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight: '260px' }}
            >
              <LapTable laps={laps} />
            </div>
          </div>

          {/* ── Buttons ── */}
          <div className="flex flex-col gap-2.5 p-4 pt-3">
            {/* Save button */}
            {hasTime && (
              <button
                onClick={() => setShowModal(true)}
                className="pill-btn w-full"
                style={{ background: '#8b5cf6', color: 'white' }}
              >
                Save
              </button>
            )}

            {/* Lap button — only when running */}
            {isRunning && (
              <button
                onClick={lap}
                className="pill-btn w-full"
                style={{ background: '#3b82f6', color: 'white' }}
              >
                Lap
              </button>
            )}

            {/* Reset + Start/Stop row */}
            <div className="flex gap-3">
              {/* Reset button */}
              <button
                onClick={reset}
                disabled={isRunning || elapsed === 0}
                className="pill-btn flex-1"
                style={{
                  background: '#2a2a2a',
                  color: isRunning || elapsed === 0 ? '#555' : 'white',
                  cursor:
                    isRunning || elapsed === 0 ? 'not-allowed' : 'pointer',
                }}
              >
                Reset
              </button>

              {/* Start / Stop button */}
              <button
                onClick={isRunning ? stop : start}
                className="pill-btn flex-1"
                style={{
                  background: isRunning ? '#ef4444' : '#22c55e',
                  color: isRunning ? 'white' : 'black',
                }}
              >
                {isRunning ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Save modal ── */}
      <SaveModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSaved={handleSaved}
        captureTargetRef={captureRef}
        displayTime={displayTime}
        totalSeconds={totalSeconds}
        laps={laps}
        userName={userName}
      />

      {/* ── Toast ── */}
      <Toast
        message={toast.message}
        visible={toast.visible}
        onDismiss={dismissToast}
      />
    </div>
  )
}

// Calendar SVG icon
function CalendarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
