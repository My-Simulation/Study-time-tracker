/**
 * Syllabus.jsx
 * Syllabus & Topic Completion Tracker.
 * Allows students to add subjects, chapters, and topics,
 * track completion status (Not Started, In Progress, Completed),
 * and view overall & per-subject syllabus progress %.
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSyllabus, saveSyllabus } from '../utils/firestoreHelpers'

const STATUS_CONFIG = {
  not_started: {
    label: 'Not Started',
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',
    next: 'in_progress',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    next: 'completed',
  },
  completed: {
    label: 'Completed ✓',
    color: 'text-green-400 bg-green-500/10 border-green-500/30',
    next: 'not_started',
  },
}

export default function Syllabus({ userName }) {
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSubjectId, setActiveSubjectId] = useState(null)

  // Modals / forms
  const [showAddSubject, setShowAddSubject] = useState(false)
  const [subjectName, setSubjectName] = useState('')
  const [newTopicName, setNewTopicName] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all' | 'not_started' | 'in_progress' | 'completed'

  useEffect(() => {
    if (!userName) return
    setLoading(true)
    getSyllabus(userName)
      .then((data) => {
        if (data && Array.isArray(data)) {
          setSubjects(data)
          if (data.length > 0) setActiveSubjectId(data[0].id)
        }
      })
      .finally(() => setLoading(false))
  }, [userName])

  const persist = (updated) => {
    setSubjects(updated)
    saveSyllabus(userName, updated)
  }

  // Add Subject
  const handleAddSubject = (e) => {
    e?.preventDefault()
    if (!subjectName.trim()) return
    const newSub = {
      id: `sub_${Date.now()}`,
      name: subjectName.trim(),
      topics: [],
    }
    const updated = [...subjects, newSub]
    persist(updated)
    setActiveSubjectId(newSub.id)
    setSubjectName('')
    setShowAddSubject(false)
  }

  // Delete Subject
  const handleDeleteSubject = (subId) => {
    if (!window.confirm('Delete this subject and all its topics?')) return
    const updated = subjects.filter((s) => s.id !== subId)
    persist(updated)
    if (activeSubjectId === subId) {
      setActiveSubjectId(updated.length > 0 ? updated[0].id : null)
    }
  }

  // Add Topic to Active Subject
  const handleAddTopic = (e) => {
    e?.preventDefault()
    if (!newTopicName.trim() || !activeSubjectId) return
    const newTopic = {
      id: `topic_${Date.now()}`,
      name: newTopicName.trim(),
      status: 'not_started', // not_started | in_progress | completed
    }
    const updated = subjects.map((sub) => {
      if (sub.id === activeSubjectId) {
        return { ...sub, topics: [...(sub.topics || []), newTopic] }
      }
      return sub
    })
    persist(updated)
    setNewTopicName('')
  }

  // Cycle topic status: Not Started -> In Progress -> Completed -> Not Started
  const handleCycleStatus = (subId, topicId) => {
    const updated = subjects.map((sub) => {
      if (sub.id === subId) {
        const topics = (sub.topics || []).map((t) => {
          if (t.id === topicId) {
            const current = t.status || 'not_started'
            const next = STATUS_CONFIG[current]?.next || 'in_progress'
            return { ...t, status: next }
          }
          return t
        })
        return { ...sub, topics }
      }
      return sub
    })
    persist(updated)
  }

  // Delete Topic
  const handleDeleteTopic = (subId, topicId) => {
    const updated = subjects.map((sub) => {
      if (sub.id === subId) {
        return { ...sub, topics: (sub.topics || []).filter((t) => t.id !== topicId) }
      }
      return sub
    })
    persist(updated)
  }

  // Calculations
  const allTopics = subjects.flatMap((s) => s.topics || [])
  const totalTopicsCount = allTopics.length
  const completedTopicsCount = allTopics.filter((t) => t.status === 'completed').length
  const overallPct =
    totalTopicsCount > 0
      ? Math.round((completedTopicsCount / totalTopicsCount) * 100)
      : 0

  const activeSubject = subjects.find((s) => s.id === activeSubjectId)
  const activeTopics = (activeSubject?.topics || []).filter((t) => {
    if (filterStatus === 'all') return true
    return (t.status || 'not_started') === filterStatus
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span>
          <span>Back to Timer</span>
        </button>
        <button
          onClick={() => setShowAddSubject(true)}
          className="text-xs px-3 py-1.5 rounded-full font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
        >
          + Add Subject
        </button>
      </div>

      {/* Header & Overall progress */}
      <div className="px-4 pb-4 max-w-lg mx-auto w-full">
        <h1 className="text-xl font-bold text-white">📚 Syllabus & Topic Tracker</h1>
        <p className="text-xs text-gray-500 mt-0.5">Track topic completion & syllabus coverage</p>

        {/* Overall progress meter */}
        <div className="card p-4 mt-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-medium">Total Syllabus Completed</span>
            <span className="font-mono font-bold text-base text-purple-400">
              {completedTopicsCount}/{totalTopicsCount} Topics ({overallPct}%)
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-[#2a2a2a] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${overallPct}%`,
                background:
                  overallPct >= 100 ? '#22c55e' : 'linear-gradient(90deg, #7c3aed, #8b5cf6)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-4 pb-12 max-w-lg mx-auto w-full gap-4">
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin"
              style={{ borderTopColor: '#8b5cf6' }}
            />
          </div>
        ) : subjects.length === 0 ? (
          <div className="card p-8 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">📖</div>
            <p className="text-sm font-semibold text-white">No Subjects Added Yet</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Add your subjects (e.g. Physics, Math, Biology) and break them down into chapters/topics.
            </p>
            <button
              onClick={() => setShowAddSubject(true)}
              className="pill-btn px-6 h-10 text-xs mt-2"
              style={{ background: '#8b5cf6', color: 'white' }}
            >
              + Create First Subject
            </button>
          </div>
        ) : (
          <>
            {/* Subject Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {subjects.map((sub) => {
                const subTopics = sub.topics || []
                const subDone = subTopics.filter((t) => t.status === 'completed').length
                const pct = subTopics.length > 0 ? Math.round((subDone / subTopics.length) * 100) : 0
                const isActive = sub.id === activeSubjectId

                return (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubjectId(sub.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
                      isActive
                        ? 'bg-purple-600/20 text-white border-purple-500/50 shadow-sm'
                        : 'bg-[#141414] text-gray-400 border-[#2a2a2a] hover:border-[#3a3a3a]'
                    }`}
                  >
                    <span>{sub.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                        pct === 100 ? 'text-green-400 bg-green-500/10' : 'text-gray-500 bg-[#222]'
                      }`}
                    >
                      {pct}%
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Active Subject Details */}
            {activeSubject && (
              <div className="card p-4 flex flex-col gap-3.5">
                {/* Subject Header */}
                <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-2.5">
                  <div>
                    <h2 className="text-sm font-bold text-white">{activeSubject.name}</h2>
                    <p className="text-[11px] text-gray-500">
                      {(activeSubject.topics || []).length} topics total
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteSubject(activeSubject.id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors"
                  >
                    Delete Subject
                  </button>
                </div>

                {/* Filter pills */}
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'not_started', label: 'Not Started' },
                    { key: 'in_progress', label: 'In Progress' },
                    { key: 'completed', label: 'Completed' },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilterStatus(f.key)}
                      className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${
                        filterStatus === f.key
                          ? 'bg-[#2a2a2a] text-white border-purple-500/40'
                          : 'text-gray-500 border-transparent hover:text-gray-400'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Topic list */}
                {activeTopics.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {activeTopics.map((topic) => {
                      const status = topic.status || 'not_started'
                      const conf = STATUS_CONFIG[status] || STATUS_CONFIG.not_started

                      return (
                        <div
                          key={topic.id}
                          className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#111] border border-[#242424] hover:border-[#2f2f2f] transition-all"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                status === 'completed'
                                  ? 'bg-green-400'
                                  : status === 'in_progress'
                                  ? 'bg-amber-400'
                                  : 'bg-gray-600'
                              }`}
                            />
                            <span
                              className={`text-xs text-white truncate ${
                                status === 'completed' ? 'line-through text-gray-500' : ''
                              }`}
                            >
                              {topic.name}
                            </span>
                          </div>

                          {/* Status toggle button */}
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleCycleStatus(activeSubject.id, topic.id)}
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-all select-none ${conf.color}`}
                              title="Click to toggle status"
                            >
                              {conf.label}
                            </button>
                            <button
                              onClick={() => handleDeleteTopic(activeSubject.id, topic.id)}
                              className="text-gray-600 hover:text-red-400 text-xs px-1"
                              title="Delete topic"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs text-center py-4">
                    No topics found under this filter.
                  </p>
                )}

                {/* Add Topic form */}
                <form onSubmit={handleAddTopic} className="flex gap-2 pt-1 border-t border-[#242424]">
                  <input
                    type="text"
                    value={newTopicName}
                    onChange={(e) => setNewTopicName(e.target.value)}
                    placeholder="Add a chapter or topic name..."
                    className="flex-1 rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 px-3 py-2 text-xs outline-none focus:border-purple-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newTopicName.trim()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#8b5cf6] text-white disabled:opacity-40 hover:bg-purple-600 transition-all"
                  >
                    + Add Topic
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Subject Modal */}
      {showAddSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-5 flex flex-col gap-4" style={{ animation: 'scaleIn 150ms ease-out' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Add New Subject</h3>
              <button onClick={() => setShowAddSubject(false)} className="text-gray-500 hover:text-gray-300 text-lg">
                ×
              </button>
            </div>

            <form onSubmit={handleAddSubject} className="flex flex-col gap-3">
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="e.g. Physics, Organic Chemistry, Calculus"
                autoFocus
                required
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white px-3 py-2 text-sm outline-none focus:border-purple-500"
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddSubject(false)}
                  className="pill-btn flex-1 h-10 text-xs"
                  style={{ background: '#2a2a2a', color: 'white' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!subjectName.trim()}
                  className="pill-btn flex-1 h-10 text-xs"
                  style={{ background: '#8b5cf6', color: 'white' }}
                >
                  Create Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
