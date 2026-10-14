/**
 * AdminTimerBoosterModal.jsx
 * Admin Super-Tool for instant user timer adjustments.
 * Allows Admin (bandar / jeeteshsharma) to:
 * - Enter/select any user (e.g. kittu)
 * - View their live timer in real-time
 * - Add/subtract/set hours and minutes
 * - Instantly broadcast to their device & update today's saved session
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  adminAdjustUserTimer,
  adminGetAllUsers,
  subscribeToLiveStatus,
} from '../utils/firestoreHelpers'
import { formatTime } from '../utils/formatTime'

export default function AdminTimerBoosterModal({ isOpen, onClose, initialUser = 'kittu' }) {
  const [targetUser, setTargetUser] = useState(initialUser || 'kittu')
  const [usersList, setUsersList] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [liveStatus, setLiveStatus] = useState(null)
  const [liveDisplayTime, setLiveDisplayTime] = useState('0:00:00')

  // Adjustment Inputs
  const [operation, setOperation] = useState('add') // 'add' | 'subtract' | 'set'
  const [hours, setHours] = useState(0)
  const [minutes, setMinutes] = useState(20)
  const [adjustSavedSession, setAdjustSavedSession] = useState(true)

  // Feedback & Action state
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message: '' }

  const rafRef = useRef(null)

  // Load all registered users once
  useEffect(() => {
    if (!isOpen) return
    setLoadingUsers(true)
    adminGetAllUsers()
      .then((list) => {
        setUsersList(list)
        setLoadingUsers(false)
      })
      .catch(() => setLoadingUsers(false))
  }, [isOpen])

  // Reset target user on open if provided
  useEffect(() => {
    if (isOpen && initialUser) {
      setTargetUser(initialUser)
      setFeedback(null)
    }
  }, [isOpen, initialUser])

  // Subscribe to live status of selected target user
  useEffect(() => {
    if (!isOpen || !targetUser) {
      setLiveStatus(null)
      return
    }

    const cleanUser = targetUser.trim().toLowerCase()
    const unsub = subscribeToLiveStatus(cleanUser, (data) => {
      setLiveStatus(data)
    })
    return () => unsub()
  }, [isOpen, targetUser])

  // Real-time ticking for liveDisplayTime if running
  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)

    if (!liveStatus) {
      setLiveDisplayTime('0:00:00')
      return
    }

    const baseElapsed = Number(liveStatus.baseElapsed) || 0
    const startMs = Number(liveStatus.startedAtMs) || null
    const isRunning = Boolean(liveStatus.isRunning)

    const tick = () => {
      let current = baseElapsed
      if (isRunning && startMs) {
        current += Math.max(0, Date.now() - startMs)
      }
      setLiveDisplayTime(formatTime(current).split('.')[0])

      if (isRunning && startMs) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    tick()

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [liveStatus])

  if (!isOpen) return null

  const handleApplyPreset = (m, h = 0) => {
    setHours(h)
    setMinutes(m)
    setOperation('add')
  }

  const handleExecuteBoost = async (e) => {
    e?.preventDefault()
    const cleanUser = targetUser.trim().toLowerCase()
    if (!cleanUser) {
      setFeedback({ type: 'error', message: 'Please enter a target username.' })
      return
    }

    if (hours === 0 && minutes === 0 && operation !== 'set') {
      setFeedback({ type: 'error', message: 'Please specify minutes or hours to adjust.' })
      return
    }

    setSubmitting(true)
    setFeedback(null)

    try {
      const res = await adminAdjustUserTimer({
        targetUsername: cleanUser,
        hours: Number(hours) || 0,
        minutes: Number(minutes) || 0,
        adjustSavedSession,
        operation,
      })

      const actionText =
        operation === 'add'
          ? `Added +${hours > 0 ? `${hours}h ` : ''}${minutes}m`
          : operation === 'subtract'
          ? `Subtracted -${hours > 0 ? `${hours}h ` : ''}${minutes}m`
          : `Set to ${hours}h ${minutes}m`

      setFeedback({
        type: 'success',
        message: `⚡ ${actionText} for @${res.target}! New timer: ${res.currentFormatted.split('.')[0]}${
          res.savedSessionUpdated ? ' · Today’s saved session updated!' : ''
        }`,
      })
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update timer.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div
        className="relative z-10 w-full max-w-lg bg-[#14141c] border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-white"
        style={{ animation: 'scaleIn 160ms ease-out' }}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-950/40 via-[#181824] to-purple-950/40 border-b border-[#28283a] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-lg">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Admin Timer Booster</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Instantly adjust study time & live sync with user's phone/device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#20202e] hover:bg-[#2c2c40] text-gray-300 hover:text-white flex items-center justify-center text-sm font-bold cursor-pointer transition-all"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[80vh] overflow-y-auto">
          {/* Target User Selector */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">
              Target Student Username:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">@</span>
                <input
                  type="text"
                  value={targetUser}
                  onChange={(e) => {
                    setTargetUser(e.target.value)
                    setFeedback(null)
                  }}
                  placeholder="e.g. kittu"
                  className="w-full pl-7 pr-3 py-2 rounded-xl bg-[#1a1a26] border border-[#2e2e42] focus:border-amber-500 text-white text-sm outline-none font-mono"
                />
              </div>

              {/* Quick User Dropdown */}
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    setTargetUser(e.target.value)
                    setFeedback(null)
                  }
                }}
                value={usersList.some((u) => u.username === targetUser.toLowerCase()) ? targetUser.toLowerCase() : ''}
                className="px-3 py-2 rounded-xl bg-[#1f1f2e] border border-[#2e2e42] text-xs font-semibold text-gray-300 outline-none cursor-pointer"
              >
                <option value="">Select User ▾</option>
                {usersList.map((u) => (
                  <option key={u.username} value={u.username}>
                    {u.displayName} (@{u.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Quick click suggestions for frequent users */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-500 font-semibold">Quick select:</span>
              {['kittu', 'bandar', 'geet', 'rjee01'].map((uname) => (
                <button
                  key={uname}
                  type="button"
                  onClick={() => {
                    setTargetUser(uname)
                    setFeedback(null)
                  }}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
                    targetUser.toLowerCase() === uname
                      ? 'bg-amber-500 text-black shadow-sm'
                      : 'bg-[#1e1e2d] text-gray-300 hover:text-white border border-[#2a2a3e]'
                  }`}
                >
                  @{uname}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Live Status of Selected User */}
          <div className="p-3.5 rounded-2xl bg-[#181824] border border-[#2d2d40] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-3 h-3 rounded-full ${
                  liveStatus?.isRunning ? 'bg-green-500 animate-pulse shadow-[0_0_8px_#22c55e]' : 'bg-gray-500'
                }`}
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white">@{targetUser || 'user'}</span>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                      liveStatus?.isRunning
                        ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                        : 'bg-gray-700/40 text-gray-400'
                    }`}
                  >
                    {liveStatus?.isRunning ? '● ACTIVE LIVE' : 'STOPPED'}
                  </span>
                </div>
                <span className="text-[11px] text-gray-400 block mt-0.5">
                  {liveStatus?.isRunning
                    ? 'Timer actively counting on their device'
                    : 'Last session stored on cloud'}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-base font-black font-mono text-amber-300 tracking-wide">
                {liveDisplayTime}
              </span>
              <span className="block text-[9px] text-gray-500 uppercase font-semibold">Current Timer</span>
            </div>
          </div>

          {/* Operation Switcher */}
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1.5">Adjustment Mode:</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#191926] border border-[#28283a]">
              <button
                type="button"
                onClick={() => setOperation('add')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  operation === 'add'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                + Add Time
              </button>
              <button
                type="button"
                onClick={() => setOperation('subtract')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  operation === 'subtract'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                - Deduct Time
              </button>
              <button
                type="button"
                onClick={() => setOperation('set')}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                  operation === 'set'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                = Set Exact
              </button>
            </div>
          </div>

          {/* Quick Presets */}
          {operation === 'add' && (
            <div>
              <span className="text-[11px] font-bold text-gray-400 mb-1.5 block">1-Tap Presets:</span>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[
                  { label: '+10m', m: 10, h: 0 },
                  { label: '+15m', m: 15, h: 0 },
                  { label: '+20m', m: 20, h: 0 },
                  { label: '+30m', m: 30, h: 0 },
                  { label: '+45m', m: 45, h: 0 },
                  { label: '+1h', m: 0, h: 1 },
                  { label: '+2h', m: 0, h: 2 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleApplyPreset(p.m, p.h)}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      hours === p.h && minutes === p.m
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md font-extrabold'
                        : 'bg-[#1a1a28] hover:bg-[#252538] text-gray-300 border-[#2d2d42]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Custom Hours & Minutes Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">Hours (घंटे):</label>
              <input
                type="number"
                min="0"
                max="24"
                value={hours}
                onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-[#191926] border border-[#2d2d40] focus:border-amber-500 text-white font-mono font-bold text-base outline-none text-center"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-300 mb-1">Minutes (मिनट):</label>
              <input
                type="number"
                min="0"
                max="59"
                value={minutes}
                onChange={(e) => setMinutes(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full px-3 py-2 rounded-xl bg-[#191926] border border-[#2d2d40] focus:border-amber-500 text-white font-mono font-bold text-base outline-none text-center"
              />
            </div>
          </div>

          {/* Sync options */}
          <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[#171722] border border-[#28283a] cursor-pointer">
            <input
              type="checkbox"
              checked={adjustSavedSession}
              onChange={(e) => setAdjustSavedSession(e.target.checked)}
              className="accent-amber-500 w-4 h-4 rounded cursor-pointer"
            />
            <div className="text-left">
              <span className="text-xs font-bold text-gray-200 block">
                Today's Saved Session ko bhi update karein
              </span>
              <span className="text-[10px] text-gray-400 block">
                Agar user ne aaj ka session pehle hi save kar liya hai, toh usme bhi time add/sync ho jayega.
              </span>
            </div>
          </label>

          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <span>{feedback.type === 'success' ? '✅' : '⚠️'}</span>
              <span className="flex-1">{feedback.message}</span>
            </div>
          )}

          {/* Action Button */}
          <button
            type="button"
            onClick={handleExecuteBoost}
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold text-sm tracking-wide shadow-xl shadow-amber-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                <span>Broadcasting to Device...</span>
              </>
            ) : (
              <>
                <span>⚡</span>
                <span>
                  {operation === 'add'
                    ? `Boost +${hours > 0 ? `${hours}h ` : ''}${minutes}m & Sync Live`
                    : operation === 'subtract'
                    ? `Deduct -${hours > 0 ? `${hours}h ` : ''}${minutes}m & Sync Live`
                    : `Set to ${hours}h ${minutes}m & Sync Live`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
