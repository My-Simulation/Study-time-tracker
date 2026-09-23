/**
 * DailyMissions.jsx
 * Daily Mission / Action Items Micro-Goal Checklist.
 * Lets students set and tick off daily tasks directly from the timer dashboard.
 */

import React, { useState, useEffect } from 'react'
import { getDailyMissions, saveDailyMissions } from '../utils/firestoreHelpers'
import { todayString } from '../utils/formatTime'

export default function DailyMissions({ userName, date = todayString() }) {
  const [missions, setMissions] = useState(() => {
    if (!userName) {
      try {
        const raw = localStorage.getItem(`stt_guest_missions_${date}`)
        if (raw) return JSON.parse(raw)
      } catch {}
      return [
        { id: 'gm_1', text: 'Revise core concepts & solve 20 practice questions', completed: false },
        { id: 'gm_2', text: 'Hit daily study hours target on timer', completed: false },
      ]
    }
    return []
  })
  const [newText, setNewText] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(() => Boolean(userName))

  useEffect(() => {
    if (!userName) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    getDailyMissions(userName, date)
      .then((items) => {
        if (items && Array.isArray(items)) setMissions(items)
      })
      .finally(() => setIsLoading(false))
  }, [userName, date])

  const persist = (updated) => {
    setMissions(updated)
    if (userName) {
      saveDailyMissions(userName, date, updated)
    } else {
      try {
        localStorage.setItem(`stt_guest_missions_${date}`, JSON.stringify(updated))
      } catch {}
    }
  }

  const handleToggle = (id) => {
    const updated = missions.map((m) =>
      m.id === id ? { ...m, completed: !m.completed } : m
    )
    persist(updated)
  }

  const handleAdd = (e) => {
    e?.preventDefault()
    if (!newText.trim()) return
    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: newText.trim(),
      completed: false,
      createdAt: Date.now(),
    }
    const updated = [...missions, newItem]
    setNewText('')
    persist(updated)
  }

  const handleDelete = (id) => {
    const updated = missions.filter((m) => m.id !== id)
    persist(updated)
  }

  const completedCount = missions.filter((m) => m.completed).length
  const totalCount = missions.length
  const allCompleted = totalCount > 0 && completedCount === totalCount

  return (
    <div className="card p-3.5 flex flex-col gap-2.5 transition-all">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🎯</span>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Daily Missions
          </span>
          {totalCount > 0 && (
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                allCompleted
                  ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                  : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              }`}
            >
              {allCompleted ? '✓ All Done!' : `${completedCount}/${totalCount} Done`}
            </span>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-500 hover:text-gray-300 text-xs px-1"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="flex flex-col gap-2">
          {/* Mission list */}
          {missions.length > 0 ? (
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
              {missions.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-center justify-between gap-2 p-2 rounded-xl transition-all ${
                    m.completed
                      ? 'bg-[#141414] border border-[#222] opacity-70'
                      : 'bg-[#111] border border-[#2a2a2a]'
                  }`}
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={m.completed}
                      onChange={() => handleToggle(m.id)}
                      className="w-4 h-4 rounded accent-purple-500 cursor-pointer"
                    />
                    <span
                      className={`text-xs text-white break-words ${
                        m.completed ? 'line-through text-gray-500' : ''
                      }`}
                    >
                      {m.text}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-gray-600 hover:text-red-400 text-xs px-1 transition-colors"
                    title="Delete item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            !isLoading && (
              <p className="text-gray-600 text-xs italic py-1">
                No missions set for today. Add 3-5 targets to stay focused!
              </p>
            )
          )}

          {/* Add input */}
          <form onSubmit={handleAdd} className="flex gap-1.5 pt-1">
            <input
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="e.g. Solve 20 Physics questions..."
              maxLength={80}
              className="flex-1 rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-3 py-1.5 text-xs outline-none focus:border-purple-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!newText.trim()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#8b5cf6] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-600 transition-all"
            >
              + Add
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
