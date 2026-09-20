/**
 * AITimeTableModal.jsx
 * Intelligent AI Daily Time Table Generator Modal.
 * Generates actionable Morning/Afternoon/Evening/Night slots and injects into Day Planner.
 */

import React, { useState } from 'react'
import { generateAITimeTable, getRemainingDailyQuota } from '../utils/aiService'

const ROUTINE_OPTIONS = [
  { id: 'dedicated', label: 'Dedicated Aspirant / Full-Time', icon: '🎯', desc: 'Whole day available for self study' },
  { id: 'job', label: 'Working Professional / Job', icon: '💼', desc: 'Study before/after 9-5 work' },
  { id: 'college', label: 'College / University', icon: '🎓', desc: 'Classes during day, study evening/night' },
  { id: 'coaching', label: 'Coaching / Tuition Batches', icon: '🏫', desc: 'Scheduled lecture batches + self study' },
]

export default function AITimeTableModal({ isOpen, onClose, userContext, onApply }) {
  const [step, setStep] = useState(1) // 1: Inputs, 2: Preview
  const [routineType, setRoutineType] = useState('dedicated')
  const [examTarget, setExamTarget] = useState(userContext?.examGoal?.name || '')
  const [occupiedHours, setOccupiedHours] = useState('09:30 AM - 05:30 PM')
  const [targetStudyHours, setTargetStudyHours] = useState(userContext?.todayTargetHours || 6)
  const [wakeTime, setWakeTime] = useState('06:00 AM')
  const [sleepTime, setSleepTime] = useState('11:00 PM')
  const [notes, setNotes] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedSlots, setGeneratedSlots] = useState([])

  if (!isOpen) return null

  const remainingQuota = getRemainingDailyQuota()

  const handleGenerate = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError('')

    try {
      const slots = await generateAITimeTable(userContext, {
        examTarget,
        routineType,
        occupiedHours: routineType !== 'dedicated' ? occupiedHours : '',
        targetStudyHours: Number(targetStudyHours),
        wakeTime,
        sleepTime,
        notes,
      })

      if (!slots || slots.length === 0) {
        throw new Error('Could not generate slots. Please try again.')
      }

      setGeneratedSlots(slots)
      setStep(2)
    } catch (err) {
      console.error('AI Timetable generation error:', err)
      setError(err?.message || 'Failed to generate timetable. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleApplyToPlan = () => {
    if (generatedSlots.length > 0 && typeof onApply === 'function') {
      onApply(generatedSlots, Number(targetStudyHours))
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#131316] border border-[#2a2a35] rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col gap-5 max-h-[92vh] overflow-y-auto animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#24242e] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-xl shadow-lg">
              ✨
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                AI Time Table Generator
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Gemini 1.5
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Customized daily schedule based on your routine & exam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-500 font-mono hidden sm:inline">
              Quota: {remainingQuota}/15 left
            </span>
            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>


        {/* Step 1: Input Form */}
        {step === 1 && (
          <form onSubmit={handleGenerate} className="flex flex-col gap-4">
            {/* Target Exam */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                1. Target Exam / Goal
              </label>
              <input
                type="text"
                value={examTarget}
                onChange={(e) => setExamTarget(e.target.value)}
                placeholder="e.g. UPSC CSE 2026, SSC CGL, JEE Main, NEET, Semester Exams..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181f] border border-[#2b2b38] text-white text-xs sm:text-sm placeholder-gray-500 outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Routine Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                2. Your Daily Routine Type
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROUTINE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRoutineType(opt.id)}
                    className={`p-3 rounded-2xl border text-left flex items-start gap-3 transition-all ${
                      routineType === opt.id
                        ? 'bg-purple-600/15 border-purple-500 shadow-md ring-1 ring-purple-500/40'
                        : 'bg-[#18181f] border-[#292936] hover:border-[#3a3a4c]'
                    }`}
                  >
                    <span className="text-xl flex-shrink-0">{opt.icon}</span>
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${routineType === opt.id ? 'text-purple-300' : 'text-gray-200'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* If routine is job, college or coaching, ask for occupied timings */}
            {routineType !== 'dedicated' && (
              <div className="flex flex-col gap-1.5 p-3 rounded-2xl bg-indigo-950/20 border border-indigo-900/30">
                <label className="text-xs font-bold text-indigo-300">
                  Occupied / Busy Hours (Job / College Timings):
                </label>
                <input
                  type="text"
                  value={occupiedHours}
                  onChange={(e) => setOccupiedHours(e.target.value)}
                  placeholder="e.g. 09:30 AM - 05:30 PM"
                  className="w-full px-3 py-2 rounded-xl bg-[#14141a] border border-[#2b2b38] text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Target Study Hours & Wake/Sleep Times */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300">Desired Study Hours</label>
                <select
                  value={targetStudyHours}
                  onChange={(e) => setTargetStudyHours(Number(e.target.value))}
                  className="px-3 py-2.5 rounded-xl bg-[#18181f] border border-[#2b2b38] text-purple-300 font-bold text-xs outline-none cursor-pointer"
                >
                  {[3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <option key={h} value={h} className="bg-[#18181f] text-white">
                      {h} Hours / Day
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300">Wake Up Time</label>
                <input
                  type="text"
                  value={wakeTime}
                  onChange={(e) => setWakeTime(e.target.value)}
                  placeholder="06:00 AM"
                  className="px-3 py-2 rounded-xl bg-[#18181f] border border-[#2b2b38] text-white text-xs outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-gray-300">Sleep Time</label>
                <input
                  type="text"
                  value={sleepTime}
                  onChange={(e) => setSleepTime(e.target.value)}
                  placeholder="11:00 PM"
                  className="px-3 py-2 rounded-xl bg-[#18181f] border border-[#2b2b38] text-white text-xs outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {/* Preferences / Custom Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-gray-300">
                Any specific focus or instructions? (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Focus more on Maths in morning, keep 45 min revision at night..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#18181f] border border-[#2b2b38] text-white text-xs outline-none focus:border-purple-500"
              />
            </div>

            {error && (
              <div className="text-rose-400 text-xs bg-rose-950/30 border border-rose-900/40 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-[#333] text-gray-400 hover:text-white text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="pill-btn px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'AI is crafting your timetable… ✨' : '⚡ Generate Time Table'}
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Preview Generated Schedule */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between bg-[#181822] p-3 rounded-2xl border border-purple-500/20">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎉</span>
                <div>
                  <p className="text-xs font-bold text-white">Your AI-Optimized Time Table is Ready!</p>
                  <p className="text-[11px] text-gray-400">
                    {generatedSlots.length} structured slots totaling ~{targetStudyHours} hours of focused study
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs text-purple-400 hover:text-purple-300 underline font-semibold"
              >
                ← Adjust Inputs
              </button>
            </div>

            {/* Slot List Preview */}
            <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
              {generatedSlots.map((s, idx) => {
                const blockColors = {
                  Morning: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
                  Afternoon: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
                  Evening: 'border-indigo-500/30 bg-indigo-500/5 text-indigo-300',
                  Night: 'border-purple-500/30 bg-purple-500/5 text-purple-300',
                }
                const bStyle = blockColors[s.block] || 'border-gray-700 bg-gray-900/5 text-gray-300'

                return (
                  <div
                    key={s.id || idx}
                    className="p-3 rounded-2xl border border-[#2b2b35] bg-[#16161a] flex items-center justify-between gap-3 hover:border-[#3e3e4f] transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border ${bStyle} whitespace-nowrap`}>
                        {s.block || 'Slot'}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{s.subject}</span>
                          <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.2 rounded border border-purple-500/20">
                            {s.slotType}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {s.topic ? `${s.topic} • ` : ''}{s.plan}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className="font-mono text-xs text-purple-300 font-bold bg-[#1e1e28] px-2.5 py-1 rounded-xl border border-[#2e2e3f]">
                        {s.time}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t border-[#24242e] pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-[#333] text-gray-400 hover:text-white text-xs font-semibold"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleApplyToPlan}
                className="pill-btn px-6 py-2.5 text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg cursor-pointer"
              >
                🚀 Apply Directly to Day Planner
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
