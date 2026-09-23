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

export function parseTimeline(timeline = [], isRunning = false, startedAtMs = null, baseElapsed = 0, laps = []) {
  const events = Array.isArray(timeline) ? timeline : []
  const items = []
  let pausesCount = 0

  // If no timeline events exist yet, check laps or baseElapsed
  if (events.length === 0) {
    if (Array.isArray(laps) && laps.length > 0) {
      // Reconstruct intervals from laps
      laps.forEach((lap, idx) => {
        items.push({
          type: 'chunk',
          title: `Interval #${lap.lapNo || idx + 1}`,
          subtitle: lap.split ? `Split: ${lap.split}` : 'Study interval',
          durationText: formatDuration(lap.splitMs || lap.totalMs || 0),
          isAccumulated: false,
        })
      })
    } else if (baseElapsed > 0) {
      items.push({
        type: 'chunk',
        title: 'Study Session',
        subtitle: 'Accumulated focus time',
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
    return { items, chunkCount: items.length, pausesCount: Math.max(0, items.length - 1) }
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

export default function SessionTimeline({
  timeline = [],
  isRunning = false,
  startedAtMs = null,
  baseElapsed = 0,
  laps = [],
  label = 'Timeline',
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { items, chunkCount, pausesCount } = parseTimeline(timeline, isRunning, startedAtMs, baseElapsed, laps)

  if (items.length === 0 && baseElapsed === 0 && !isRunning) {
    return null
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Discreet pill button taking zero extra space */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium text-gray-300 hover:text-white bg-[#1a1a24] hover:bg-[#222232] border border-[#2e2e42] transition-all cursor-pointer shadow-sm select-none"
        title="Click to view study intervals & breaks"
      >
        <span className="text-[11px]">🕒</span>
        <span>{isOpen ? 'Hide Timeline' : label}</span>
        {chunkCount > 0 && (
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold">
            {chunkCount} {chunkCount === 1 ? 'chunk' : 'chunks'}
          </span>
        )}
        <span className="text-[9px] opacity-70 ml-0.5">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* In-flow expansion panel - NEVER clipped by overflow-hidden! */}
      {isOpen && (
        <div
          className="w-full max-w-[340px] sm:max-w-sm mt-3 p-3.5 rounded-2xl bg-[#12121a]/98 border border-[#2c2c40] shadow-2xl text-left transition-all z-20"
          style={{ animation: 'scaleIn 150ms ease-out' }}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#232332]">
            <span className="text-xs font-bold text-gray-200 tracking-wide flex items-center gap-1.5">
              <span>🕒</span> Study Chunks & Breaks
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 rounded-full bg-[#1c1c28] hover:bg-[#28283a] text-gray-400 hover:text-white text-xs flex items-center justify-center transition-colors cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
            {items.map((it, idx) => {
              if (it.type === 'break') {
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-xl border border-amber-500/20 font-mono"
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
                    className="flex items-center justify-between text-xs text-green-400 bg-green-500/15 px-2.5 py-1.5 rounded-xl border border-green-500/30 font-medium"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
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
                    className="flex items-center justify-between text-[11px] text-gray-400 bg-[#171722] px-2.5 py-1 rounded-xl border border-[#252536]"
                  >
                    <span>⏸️ {it.title}</span>
                    <span className="text-gray-500 italic text-[10px]">Break</span>
                  </div>
                )
              }

              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs text-gray-200 bg-[#161622] px-2.5 py-1.5 rounded-xl border border-[#26263a]"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-[10px] text-purple-400 font-bold bg-purple-500/15 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <span className="truncate">{it.title}</span>
                  </div>
                  <span className="font-mono text-purple-300 font-bold text-xs ml-2 flex-shrink-0">
                    {it.durationText}
                  </span>
                </div>
              )
            })}
          </div>

          {pausesCount > 0 && (
            <div className="mt-2.5 pt-2 border-t border-[#232332] flex items-center justify-between text-[11px] text-gray-400 font-mono">
              <span>Pauses: {pausesCount}</span>
              <span className="text-gray-300 font-semibold">{chunkCount} session chunks</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
