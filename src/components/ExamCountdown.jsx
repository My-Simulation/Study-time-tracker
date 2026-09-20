/**
 * ExamCountdown.jsx
 * Exam D-Day Countdown & Target Hours Progress Widget.
 * Shows days remaining until exam + target study hours meter.
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { saveExamGoal, getExamGoal } from '../utils/firestoreHelpers'
import { formatHoursMinutes } from '../utils/formatTime'

export default function ExamCountdown({ userName, totalStudiedSeconds = 0 }) {
  const [goal, setGoal] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [examName, setExamName] = useState('')
  const [examDate, setExamDate] = useState('')
  const [targetHours, setTargetHours] = useState(100)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!userName) return
    getExamGoal(userName).then((g) => {
      if (g) {
        setGoal(g)
        setExamName(g.name || '')
        setExamDate(g.date || '')
        setTargetHours(g.targetHours || 100)
      }
    })
  }, [userName])

  // Close modal on Escape key
  useEffect(() => {
    if (!isEditing) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsEditing(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isEditing])

  const handleSave = async (e) => {
    e?.preventDefault()
    if (!examName.trim() || !examDate) return
    const newGoal = {
      name: examName.trim(),
      date: examDate,
      targetHours: Number(targetHours) || 100,
    }
    setGoal(newGoal)
    setIsEditing(false)
    await saveExamGoal(userName, newGoal)
  }

  // Calculate days remaining
  const daysLeft = (() => {
    if (!goal?.date) return null
    const target = new Date(goal.date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    target.setHours(0, 0, 0, 0)
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24))
    return diff
  })()

  // Target hours progress
  const targetSec = (goal?.targetHours || 100) * 3600
  const progressPct = Math.min(100, Math.round((totalStudiedSeconds / targetSec) * 100))

  const renderModal = () => {
    if (!isEditing || typeof document === 'undefined') return null

    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
        onClick={() => setIsEditing(false)}
      >
        <div
          className="bg-[#18181f] border border-[#2e2e3e] rounded-2xl w-full max-w-sm p-5 flex flex-col gap-4 animate-scaleIn max-h-[90vh] overflow-y-auto shadow-2xl relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header with explicit Cross button */}
          <div className="flex items-center justify-between pb-2 border-b border-[#2a2a38]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>🎯</span>
              <span>Set Exam Target & Countdown</span>
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsEditing(false)
              }}
              className="w-8 h-8 rounded-full bg-[#252533] hover:bg-[#343447] text-gray-300 hover:text-white flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
              aria-label="Close modal"
              title="Close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Exam / Milestone Name</label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. JEE Advanced, Finals, UPSC"
                required
                autoFocus
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Exam Date</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                required
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Total Study Target (Hours)</label>
              <input
                type="number"
                min="1"
                max="10000"
                value={targetHours}
                onChange={(e) => setTargetHours(e.target.value)}
                required
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-sm outline-none focus:border-purple-500"
              />
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsEditing(false)
                }}
                className="pill-btn flex-1 h-10 text-xs cursor-pointer"
                style={{ background: '#2a2a2a', color: 'white' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="pill-btn flex-1 h-10 text-xs cursor-pointer"
                style={{ background: '#8b5cf6', color: 'white' }}
              >
                Save Goal
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
  }

  // If no goal set yet
  if (!goal) {
    return (
      <>
        <div className="card p-3 flex items-center justify-between border-dashed border-[#333] hover:border-purple-500/50 transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <div>
              <p className="text-xs font-semibold text-gray-300">Set Exam D-Day Countdown</p>
              <p className="text-[10px] text-gray-500">Track days left & total target study hours</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all cursor-pointer"
          >
            + Set Goal
          </button>
        </div>
        {renderModal()}
      </>
    )
  }

  // Active goal widget card
  return (
    <>
      <div className="card p-3.5 flex flex-col gap-2.5 relative">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">🎯</span>
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              {goal?.name || 'Target Exam'}
            </span>
            {daysLeft !== null && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  daysLeft > 14
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    : daysLeft > 3
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse'
                }`}
              >
                {daysLeft > 0 ? `${daysLeft} Days Left` : daysLeft === 0 ? 'Exam is Today!' : 'Exam Passed'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors px-1 cursor-pointer"
              title="Edit Exam Goal"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              className="text-gray-500 hover:text-gray-300 transition-colors text-xs px-1 cursor-pointer"
            >
              {collapsed ? '▼' : '▲'}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 text-[11px]">
                Target Hours: {formatHoursMinutes(totalStudiedSeconds)} / {goal?.targetHours || 100}h
              </span>
              <span className="font-mono font-bold text-purple-400 text-xs">{progressPct}%</span>
            </div>
            <div className="relative h-1.5 rounded-full bg-[#2a2a2a] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progressPct}%`,
                  background:
                    progressPct >= 100
                      ? '#22c55e'
                      : 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal Portal */}
      {renderModal()}
    </>
  )
}
