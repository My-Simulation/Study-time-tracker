/**
 * Plan.jsx
 * Weekly study plan page.
 * User sets daily targets (hours + subjects) for each day of the week.
 * Data is saved to Firestore user doc under 'weeklyPlan'.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveWeeklyPlan, getWeeklyPlan } from '../utils/firestoreHelpers'

const DAYS = [
  { key: 'Mon', label: 'Monday' },
  { key: 'Tue', label: 'Tuesday' },
  { key: 'Wed', label: 'Wednesday' },
  { key: 'Thu', label: 'Thursday' },
  { key: 'Fri', label: 'Friday' },
  { key: 'Sat', label: 'Saturday' },
  { key: 'Sun', label: 'Sunday' },
]

const TODAY_KEY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]

const DEFAULT_PLAN = Object.fromEntries(
  DAYS.map(({ key }) => [key, { targetMinutes: 0, subjects: '' }])
)

export default function Plan({ userName }) {
  const navigate = useNavigate()
  const [plan, setPlan] = useState(DEFAULT_PLAN)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const existing = await getWeeklyPlan(userName)
      if (existing && Object.keys(existing).length > 0) {
        setPlan((prev) => ({ ...prev, ...existing }))
      }
    } catch (err) {
      console.error('Plan load error:', err)
    } finally {
      setLoading(false)
    }
  }, [userName])

  useEffect(() => { load() }, [load])

  const handleHoursChange = (dayKey, minutes) => {
    setPlan((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], targetMinutes: minutes },
    }))
    setSaved(false)
  }

  const handleSubjectsChange = (dayKey, subjects) => {
    setPlan((prev) => ({
      ...prev,
      [dayKey]: { ...prev[dayKey], subjects },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await saveWeeklyPlan(userName, plan)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save plan error:', err)
      alert('Failed to save. Check your connection.')
    } finally {
      setSaving(false)
    }
  }

  const totalWeeklyMinutes = Object.values(plan).reduce(
    (s, d) => s + (d.targetMinutes || 0), 0
  )

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d0d0d' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span><span>Back to Timer</span>
        </button>
      </div>

      {/* Header */}
      <div className="px-4 pb-4">
        <h1 className="text-xl font-bold text-white">📅 Weekly Study Plan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Set your daily targets — history will track if you hit them
        </p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col px-4 pb-24 max-w-lg mx-auto w-full gap-3">

          {/* Weekly total */}
          <div className="card px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-400">Weekly Total Target</span>
            <span className="font-mono font-bold text-purple-400 text-lg">
              {formatHoursLabel(totalWeeklyMinutes)}
            </span>
          </div>

          {/* Day cards */}
          {DAYS.map(({ key, label }) => {
            const d = plan[key] || { targetMinutes: 0, subjects: '' }
            const isToday = key === TODAY_KEY
            const hours = Math.floor(d.targetMinutes / 60)
            const mins = d.targetMinutes % 60
            const displayH = hours > 0 ? `${hours}h` : ''
            const displayM = mins > 0 ? `${mins}m` : ''
            const displayTime = displayH + (displayH && displayM ? ' ' : '') + displayM || '0h'

            return (
              <div
                key={key}
                className={`card p-4 flex flex-col gap-3 ${isToday ? 'border-purple-500/40' : ''}`}
                style={isToday ? { borderColor: '#8b5cf650', background: '#1a1040' } : {}}
              >
                {/* Day header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    {isToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                        Today
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-bold text-white text-base tabular-nums">
                    {displayTime}
                  </span>
                </div>

                {/* Hours slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0h</span>
                    <span>3h</span>
                    <span>6h</span>
                    <span>9h</span>
                    <span>12h</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={720}
                    step={30}
                    value={d.targetMinutes}
                    onChange={(e) => handleHoursChange(key, Number(e.target.value))}
                    className="w-full accent-purple-500"
                    style={{ accentColor: '#8b5cf6' }}
                  />
                </div>

                {/* Subjects input */}
                <input
                  type="text"
                  placeholder="Subjects / topics (e.g. Math, Physics)"
                  value={d.subjects}
                  onChange={(e) => handleSubjectsChange(key, e.target.value)}
                  className="w-full rounded-lg bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-3 py-2 text-sm outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Fixed save button */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-4 max-w-lg mx-auto w-full" style={{ background: 'linear-gradient(to top, #0d0d0d, transparent)' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="pill-btn w-full"
          style={{ background: saved ? '#22c55e' : '#8b5cf6', color: 'white', opacity: saving ? 0.7 : 1 }}
        >
          {saving ? 'Saving…' : saved ? '✓ Plan Saved!' : 'Save Weekly Plan'}
        </button>
      </div>
    </div>
  )
}

function formatHoursLabel(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0 && m === 0) return '0h'
  if (m === 0) return `${h}h`
  if (h === 0) return `${m}m`
  return `${h}h ${m}m`
}
