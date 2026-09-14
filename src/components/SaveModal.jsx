/**
 * SaveModal.jsx
 * Modal for saving a study session.
 * Handles: date selection, html2canvas capture, Firebase upload, Firestore write.
 */

import React, { useState, useRef, useEffect } from 'react'
import { captureAndUploadScreenshot, saveSession } from '../utils/firestoreHelpers'
import { todayString } from '../utils/formatTime'

export default function SaveModal({
  isOpen,
  onClose,
  onSaved,          // callback(date, didReset)
  captureTargetRef, // ref to the DOM element to screenshot
  displayTime,
  totalSeconds,
  laps,
  userName,
}) {
  const [selectedDate, setSelectedDate] = useState(todayString())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const overlayRef = useRef(null)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(todayString())
      setError(null)
      setIsSaving(false)
    }
  }, [isOpen])

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !isSaving) {
      onClose()
    }
  }

  const handleSave = async (shouldReset) => {
    if (isSaving) return
    setIsSaving(true)
    setError(null)

    try {
      let screenshotUrl = ''

      // 1. Capture screenshot
      if (captureTargetRef?.current) {
        try {
          screenshotUrl = await captureAndUploadScreenshot(
            captureTargetRef.current,
            userName,
            selectedDate
          )
        } catch (screenshotErr) {
          console.warn('Screenshot failed, saving without image:', screenshotErr)
          screenshotUrl = ''
        }
      }

      // 2 & 3. Save to Firestore
      await saveSession({
        userName,
        date: selectedDate,
        totalTime: displayTime,
        totalSeconds,
        laps: laps.map(({ lapNo, split, total, splitMs, totalMs }) => ({
          lapNo,
          split,
          total,
          splitMs: splitMs || 0,
          totalMs: totalMs || 0,
        })),
        screenshotUrl,
      })

      // 4. Notify parent
      onSaved(selectedDate, shouldReset)
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save. Check your Firebase config and try again.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      {/* Modal card */}
      <div
        className="card w-full max-w-sm p-6 flex flex-col gap-5"
        style={{ animation: 'scaleIn 200ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Save Today's Session</h2>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-gray-500 hover:text-gray-300 transition-colors text-xl leading-none disabled:opacity-40"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Session preview */}
        <div className="flex items-center gap-3 rounded-xl bg-[#111] border border-[#2a2a2a] px-4 py-3">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total</div>
          <div className="font-mono tabular-nums text-white font-semibold ml-auto">
            {displayTime}
          </div>
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-400 font-medium">Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={todayString()}
            disabled={isSaving}
            className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-4 py-3 text-sm outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || !selectedDate}
            className="pill-btn w-full"
            style={{
              background: '#8b5cf6',
              color: 'white',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Spinner /> Saving…
              </span>
            ) : (
              'Save & Continue'
            )}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving || !selectedDate}
            className="pill-btn w-full"
            style={{
              background: '#2a2a2a',
              color: 'white',
              opacity: isSaving ? 0.6 : 1,
            }}
          >
            Save & Reset
          </button>
        </div>

        <p className="text-xs text-gray-600 text-center">
          "Save & Continue" keeps the timer running as-is.
        </p>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
