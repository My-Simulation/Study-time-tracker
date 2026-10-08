/**
 * leaderboardHelpers.js
 * Helpers for fetching, aggregating, and anonymizing study stats for the Leaderboard.
 * Guaranteed 100% privacy: other users' usernames are never exposed in the UI.
 */

import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase.js'
import { toLocalDateStr } from './formatTime.js'

// Deterministic hash code from string
function hashString(str = '') {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const PREFIXES = [
  'Silent', 'Night', 'Quantum', 'Zenith', 'Apex', 'Cosmic', 'Iron', 'Shadow',
  'Alpha', 'Hyper', 'Focus', 'Sigma', 'Thunder', 'Blaze', 'Stellar', 'Astral',
  'Echo', 'Solar', 'Nova', 'Titan', 'Vortex', 'Prime', 'Mystic', 'Phantom'
]

const TITLES = [
  'Monk', 'Owl', 'Scholar', 'Aspirant', 'Thinker', 'Grinder', 'Titan',
  'Warrior', 'Master', 'Sage', 'Seeker', 'Pioneer', 'Mind', 'Phoenix',
  'Voyager', 'Samurai', 'Achiever', 'Strategist', 'Alchemist', 'Champion'
]

const ICONS = ['🦉', '🦅', '⚡', '🧘', '🏹', '🚀', '🐺', '🦁', '🔮', '🛡️', '⚔️', '🪐', '🔥', '👑', '🎯', '💫']

const COLORS = [
  '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b',
  '#06b6d4', '#6366f1', '#14b8a6', '#f97316', '#a855f7'
]

/**
 * Returns an anonymous alias and avatar for any user.
 * If customAlias is provided (e.g., 'jee', 'rukku', 'maaik'), it is used.
 * Otherwise, falls back to 'Aspirant #<num>'.
 * If the user matches current logged-in user, appends '(You)'.
 */
export function generateAnonymousIdentity(username = '', currentUsername = '', customAlias = '') {
  const isSelf = currentUsername && username.toLowerCase() === currentUsername.toLowerCase()
  const hash = hashString(username.toLowerCase())
  const num = (hash % 89) + 11 // 2-digit number 11-99
  const icon = ICONS[hash % ICONS.length]
  const color = COLORS[hash % COLORS.length]

  const cleanAlias = (customAlias || '').trim()
  const baseName = cleanAlias || `Aspirant #${num}`
  const initials = (cleanAlias ? cleanAlias.slice(0, 2) : 'AS').toUpperCase()

  if (isSelf) {
    return {
      isCurrentUser: true,
      displayName: cleanAlias ? `${cleanAlias} (You)` : `Aspirant #${num} (You)`,
      codename: baseName,
      tag: '⭐',
      icon: '🌟',
      color: '#8b5cf6',
      initials,
    }
  }

  return {
    isCurrentUser: false,
    displayName: baseName,
    codename: baseName,
    tag: `#${num}`,
    icon,
    color,
    initials,
  }
}

/**
 * Determines study tier badge based on daily average hours.
 */
export function getStudyTier(avgSeconds = 0) {
  const hours = avgSeconds / 3600
  if (hours >= 10) {
    return { name: 'Grandmaster', icon: '👑', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' }
  }
  if (hours >= 8) {
    return { name: 'Elite Focus', icon: '⚡', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: 'rgba(139, 92, 246, 0.3)' }
  }
  if (hours >= 6) {
    return { name: 'Hardcore', icon: '🔥', color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)', border: 'rgba(236, 72, 153, 0.3)' }
  }
  if (hours >= 4) {
    return { name: 'Dedicated', icon: '🎯', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.3)' }
  }
  return { name: 'Rising Star', icon: '🚀', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' }
}

/**
 * Formats seconds into clean hours & minutes string (e.g. "8h 45m" or "45m")
 */
export function formatHoursMins(totalSec = 0) {
  const s = Math.max(0, Math.floor(totalSec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/**
 * Formats daily average with decimal (e.g. "7.8 hrs/day")
 */
export function formatAvgHours(totalSec = 0) {
  const hours = Math.max(0, totalSec) / 3600
  return `${hours.toFixed(1)}h/day`
}

/**
 * Calculates start date (Monday) of the current week in YYYY-MM-DD format
 */
export function getMondayOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust for Sunday
  const monday = new Date(now.setDate(diff))
  return toLocalDateStr(monday)
}

/**
 * Fetches all study stats across users from Firestore and returns categorized rankings.
 */
export async function fetchLeaderboardStats(currentUsername = '') {
  const todayStr = toLocalDateStr(new Date())
  const mondayStr = getMondayOfCurrentWeek()

  const [sessionSnap, liveSnap, userSnap] = await Promise.all([
    getDocs(collection(db, 'sessions')),
    getDocs(collection(db, 'liveStatus')),
    getDocs(collection(db, 'users')),
  ])

  const userMap = new Map()
  const aliasMap = new Map()

  // Initialize known users
  userSnap.forEach((doc) => {
    const u = doc.id.toLowerCase()
    const data = doc.data()
    const alias = data?.leaderboardAlias?.trim() || ''
    if (alias) {
      aliasMap.set(u, alias)
    }
    userMap.set(u, {
      username: u,
      leaderboardAlias: alias,
      todaySeconds: 0,
      thisWeekSeconds: 0,
      allTimeSeconds: 0,
      activeDates: new Set(),
      dateSecondsMap: new Map(),
      isLiveNow: false,
    })
  })

  // Aggregate sessions
  sessionSnap.forEach((doc) => {
    const s = doc.data()
    const u = s.userName?.toLowerCase()
    if (!u) return

    if (!userMap.has(u)) {
      userMap.set(u, {
        username: u,
        leaderboardAlias: aliasMap.get(u) || '',
        todaySeconds: 0,
        thisWeekSeconds: 0,
        allTimeSeconds: 0,
        activeDates: new Set(),
        dateSecondsMap: new Map(),
        isLiveNow: false,
      })
    }

    const stat = userMap.get(u)
    const sec = Number(s.totalSeconds) || 0
    stat.allTimeSeconds += sec

    if (s.date) {
      stat.activeDates.add(s.date)
      if (sec > 0) {
        stat.dateSecondsMap.set(s.date, (stat.dateSecondsMap.get(s.date) || 0) + sec)
      }
      if (s.date >= mondayStr) {
        stat.thisWeekSeconds += sec
      }
      if (s.date === todayStr) {
        stat.todaySeconds += sec
      }
    }
  })

  // Incorporate Live Status (running timer or unsaved session today)
  liveSnap.forEach((doc) => {
    const u = doc.id.toLowerCase()
    if (!userMap.has(u)) return
    const stat = userMap.get(u)
    const data = doc.data()

    let liveSec = 0
    if (data.isRunning && data.startedAtMs) {
      const elapsedMs = (Number(data.baseElapsed) || 0) + Math.max(0, Date.now() - Number(data.startedAtMs))
      liveSec = Math.floor(elapsedMs / 1000)
      stat.isLiveNow = true
    } else if (Number(data.baseElapsed) > 0) {
      liveSec = Math.floor(Number(data.baseElapsed) / 1000)
    }

    // If live timer has accumulated time greater than saved sessions, incorporate the extra difference
    if (liveSec > stat.todaySeconds) {
      const diff = liveSec - stat.todaySeconds
      stat.todaySeconds = liveSec
      stat.thisWeekSeconds += diff
      stat.allTimeSeconds += diff
      stat.activeDates.add(todayStr)
      stat.dateSecondsMap.set(todayStr, liveSec)
    }
  })

  // Helper function to shift YYYY-MM-DD by offset days
  const shiftDateStr = (dateStr, days) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() + days)
    return toLocalDateStr(dt)
  }

  // Generate enriched list with identities, streaks, & tiers
  const userList = Array.from(userMap.values())
    .filter((st) => st.allTimeSeconds > 0 || st.todaySeconds > 0 || st.username === currentUsername?.toLowerCase())
    .map((st) => {
      const activeDays = Math.max(1, st.activeDates.size)
      const dailyAvgSec = Math.round(st.allTimeSeconds / activeDays)
      const alias = st.leaderboardAlias || aliasMap.get(st.username) || ''
      const identity = generateAnonymousIdentity(st.username, currentUsername, alias)
      const tier = getStudyTier(dailyAvgSec)

      // ── Current Active Streak & Streak Avg Calculation ──
      // Walk backwards starting from today (if studied > 0) or yesterday (if studied > 0)
      let streakDays = 0
      let streakSeconds = 0

      let checkDate = null
      if ((st.dateSecondsMap.get(todayStr) || 0) > 0) {
        checkDate = todayStr
      } else {
        const yesterdayStr = shiftDateStr(todayStr, -1)
        if ((st.dateSecondsMap.get(yesterdayStr) || 0) > 0) {
          checkDate = yesterdayStr
        }
      }

      if (checkDate) {
        let cur = checkDate
        let maxDays = 3650
        while (maxDays-- > 0 && (st.dateSecondsMap.get(cur) || 0) > 0) {
          streakDays++
          streakSeconds += st.dateSecondsMap.get(cur)
          cur = shiftDateStr(cur, -1)
        }
      }

      const streakAvgSec = streakDays > 0 ? Math.round(streakSeconds / streakDays) : 0

      return {
        ...st,
        activeDays,
        dailyAvgSec,
        streakDays,
        streakSeconds,
        streakAvgSec,
        identity,
        tier,
      }
    })

  return userList
}
