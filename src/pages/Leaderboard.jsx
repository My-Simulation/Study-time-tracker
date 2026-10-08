/**
 * Leaderboard.jsx
 * Privacy-first, anonymous gamified Study Leaderboard.
 * Real usernames are masked with unique Aspirant Codenames.
 * Users can track their own ranking among peers across Today, This Week, Daily Average, and All Time.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  fetchLeaderboardStats,
  formatHoursMins,
  formatAvgHours,
} from '../utils/leaderboardHelpers'
import { getSession } from '../utils/auth'

export default function Leaderboard() {
  const navigate = useNavigate()
  const session = getSession()
  const currentUsername = session?.username || ''

  const [activeTab, setActiveTab] = useState('today') // 'today' | 'week' | 'streakAvg' | 'average' | 'allTime'
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const userCardRef = useRef(null)

  const loadData = async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    else setIsLoading(true)
    setError(null)

    try {
      const data = await fetchLeaderboardStats(currentUsername)
      setUsers(data)
    } catch (err) {
      console.error('Failed to load leaderboard stats:', err)
      setError('Could not load leaderboard data. Please check connection.')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentUsername])

  // Ranked list based on active tab
  const rankedUsers = useMemo(() => {
    const list = [...users]
    if (activeTab === 'today') {
      list.sort((a, b) => b.todaySeconds - a.todaySeconds || b.allTimeSeconds - a.allTimeSeconds)
    } else if (activeTab === 'week') {
      list.sort((a, b) => b.thisWeekSeconds - a.thisWeekSeconds || b.allTimeSeconds - a.allTimeSeconds)
    } else if (activeTab === 'streakAvg') {
      list.sort((a, b) => b.streakAvgSec - a.streakAvgSec || b.streakDays - a.streakDays || b.allTimeSeconds - a.allTimeSeconds)
    } else if (activeTab === 'average') {
      list.sort((a, b) => b.dailyAvgSec - a.dailyAvgSec || b.allTimeSeconds - a.allTimeSeconds)
    } else {
      list.sort((a, b) => b.allTimeSeconds - a.allTimeSeconds)
    }

    return list.map((user, idx) => ({
      ...user,
      rank: idx + 1,
    }))
  }, [users, activeTab])

  // Current user's stats and distance to higher rank
  const currentUserEntry = useMemo(() => {
    const entry = rankedUsers.find((u) => u.identity.isCurrentUser)
    if (!entry) return null

    const higherRank = entry.rank > 1 ? rankedUsers[entry.rank - 2] : null
    let diffSec = 0
    if (higherRank) {
      if (activeTab === 'today') diffSec = higherRank.todaySeconds - entry.todaySeconds
      else if (activeTab === 'week') diffSec = higherRank.thisWeekSeconds - entry.thisWeekSeconds
      else if (activeTab === 'streakAvg') diffSec = higherRank.streakAvgSec - entry.streakAvgSec
      else if (activeTab === 'average') diffSec = higherRank.dailyAvgSec - entry.dailyAvgSec
      else diffSec = higherRank.allTimeSeconds - entry.allTimeSeconds
    }

    return {
      ...entry,
      higherRank,
      diffSec: Math.max(0, diffSec),
    }
  }, [rankedUsers, activeTab])

  // Top 3 for podium
  const top1 = rankedUsers[0]
  const top2 = rankedUsers[1]
  const top3 = rankedUsers[2]
  const restList = rankedUsers.slice(3)

  const getValueDisplay = (user) => {
    if (activeTab === 'today') return formatHoursMins(user.todaySeconds)
    if (activeTab === 'week') return formatHoursMins(user.thisWeekSeconds)
    if (activeTab === 'streakAvg') return formatAvgHours(user.streakAvgSec)
    if (activeTab === 'average') return formatAvgHours(user.dailyAvgSec)
    return formatHoursMins(user.allTimeSeconds)
  }

  const scrollToMyPosition = () => {
    if (userCardRef.current) {
      userCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white flex flex-col font-sans pb-28">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0d0d12]/80 border-b border-[#222232] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl bg-[#1b1b26] hover:bg-[#262638] active:scale-95 border border-[#2e2e42] flex items-center justify-center text-gray-300 transition-all cursor-pointer"
            title="Back to Stopwatch"
          >
            ←
          </button>
          <div>
            <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2">
              🏆 Study Leaderboard
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-400">
                Live
              </span>
            </h1>
            <p className="text-[11px] text-gray-400 font-medium">
              Anonymous rankings across active study aspirants
            </p>
          </div>
        </div>

        <button
          onClick={() => loadData(true)}
          disabled={isRefreshing || isLoading}
          className="w-9 h-9 rounded-xl bg-[#1b1b26] hover:bg-[#262638] active:scale-95 border border-[#2e2e42] flex items-center justify-center text-sm text-gray-300 transition-all cursor-pointer disabled:opacity-50"
          title="Refresh stats"
        >
          <span className={isRefreshing ? 'animate-spin inline-block' : ''}>↻</span>
        </button>
      </header>

      {/* ── Privacy Notice Banner ── */}
      <div className="max-w-2xl w-full mx-auto px-4 mt-3">
        <div className="p-3 rounded-2xl bg-[#141420]/90 border border-purple-500/20 flex items-center gap-3 text-xs text-gray-300 shadow-md">
          <span className="text-lg flex-shrink-0">🔒</span>
          <p className="leading-relaxed text-[11px] text-gray-300">
            <strong className="text-purple-300">100% Anonymous:</strong> Real names are completely masked with Aspirant Codenames. Only you can recognize your own position marked as <span className="text-amber-300 font-bold">You (Aap)</span>.
          </p>
        </div>
      </div>

      {/* ── Metric Filter Tabs ── */}
      <div className="max-w-2xl w-full mx-auto px-4 mt-4">
        <div className="grid grid-cols-5 p-1 rounded-2xl bg-[#151522] border border-[#262638] gap-1">
          {[
            { id: 'today', label: 'Today', icon: '⚡' },
            { id: 'week', label: 'This Week', icon: '📅' },
            { id: 'streakAvg', label: 'Streak Avg', icon: '🔥' },
            { id: 'average', label: 'Daily Avg', icon: '📊' },
            { id: 'allTime', label: 'All Time', icon: '👑' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25 scale-[1.02]'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#1f1f30]'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="truncate">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content Container ── */}
      <main className="max-w-2xl w-full mx-auto px-4 mt-5 flex-1 flex flex-col gap-6">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-center">
            <div className="w-10 h-10 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin" />
            <p className="text-xs text-gray-400 font-medium">Calculating anonymous ranks...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-[#1c1418] border border-rose-900/40 text-center text-rose-300 text-xs">
            {error}
          </div>
        ) : rankedUsers.length === 0 ? (
          <div className="p-10 rounded-3xl bg-[#151522] border border-[#262638] text-center text-gray-400 text-sm">
            No study sessions recorded yet. Start your stopwatch to take the #1 spot!
          </div>
        ) : (
          <>
            {/* ── Top 3 Podium View ── */}
            <section className="pt-4 pb-2">
              <div className="flex items-end justify-center gap-2 sm:gap-4 max-w-lg mx-auto">
                {/* 2nd Place (Silver) */}
                {top2 && (
                  <div
                    ref={top2.identity.isCurrentUser ? userCardRef : null}
                    className={`flex-1 flex flex-col items-center p-3 rounded-2xl border transition-all ${
                      top2.identity.isCurrentUser
                        ? 'bg-gradient-to-b from-purple-950/40 to-[#181828] border-purple-500/60 shadow-lg shadow-purple-900/20 ring-1 ring-purple-500/30'
                        : 'bg-[#151522]/90 border-slate-400/20'
                    }`}
                  >
                    <div className="relative mb-2">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-md"
                        style={{ backgroundColor: top2.identity.color }}
                      >
                        {top2.identity.icon}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center shadow">
                        🥈
                      </span>
                    </div>

                    <div className="text-center w-full">
                      <p className={`text-xs font-bold truncate ${top2.identity.isCurrentUser ? 'text-amber-300' : 'text-gray-200'}`}>
                        {top2.identity.displayName}
                      </p>
                      <span
                        className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: top2.tier.bg, color: top2.tier.color }}
                      >
                        {top2.tier.name}
                      </span>
                      <p className="text-sm font-black text-white mt-1.5 font-mono">
                        {getValueDisplay(top2)}
                      </p>
                    </div>

                    {/* Pedestal block */}
                    <div className="w-full h-12 mt-2 rounded-xl bg-gradient-to-t from-slate-800/60 to-slate-700/40 border border-slate-600/30 flex items-center justify-center text-xs font-black text-slate-300">
                      #2
                    </div>
                  </div>
                )}

                {/* 1st Place (Gold) */}
                {top1 && (
                  <div
                    ref={top1.identity.isCurrentUser ? userCardRef : null}
                    className={`flex-1 flex flex-col items-center p-3.5 rounded-2xl border relative -mt-4 transition-all ${
                      top1.identity.isCurrentUser
                        ? 'bg-gradient-to-b from-amber-950/40 via-purple-950/30 to-[#1a1a2c] border-amber-500/60 shadow-xl shadow-amber-900/30 ring-2 ring-amber-500/40'
                        : 'bg-gradient-to-b from-amber-950/20 to-[#161624] border-amber-500/40 shadow-lg shadow-amber-950/20'
                    }`}
                  >
                    <div className="absolute -top-3 text-lg animate-bounce">👑</div>
                    <div className="relative mb-2 mt-1">
                      <div
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-xl ring-2 ring-amber-400/50"
                        style={{ backgroundColor: top1.identity.color }}
                      >
                        {top1.identity.icon}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow">
                        🥇
                      </span>
                    </div>

                    <div className="text-center w-full">
                      <p className={`text-xs font-extrabold truncate ${top1.identity.isCurrentUser ? 'text-amber-300' : 'text-white'}`}>
                        {top1.identity.displayName}
                      </p>
                      <span
                        className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: top1.tier.bg, color: top1.tier.color }}
                      >
                        {top1.tier.name}
                      </span>
                      <p className="text-base font-extrabold text-white mt-1.5 font-mono drop-shadow-sm">
                        {getValueDisplay(top1)}
                      </p>
                    </div>

                    {/* Pedestal block */}
                    <div className="w-full h-16 mt-2 rounded-xl bg-gradient-to-t from-amber-900/50 to-amber-700/40 border border-amber-400/50 flex items-center justify-center text-sm font-black text-white shadow-md">
                      #1
                    </div>
                  </div>
                )}

                {/* 3rd Place (Bronze) */}
                {top3 && (
                  <div
                    ref={top3.identity.isCurrentUser ? userCardRef : null}
                    className={`flex-1 flex flex-col items-center p-3 rounded-2xl border transition-all ${
                      top3.identity.isCurrentUser
                        ? 'bg-gradient-to-b from-purple-950/40 to-[#181828] border-purple-500/60 shadow-lg shadow-purple-900/20 ring-1 ring-purple-500/30'
                        : 'bg-[#151522]/90 border-amber-800/20'
                    }`}
                  >
                    <div className="relative mb-2">
                      <div
                        className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl font-bold shadow-md"
                        style={{ backgroundColor: top3.identity.color }}
                      >
                        {top3.identity.icon}
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center shadow">
                        🥉
                      </span>
                    </div>

                    <div className="text-center w-full">
                      <p className={`text-xs font-bold truncate ${top3.identity.isCurrentUser ? 'text-amber-300' : 'text-gray-200'}`}>
                        {top3.identity.displayName}
                      </p>
                      <span
                        className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded"
                        style={{ backgroundColor: top3.tier.bg, color: top3.tier.color }}
                      >
                        {top3.tier.name}
                      </span>
                      <p className="text-sm font-black text-white mt-1.5 font-mono">
                        {getValueDisplay(top3)}
                      </p>
                    </div>

                    {/* Pedestal block */}
                    <div className="w-full h-8 mt-2 rounded-xl bg-gradient-to-t from-amber-950/60 to-amber-900/30 border border-amber-800/30 flex items-center justify-center text-xs font-black text-amber-600">
                      #3
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ── Complete Ranking List (#4 onwards) ── */}
            {restList.length > 0 && (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 px-1 mb-1">
                  All Aspirants ({rankedUsers.length})
                </h3>

                {restList.map((user) => {
                  const isMe = user.identity.isCurrentUser
                  return (
                    <div
                      key={user.username}
                      ref={isMe ? userCardRef : null}
                      className={`p-3 rounded-2xl border transition-all flex items-center gap-3.5 ${
                        isMe
                          ? 'bg-gradient-to-r from-purple-950/50 via-[#1e1c2e] to-[#151522] border-purple-500/50 shadow-md shadow-purple-900/20 ring-1 ring-purple-500/30'
                          : 'bg-[#151522] hover:bg-[#1a1a2b] border-[#252538]'
                      }`}
                    >
                      {/* Rank Number */}
                      <span className="w-7 text-center font-mono font-black text-sm text-gray-400">
                        #{user.rank}
                      </span>

                      {/* Avatar */}
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-lg flex-shrink-0 shadow"
                        style={{ backgroundColor: user.identity.color }}
                      >
                        {user.identity.icon}
                      </div>

                      {/* Identity & Tier */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-xs font-bold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                            {user.identity.displayName}
                          </p>
                          {isMe && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-amber-400 text-amber-950">
                              YOU
                            </span>
                          )}
                          {user.isLiveNow && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Studying live now" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.2 rounded"
                            style={{ backgroundColor: user.tier.bg, color: user.tier.color }}
                          >
                            {user.tier.name}
                          </span>
                          {activeTab === 'streakAvg' ? (
                            <span className="text-[10px] text-orange-400 font-bold flex items-center gap-0.5">
                              <span>🔥</span> {user.streakDays} {user.streakDays === 1 ? 'day' : 'days'} streak
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500">
                              {user.activeDays} {user.activeDays === 1 ? 'day' : 'days'} active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Score Value */}
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-black font-mono ${isMe ? 'text-amber-300' : 'text-gray-100'}`}>
                          {getValueDisplay(user)}
                        </p>
                        <span className="text-[9px] text-gray-500 uppercase tracking-wider">
                          {activeTab === 'streakAvg' ? 'streak avg' : activeTab === 'average' ? 'daily avg' : 'studied'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Sticky Bottom "Your Position" Bar ── */}
      {currentUserEntry && (
        <aside className="fixed bottom-0 left-0 right-0 z-40 p-3 bg-[#11111a]/90 backdrop-blur-xl border-t border-[#29293e] shadow-2xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-purple-600/30 border border-purple-500/50 flex items-center justify-center font-black text-sm text-purple-300 flex-shrink-0">
                #{currentUserEntry.rank}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                  <span>Your Rank:</span>
                  <span className="text-amber-300 font-extrabold">#{currentUserEntry.rank}</span>
                  <span className="text-gray-400 font-mono text-[11px]">
                    ({getValueDisplay(currentUserEntry)})
                  </span>
                </p>
                <p className="text-[11px] text-purple-300 truncate">
                  {currentUserEntry.rank === 1 ? (
                    '👑 You are leading this leaderboard! Outstanding!'
                  ) : currentUserEntry.diffSec > 0 ? (
                    <>
                      <span>{formatHoursMins(currentUserEntry.diffSec)} behind #{currentUserEntry.rank - 1}</span>{' '}
                      <span className="text-emerald-400">Keep grinding! 🚀</span>
                    </>
                  ) : (
                    'Tied with the rank above! Study 1 more minute to advance!'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={scrollToMyPosition}
              className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 text-xs font-bold transition-all cursor-pointer flex-shrink-0 active:scale-95"
            >
              Find Me ↑
            </button>
          </div>
        </aside>
      )}
    </div>
  )
}
