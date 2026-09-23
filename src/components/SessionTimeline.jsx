import React, { useState } from 'react'

function formatClock(ms) {
  if (!ms) return ''
  try {
    return new Date(ms).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    })
  } catch {
    return ''
  }
}

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function parseTimeline(timeline = [], isRunning = false, startedAtMs = null, baseElapsed = 0) {
  const events = Array.isArray(timeline) ? timeline : []
  const items = []
  let pausesCount = 0

  // If no timeline events exist yet but baseElapsed exists
  if (events.length === 0) {
    if (baseElapsed > 0) {
      items.push({
        type: 'chunk',
        title: 'Earlier Study Session',
        subtitle: 'Accumulated time before recent start',
        durationText: formatDuration(baseElapsed),
        isAccumulated: true,
      })
    }
    if (isRunning && startedAtMs) {
      items.push({
        type: 'active',
        title: `Started at ${formatClock(startedAtMs)}`,
        subtitle: 'Currently running',
        durationText: formatDuration(Math.max(0, Date.now() - startedAtMs)),
        isRunning: true,
      })
    }
    return { items, chunkCount: items.length, pausesCount }
  }

  // If timeline events exist, pair up start and stop events
  let activeStart = null
  let lastStop = null

  // If there was baseElapsed accumulated before the first logged start event
  const firstEvent = events[0]
  if (firstEvent && firstEvent.elapsed > 60000) {
    items.push({
      type: 'chunk',
      title: 'Earlier Study Session',
      subtitle: `Before ${formatClock(firstEvent.at)}`,
      durationText: formatDuration(firstEvent.elapsed),
      isAccumulated: true,
    })
  }

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]
    if (ev.type === 'start') {
      if (lastStop) {
        const breakMs = Math.max(0, ev.at - lastStop.at)
        if (breakMs >= 30000) {
          items.push({
            type: 'break',
            title: `Break: ${formatClock(lastStop.at)} – ${formatClock(ev.at)}`,
            durationText: `${formatDuration(breakMs)} pause`,
          })
        }
      }
      activeStart = ev
    } else if (ev.type === 'stop') {
      pausesCount++
      if (activeStart) {
        const chunkMs = Math.max(0, ev.at - activeStart.at)
        items.push({
          type: 'chunk',
          title: `${formatClock(activeStart.at)} – ${formatClock(ev.at)}`,
          subtitle: 'Completed study chunk',
          durationText: formatDuration(chunkMs),
          isRunning: false,
        })
        activeStart = null
      }
      lastStop = ev
    }
  }

  // If currently running
  if (isRunning) {
    const currentStartMs = startedAtMs || activeStart?.at
    if (currentStartMs) {
      const activeMs = Math.max(0, Date.now() - currentStartMs)
      items.push({
        type: 'active',
        title: `${formatClock(currentStartMs)} – Running now`,
        subtitle: 'Live active interval',
        durationText: formatDuration(activeMs),
        isRunning: true,
      })
    }
  } else if (lastStop) {
    items.push({
      type: 'paused',
      title: `Paused at ${formatClock(lastStop.at)}`,
      subtitle: 'Currently on break',
      durationText: 'Paused',
    })
  }

  const chunkCount = items.filter((it) => it.type === 'chunk' || it.type === 'active').length
  return { items, chunkCount, pausesCount }
}

export default function SessionTimeline({ timeline = [], isRunning = false, startedAtMs = null, baseElapsed = 0 }) {
  const [isOpen, setIsOpen] = useState(false)
  const { items, chunkCount, pausesCount } = parseTimeline(timeline, isRunning, startedAtMs, baseElapsed)

  if (items.length === 0 && baseElapsed === 0 && !isRunning) {
    return null
  }

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Discreet pill button taking zero vertical space */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-[#161616]/80 hover:bg-[#1f1f1f] border border-[#282828] transition-all cursor-pointer shadow-sm select-none"
        title="Click to view study intervals & breaks"
      >
        <span className="text-[10px]">🕒</span>
        <span>{isOpen ? 'Hide Timeline' : 'Timeline'}</span>
        {chunkCount > 0 && (
          <span className="text-[10px] font-mono px-1 rounded bg-[#222] text-gray-300">
            {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}
          </span>
        )}
        <span className="text-[9px] opacity-60">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Compact, sleek dropdown card */}
      {isOpen && (
        <div
          className="absolute z-30 top-8 left-1/2 -translate-x-1/2 w-72 max-w-[90vw] p-3 rounded-xl bg-[#141417]/95 backdrop-blur-md border border-[#2b2b35] shadow-2xl text-left"
          style={{ animation: 'fadeIn 120ms ease-out' }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#23232a]">
            <span className="text-[11px] font-bold text-gray-200 tracking-wide flex items-center gap-1.5">
              <span>🕒</span> Study Chunks & Breaks
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white text-xs px-1 rounded hover:bg-[#252530]"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            {items.map((it, idx) => {
              if (it.type === 'break') {
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[10px] text-amber-400/80 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 font-mono"
                  >
                    <span>☕ {it.title}</span>
                    <span className="font-semibold">{it.durationText}</span>
                  </div>
                )
              }

              if (it.type === 'active') {
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] text-green-400 bg-green-500/10 px-2 py-1 rounded border border-green-500/20 font-medium"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                      <span className="truncate">{it.title}</span>
                    </div>
                    <span className="font-mono font-bold text-xs ml-2 flex-shrink-0">{it.durationText}</span>
                  </div>
                )
              }

              if (it.type === 'paused') {
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[10px] text-gray-400 bg-[#1a1a22] px-2 py-0.5 rounded border border-[#282834]"
                  >
                    <span>⏸️ {it.title}</span>
                    <span className="text-gray-500 italic">Break</span>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-[11px] text-gray-300 bg-[#181820] px-2 py-1 rounded border border-[#262630]"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-[10px] text-purple-400 font-bold"># {idx + 1}</span>
                    <span className="truncate text-gray-200">{it.title}</span>
                  </div>
                  <span className="font-mono text-purple-300 font-semibold text-xs ml-2 flex-shrink-0">
                    {it.durationText}
                  </span>
                </div>
              )
            })}
          </div>

          {pausesCount > 0 && (
            <div className="mt-2 pt-1.5 border-t border-[#23232a] flex items-center justify-between text-[10px] text-gray-400 font-mono">
              <span>Total pauses: {pausesCount}</span>
              <span className="text-gray-300">{chunkCount} session chunks</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
