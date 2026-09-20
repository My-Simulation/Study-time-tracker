/**
 * SaveModal.jsx
 * Modal for saving a study session.
 * Enhanced with:
 *  - Focus Quality Rating (1-5 stars)
 *  - Output Count & Unit (e.g. 20 questions, 15 pages)
 *  - Key Takeaway note
 *  - Reflection Tag (Deep Focus, Distraction, Fatigue, etc.)
 *  - Subject / Topic tagging
 */

import React, { useState, useRef, useEffect } from 'react'
import { captureAndUploadScreenshot, saveSession, getSyllabus, getUserSettings, isRestDay } from '../utils/firestoreHelpers'
import { todayString } from '../utils/formatTime'

const REFLECTION_TAGS = [
  '🔥 Deep Focus',
  '⚡ Normal Study',
  '📱 Phone Distraction',
  '🥱 Fatigue / Low Energy',
  '🏫 College / Work Pressure',
  '☕ Unplanned Break',
]

const OUTPUT_UNITS = ['questions', 'pages', 'problems', 'modules', 'cards']

export default function SaveModal({
  isOpen,
  onClose,
  onSaved,          // callback(date, didReset)
  captureTargetRef, // ref to the DOM element to screenshot
  displayTime,
  totalSeconds,
  laps,
  userName,
  initialSubject = '',
  initialTopic = '',
}) {
  const [selectedDate, setSelectedDate] = useState(todayString())
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savingStep, setSavingStep] = useState('') // 'screenshot' | 'firestore' | ''
  const overlayRef = useRef(null)

  // Outcome & Reflection states
  const [focusScore, setFocusScore] = useState(5)
  const [outputCount, setOutputCount] = useState('')
  const [outputUnit, setOutputUnit] = useState('questions')
  const [notes, setNotes] = useState('')
  const [reflectionTag, setReflectionTag] = useState('')
  const [subject, setSubject] = useState(initialSubject)
  const [topic, setTopic] = useState(initialTopic)
  const [syllabus, setSyllabus] = useState([])
  const [showMoreDetails, setShowMoreDetails] = useState(false)
  const [settings, setSettings] = useState(null)

  const isSelectedDateRest = isRestDay(selectedDate, settings)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(todayString())
      setError(null)
      setIsSaving(false)
      setSavingStep('')
      setFocusScore(5)
      setOutputCount('')
      setNotes('')
      setReflectionTag('')
      setSubject(initialSubject || '')
      setTopic(initialTopic || '')

      if (userName) {
        getUserSettings(userName).then((st) => setSettings(st))
        getSyllabus(userName).then((data) => {
          if (Array.isArray(data)) setSyllabus(data)
        })
      }
    }
  }, [isOpen, userName, initialSubject, initialTopic])

  // Close on overlay click
  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current && !isSaving) {
      onClose()
    }
  }

  const handleSave = async (shouldReset) => {
    if (isSaving) return
    if (isSelectedDateRest) {
      setError('This date is marked as a Rest Day. Sessions cannot be logged on rest days.')
      return
    }
    setIsSaving(true)
    setError(null)
    setSavingStep('screenshot')

    try {
      let screenshotUrl = ''

      // 1. Capture + upload screenshot (times out after 6s)
      if (captureTargetRef?.current) {
        screenshotUrl = await captureAndUploadScreenshot(
          captureTargetRef.current,
          userName,
          selectedDate
        )
      }

      // 2. Save to Firestore
      setSavingStep('firestore')
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
        focusScore: Number(focusScore) || 0,
        outputCount: outputCount !== '' ? Number(outputCount) : null,
        outputUnit: outputUnit || '',
        notes: notes.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        reflectionTag: reflectionTag || '',
      })

      // 3. Done — notify parent
      onSaved(selectedDate, shouldReset)
    } catch (err) {
      console.error('Save error:', err)
      setError(
        err?.code === 'permission-denied'
          ? 'Permission denied. Make sure Firestore is in Test Mode in Firebase Console.'
          : 'Failed to save. Check your internet connection and try again.'
      )
    } finally {
      setIsSaving(false)
      setSavingStep('')
    }
  }

  if (!isOpen) return null

  const activeSubjectObj = syllabus.find((s) => s.name === subject)
  const availableTopics = activeSubjectObj?.topics || []

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)' }}
    >
      {/* Modal card */}
      <div
        className="card w-full max-w-sm p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto my-auto"
        style={{ animation: 'scaleIn 180ms ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Save Study Session</h2>
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
        <div className="flex items-center gap-3 rounded-xl bg-[#111] border border-[#2a2a2a] px-3.5 py-2.5">
          <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Total Time</div>
          <div className="font-mono tabular-nums text-white font-bold ml-auto text-base">
            {displayTime}
          </div>
        </div>

        {/* Date picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-400 font-medium">Session Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={todayString()}
            disabled={isSaving}
            className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-xs outline-none focus:border-purple-500 transition-colors disabled:opacity-50"
          />
          {isSelectedDateRest && (
            <p className="text-[11px] font-semibold text-rose-400 mt-1 flex items-center gap-1">
              <span>⚠️</span>
              <span>This date is marked as a Rest Day. Sessions cannot be logged on rest days.</span>
            </p>
          )}
        </div>

        {/* Focus Quality Rating (1-5 Stars) */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 font-medium">Focus Rating</label>
            <span className="text-xs text-amber-400 font-medium">
              {focusScore === 5 ? '⭐⭐⭐⭐⭐ Deep Flow' : focusScore === 4 ? '⭐⭐⭐⭐ Good' : focusScore === 3 ? '⭐⭐⭐ Average' : focusScore === 2 ? '⭐⭐ Distracted' : '⭐ Unfocused'}
            </span>
          </div>
          <div className="flex items-center gap-2 py-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFocusScore(star)}
                className="text-xl transition-transform hover:scale-125 focus:outline-none"
              >
                {star <= focusScore ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        {/* Toggle More Details (Outcome & Topic) */}
        <button
          type="button"
          onClick={() => setShowMoreDetails(!showMoreDetails)}
          className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#141414] border border-[#242424] text-xs text-gray-400 hover:text-white transition-colors"
        >
          <span>🎯 Add Subject, Output & Reflection Tags</span>
          <span>{showMoreDetails ? '▲' : '▼'}</span>
        </button>

        {showMoreDetails && (
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-[#121212] border border-[#222]">
            {/* Subject & Topic Selectors */}
            {syllabus.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500">Subject</label>
                  <select
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value)
                      setTopic('')
                    }}
                    className="w-full rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2 py-1.5 outline-none focus:border-purple-500"
                  >
                    <option value="">Select subject</option>
                    {syllabus.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-gray-500">Topic</label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={!subject}
                    className="w-full rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2 py-1.5 outline-none focus:border-purple-500 disabled:opacity-50"
                  >
                    <option value="">Select topic</option>
                    {availableTopics.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Subject (e.g. Physics)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2.5 py-1.5 outline-none focus:border-purple-500"
                />
                <input
                  type="text"
                  placeholder="Topic (e.g. Thermodynamics)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="flex-1 rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2.5 py-1.5 outline-none focus:border-purple-500"
                />
              </div>
            )}

            {/* Output Count & Unit */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">Output Count</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 25"
                  value={outputCount}
                  onChange={(e) => setOutputCount(e.target.value)}
                  className="w-24 rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2.5 py-1.5 outline-none focus:border-purple-500"
                />
                <select
                  value={outputUnit}
                  onChange={(e) => setOutputUnit(e.target.value)}
                  className="flex-1 rounded-lg bg-[#181818] border border-[#2a2a2a] text-white text-xs px-2 py-1.5 outline-none focus:border-purple-500"
                >
                  {OUTPUT_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reflection Tag */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-gray-500">Reflection Reason Tag</label>
              <div className="flex flex-wrap gap-1.5">
                {REFLECTION_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setReflectionTag(reflectionTag === tag ? '' : tag)}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-all ${
                      reflectionTag === tag
                        ? 'bg-purple-600/30 text-purple-300 border-purple-500'
                        : 'bg-[#181818] text-gray-400 border-[#2a2a2a] hover:text-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Accomplishment note */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">Key Accomplishment / Note</label>
              <input
                type="text"
                placeholder="What did you finish in this session?"
                maxLength={100}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg bg-[#181818] border border-[#2a2a2a] text-white placeholder-gray-600 text-xs px-2.5 py-1.5 outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving || !selectedDate || isSelectedDateRest}
            className="pill-btn w-full h-11 text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
            style={{
              background: '#8b5cf6',
              color: 'white',
              opacity: isSaving || !selectedDate || isSelectedDateRest ? 0.6 : 1,
            }}
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <Spinner />
                <span>{savingStep === 'screenshot' ? 'Capturing…' : 'Saving…'}</span>
              </span>
            ) : (
              'Save Session'
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="pill-btn w-full h-9 text-xs font-medium text-gray-400 hover:text-white transition-colors"
            style={{ background: 'transparent' }}
          >
            Cancel
          </button>
        </div>
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
