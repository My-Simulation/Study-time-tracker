/**
 * WatchPartner.jsx
 * Real-time live timer view for watching a study partner.
 * Route: /watch/:partnerName
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useWatchPartner } from '../hooks/useWatchPartner'
import { getUserSessions, groupSessionsByDate, getUserDoc, checkUserPrivacyAccess } from '../utils/firestoreHelpers'
import { formatHoursMinutes } from '../utils/formatTime'
import { getSession } from '../utils/auth'

export default function WatchPartner() {
  const { partnerName } = useParams()
  const navigate = useNavigate()
  const { status, displayTime, isLoading, notFound, isLive, lastSeenText } =
    useWatchPartner(partnerName)

  const [partnerDoc, setPartnerDoc] = useState(null)
  const [partnerInput, setPartnerInput] = useState('')

  const session = getSession()
  const viewerName = session?.username || ''

  useEffect(() => {
    if (!partnerName) return
    let isMounted = true
    getUserDoc(partnerName)
      .then((docData) => {
        if (isMounted && docData) setPartnerDoc(docData)
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [partnerName])

  if (isLoading) {
    return (
      <Screen>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[#2a2a2a] animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
          <p className="text-gray-500 text-sm">Looking for <span className="text-white">@{partnerName}</span>…</p>
        </div>
      </Screen>
    )
  }

  if (notFound) {
    return (
      <Screen partnerName={partnerName} navigate={navigate}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-5xl">🔍</div>
          <p className="text-white font-semibold text-lg">@{partnerName} not found</p>
          <p className="text-gray-500 text-sm">They haven't studied yet or the username is wrong.</p>
          <button
            onClick={() => navigate('/watch')}
            className="pill-btn px-8 text-sm mt-2"
            style={{ background: '#2a2a2a', color: 'white' }}
          >
            Try Another
          </button>
        </div>
      </Screen>
    )
  }

  // ── Privacy Access Check ──
  const access = checkUserPrivacyAccess(partnerDoc, viewerName)
  if (partnerDoc && !access.allowed) {
    return (
      <Screen partnerName={partnerName} navigate={navigate}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-full bg-[#181820] border border-[#2e2e38] flex items-center justify-center text-3xl shadow-xl">
            {access.reason === 'private' ? '🔒' : '👥'}
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-white font-bold text-lg">
              {access.reason === 'private' ? 'Live Activity is Private' : 'Restricted to Selected Partners'}
            </h2>
            <p className="text-gray-400 text-xs leading-relaxed">
              {access.reason === 'private' ? (
                <>
                  <span className="text-purple-300 font-mono font-bold">@{partnerName}</span> has turned off live activity sharing. Their live stopwatch and study history are private.
                </>
              ) : (
                <>
                  <span className="text-purple-300 font-mono font-bold">@{partnerName}</span> only shares live activity with approved study partners.
                  {access.needsLogin ? (
                    <span className="block mt-2 text-amber-300">
                      Please sign in to check if you have partner access.
                    </span>
                  ) : (
                    <span className="block mt-2 text-gray-400">
                      Ask @{partnerName} to add your username (<span className="text-purple-300 font-mono">@{viewerName}</span>) to their Allowed Study Partners list in their Profile.
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-3">
            {access.needsLogin && (
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
              Search Another User
            </button>
          </div>
        </div>
      </Screen>
    )
  }

  return (
    <Screen partnerName={partnerName} navigate={navigate}>
      <div className="flex-1 flex flex-col px-4 pb-10 max-w-lg mx-auto w-full gap-5">

        {/* Profile + Live badge */}
        <div className="flex items-center justify-center gap-3 mt-4">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-lg text-white shadow-md flex-shrink-0"
            style={{ background: partnerDoc?.avatarColor || stringToColor(partnerName) }}
          >
            {partnerDoc?.photoUrl ? (
              <img src={partnerDoc.photoUrl} alt={partnerName} className="w-full h-full object-cover" />
            ) : (
              partnerName[0].toUpperCase()
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-base">
                {partnerDoc?.displayName || `@${partnerName}`}
              </span>
              {partnerDoc?.displayName && (
                <span className="text-xs text-gray-400 font-mono">@{partnerName}</span>
              )}
              {isLive && (
                <span className="flex items-center gap-1 text-xs font-semibold text-green-400 bg-green-400/10 border border-green-400/30 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isLive ? 'Currently studying' : lastSeenText ? `Last seen ${lastSeenText}` : 'Not studying'}
            </p>
          </div>
        </div>

        {/* Big live timer */}
        <div
          className="card flex flex-col items-center justify-center py-12 gap-2 relative overflow-hidden"
          style={{ minHeight: '200px' }}
        >
          {/* Glow */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden
          >
            <div style={{
              width: '80%', height: '160px',
              background: isLive
                ? 'radial-gradient(ellipse at center, rgba(34,197,94,0.12) 0%, rgba(13,13,13,0) 70%)'
                : 'radial-gradient(ellipse at center, rgba(30,40,80,0.4) 0%, rgba(13,13,13,0) 70%)',
              borderRadius: '50%',
            }} />
          </div>

          {/* Status label */}
          {!isLive && (
            <span className="text-xs uppercase tracking-widest text-gray-600 font-medium mb-1">
              Last session
            </span>
          )}

          {/* Timer */}
          <span
            className="relative z-10 font-mono tabular-nums text-center"
            style={{
              fontSize: 'clamp(28px, 7.5vw, 54px)',
              fontWeight: 700,
              color: isLive ? '#22c55e' : '#666',
              fontFamily: '"Roboto Mono", ui-monospace, monospace',
            }}
          >
            {displayTime.split('').map((char, i) => {
              if (char === ':' || char === '.') {
                return <span key={i} style={{ fontWeight: 300, opacity: 0.6, margin: '0 0.5px' }}>{char}</span>
              }
              return <span key={i}>{char}</span>
            })}
          </span>

          {isLive && (
            <p className="relative z-10 text-xs text-green-500 mt-2 animate-pulse">
              ● Timer is running now
            </p>
          )}
          {!isLive && lastSeenText && (
            <p className="relative z-10 text-xs text-gray-600 mt-1">
              Updated {lastSeenText}
            </p>
          )}
        </div>

        {/* View their history button */}
        <button
          onClick={() => navigate(`/partner/${partnerName}`)}
          className="card p-4 flex items-center gap-3 hover:border-[#3a3a3a] transition-all btn-press cursor-pointer text-left"
        >
          <span className="text-xl">📖</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">View {partnerName}'s History</p>
            <p className="text-xs text-gray-500 mt-0.5">See all their saved study sessions</p>
          </div>
          <span className="text-gray-600">→</span>
        </button>

        {/* Share my link */}
        <ShareMyLink />
      </div>
    </Screen>
  )
}

// ── No partner specified — search screen ─────────────────────────────────────
export function WatchSearch({ userName }) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [previewUser, setPreviewUser] = useState(null)

  useEffect(() => {
    const trimmed = input.trim().toLowerCase()
    if (trimmed.length < 3) {
      setPreviewUser(null)
      return
    }
    let active = true
    const timer = setTimeout(() => {
      getUserDoc(trimmed).then((docData) => {
        if (active) setPreviewUser(docData)
      }).catch(() => {
        if (active) setPreviewUser(null)
      })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [input])

  const go = () => {
    const n = input.trim().toLowerCase()
    if (n) navigate(`/watch/${n}`)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors">
          <span>←</span><span>Back</span>
        </button>
      </div>

      <div className="px-4 pb-4">
        <h1 className="text-xl font-bold text-white">👁️ Watch a Partner</h1>
        <p className="text-sm text-gray-500 mt-0.5">See someone's timer live as they study</p>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-10 max-w-lg mx-auto w-full gap-4">
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-400">Partner's username</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 text-sm">@</span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && go()}
                placeholder="their_username"
                className="w-full rounded-xl bg-[#111] border border-[#2a2a2a] text-white placeholder-gray-600 pl-8 pr-4 py-3 text-base outline-none focus:border-purple-500 transition-colors"
              />
            </div>

            {/* Instant user search preview */}
            {previewUser && (
              <div
                onClick={() => navigate(`/watch/${previewUser.username || input.trim().toLowerCase()}`)}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-[#181822] border border-purple-500/40 hover:border-purple-500/70 cursor-pointer transition-all mt-1 shadow-md"
              >
                <div
                  className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                  style={{ background: previewUser.avatarColor || '#8b5cf6' }}
                >
                  {previewUser.photoUrl ? (
                    <img src={previewUser.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (previewUser.username || input)[0].toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {previewUser.displayName || previewUser.username}
                  </p>
                  <p className="text-xs text-purple-300 font-mono">@{previewUser.username}</p>
                </div>
                {(() => {
                  const pAccess = checkUserPrivacyAccess(previewUser, userName)
                  if (pAccess.allowed) {
                    return (
                      <span className="text-xs text-purple-300 font-bold px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40">
                        Watch Live →
                      </span>
                    )
                  }
                  if (pAccess.reason === 'private') {
                    return (
                      <span className="text-xs text-rose-300 font-bold px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/40">
                        🔒 Private
                      </span>
                    )
                  }
                  return (
                    <span className="text-xs text-amber-300 font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                      👥 Restricted
                    </span>
                  )
                })()}
              </div>
            )}
          </div>
          <button
            onClick={go}
            disabled={!input.trim()}
            className="pill-btn w-full"
            style={{ background: '#8b5cf6', color: 'white', opacity: !input.trim() ? 0.5 : 1 }}
          >
            Watch Live →
          </button>
        </div>

        {/* My shareable link */}
        <ShareMyLink userName={userName} />

        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm font-semibold text-white">How it works</p>
          <div className="flex flex-col gap-2">
            {[
              ['🔴', 'See if your partner is studying right now'],
              ['⏱️', 'Watch their timer counting live in real-time'],
              ['📖', 'View their full session history'],
              ['🔗', 'Share your link — they can watch your timer too'],
            ].map(([icon, text]) => (
              <div key={text} className="flex items-start gap-3">
                <span className="text-base leading-5">{icon}</span>
                <p className="text-sm text-gray-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────────────────
function Screen({ children, partnerName, navigate }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent' }}>
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <button
          onClick={() => navigate ? navigate('/watch') : window.history.back()}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>←</span><span>Back</span>
        </button>
        {partnerName && (
          <span className="text-xs text-gray-600">Watching @{partnerName}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function ShareMyLink({ userName }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/watch/${userName || ''}`

  const copy = () => {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!userName) return null

  return (
    <div className="card p-4 flex flex-col gap-3">
      <p className="text-sm font-semibold text-white">📤 Share your live timer</p>
      <div className="flex items-center gap-2 rounded-lg bg-[#111] border border-[#2a2a2a] px-3 py-2">
        <p className="text-xs text-gray-400 flex-1 truncate font-mono">{link}</p>
        <button
          onClick={copy}
          className="text-xs text-purple-400 hover:text-purple-300 font-medium whitespace-nowrap"
        >
          {copied ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <p className="text-xs text-gray-600">Anyone with this link can watch your timer live.</p>
    </div>
  )
}

function stringToColor(str) {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#dc2626', '#d97706', '#db2777']
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
