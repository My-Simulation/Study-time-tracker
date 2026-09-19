/**
 * PartnerHistory.jsx
 * Read-only view of another user's study session history.
 * Route: /partner/:partnerName
 */

import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getUserSessions, groupSessionsByDate, calculateStreaks, getUserDoc, checkUserPrivacyAccess } from '../utils/firestoreHelpers'
import { formatDateDisplay, formatHoursMinutes } from '../utils/formatTime'
import { getSession } from '../utils/auth'

export default function PartnerHistory() {
  const { partnerName } = useParams()
  const navigate = useNavigate()
  const [dateGroups, setDateGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [partnerDoc, setPartnerDoc] = useState(null)
  const [privacyBlock, setPrivacyBlock] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setPrivacyBlock(null)
      try {
        const session = getSession()
        const viewerName = session?.username || ''
        const pDoc = await getUserDoc(partnerName)
        if (!cancelled) setPartnerDoc(pDoc)

        const access = checkUserPrivacyAccess(pDoc, viewerName)
        if (pDoc && !access.allowed) {
          if (!cancelled) setPrivacyBlock(access)
          return
        }

        const sessions = await getUserSessions(partnerName)
        if (!cancelled) setDateGroups(groupSessionsByDate(sessions))
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('Could not load history for @' + partnerName)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [partnerName])

  const stats = (() => {
    if (!dateGroups.length) return { totalDays: 0, totalSeconds: 0, bestDaySeconds: 0, currentStreak: 0, longestStreak: 0 }
    const { currentStreak, longestStreak } = calculateStreaks(dateGroups)
    return {
      totalDays: dateGroups.length,
      totalSeconds: dateGroups.reduce((s, g) => s + g.totalSeconds, 0),
      bestDaySeconds: Math.max(...dateGroups.map((g) => g.totalSeconds)),
      currentStreak,
      longestStreak,
    }
  })()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate(`/watch/${partnerName}`)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span><span>Back</span>
        </button>
      </div>

      {/* Header */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0"
          style={{ background: stringToColor(partnerName) }}
        >
          {partnerName[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">@{partnerName}'s History</h1>
          <p className="text-xs text-gray-500 mt-0.5">Read-only view</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-10 max-w-lg mx-auto w-full gap-4">
        {privacyBlock ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center max-w-sm mx-auto py-10">
            <div className="w-16 h-16 rounded-full bg-[#181820] border border-[#2e2e38] flex items-center justify-center text-3xl shadow-xl">
              {privacyBlock.reason === 'private' ? '🔒' : '👥'}
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-white font-bold text-lg">
                {privacyBlock.reason === 'private' ? 'Study History is Private' : 'Restricted to Selected Partners'}
              </h2>
              <p className="text-gray-400 text-xs leading-relaxed">
                {privacyBlock.reason === 'private' ? (
                  <>
                    <span className="text-purple-300 font-mono font-bold">@{partnerName}</span> has set their study session history to Private.
                  </>
                ) : (
                  <>
                    <span className="text-purple-300 font-mono font-bold">@{partnerName}</span> only shares study history with approved partners.
                    {privacyBlock.needsLogin ? (
                      <span className="block mt-2 text-amber-300">
                        Please sign in to verify your partner access.
                      </span>
                    ) : (
                      <span className="block mt-2 text-gray-400">
                        Ask @{partnerName} to add you in their Allowed Study Partners list in their Profile.
                      </span>
                    )}
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-3">
              {privacyBlock.needsLogin && (
                <button
                  onClick={() => navigate('/signin')}
                  className="pill-btn px-6 text-xs font-bold"
                  style={{ background: '#8b5cf6', color: 'white' }}
                >
                  Sign In
                </button>
              )}
              <button
                onClick={() => navigate('/watch')}
                className="pill-btn px-6 text-xs"
                style={{ background: '#242424', color: 'white' }}
              >
                Back to Watch
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-[#2a2a2a] animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
          </div>
        ) : error ? (
          <div className="card p-6 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : dateGroups.length === 0 ? (
          <div className="card p-10 flex flex-col items-center gap-3 text-center">
            <div className="text-4xl">📭</div>
            <p className="text-gray-400 text-sm">@{partnerName} hasn't saved any sessions yet.</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Days Studied" value={stats.totalDays} />
              <StatCard label="Total Hours" value={formatHoursMinutes(stats.totalSeconds)} />
              <StatCard label="🔥 Streak" value={`${stats.currentStreak}d`} />
              <StatCard label="⭐ Best Streak" value={`${stats.longestStreak}d`} />
            </div>

            {/* Session list */}
            <div className="flex flex-col gap-3">
              {dateGroups.map((group) => {
                const screenshot = [...group.sessions].reverse().find((s) => s.screenshotUrl)?.screenshotUrl
                return (
                  <div key={group.date} className="card p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {formatDateDisplay(group.date)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {group.sessions.length} session{group.sessions.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-xs text-gray-600">·</span>
                        <span className="font-mono text-xs text-purple-400 tabular-nums whitespace-nowrap">
                          {formatHoursMinutes(group.totalSeconds)}
                        </span>
                      </div>
                    </div>
                    {screenshot ? (
                      <img src={screenshot} alt="" className="w-20 h-12 object-cover rounded-lg border border-[#2a2a2a] flex-shrink-0" loading="lazy" />
                    ) : (
                      <SessionMiniCard totalSeconds={group.totalSeconds} sessions={group.sessions.length} />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="card p-3 flex flex-col gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-base font-bold text-white tabular-nums font-mono">{value}</div>
    </div>
  )
}

function SessionMiniCard({ totalSeconds, sessions }) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  return (
    <div className="w-20 h-12 rounded-lg border border-[#2a2a2a] bg-[#111] flex-shrink-0 flex flex-col items-center justify-center gap-0.5">
      <span className="text-white font-mono font-bold text-sm">{h > 0 ? `${h}h ${m}m` : `${m}m`}</span>
      <span className="text-gray-600 text-[10px]">{sessions} session{sessions !== 1 ? 's' : ''}</span>
    </div>
  )
}

function stringToColor(str) {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
