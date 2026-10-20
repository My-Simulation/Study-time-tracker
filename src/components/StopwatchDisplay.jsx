/**
 * StopwatchDisplay.jsx
 * Ultra-Cinematic Cyber Focus HUD Timer Display.
 * Features:
 * - Dynamic Neon Drop-Shadow Digits with Millisecond Accent
 * - Live Breathing Aura & Cosmic Radial Glow
 * - Interactive Audio-Style Frequency Equalizer Waves (dancing live when running!)
 * - Cyber Laser Shimmer Beam
 * - Sci-Fi Status Pill (LIVE FOCUS FLOW vs COUNTDOWN REVERSE TIMER vs STANDBY)
 * - Zero CPU / GPU-accelerated CSS animations
 */

import React, { useMemo } from 'react'

export default function StopwatchDisplay({
  displayTime = '0:00:00.00',
  captureRef,
  isRunning = false,
  timerMode = 'stopwatch',
  activeSubject = '',
}) {
  const isTimer = timerMode === 'timer'
  const isPomo = timerMode === 'pomodoro'

  // Parse time string: "0:00:00.00" -> main "0:00:00", ms "00"
  const [mainTime, msPart] = useMemo(() => {
    if (!displayTime) return ['0:00:00', '00']
    const parts = displayTime.split('.')
    return [parts[0] || '0:00:00', parts[1] || '00']
  }, [displayTime])

  // Frequency wave bar heights pattern (18 bars)
  const eqBars = useMemo(() => [
    { anim: 'eqDance1', delay: '0ms' },
    { anim: 'eqDance2', delay: '120ms' },
    { anim: 'eqDance3', delay: '240ms' },
    { anim: 'eqDance1', delay: '360ms' },
    { anim: 'eqDance2', delay: '480ms' },
    { anim: 'eqDance3', delay: '600ms' },
    { anim: 'eqDance1', delay: '720ms' },
    { anim: 'eqDance2', delay: '840ms' },
    { anim: 'eqDance3', delay: '960ms' },
    { anim: 'eqDance3', delay: '960ms' },
    { anim: 'eqDance2', delay: '840ms' },
    { anim: 'eqDance1', delay: '720ms' },
    { anim: 'eqDance3', delay: '600ms' },
    { anim: 'eqDance2', delay: '480ms' },
    { anim: 'eqDance1', delay: '360ms' },
    { anim: 'eqDance3', delay: '240ms' },
    { anim: 'eqDance2', delay: '120ms' },
    { anim: 'eqDance1', delay: '0ms' },
  ], [])

  return (
    <div
      ref={captureRef}
      className="relative flex flex-col items-center justify-center pt-7 pb-6 px-4 select-none w-full overflow-hidden"
      style={{ minHeight: '175px' }}
    >
      {/* ── Ambient Radial Focus Aura (Multi-Layered) ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center -z-10"
      >
        {/* Core Pulsing Nebula Aura */}
        <div
          className={`w-[85%] h-[150px] rounded-full transition-all duration-700 ${
            isRunning ? 'animate-pulseAura' : 'opacity-30'
          }`}
          style={{
            background: isTimer
              ? 'radial-gradient(ellipse at center, rgba(245, 158, 11, 0.45) 0%, rgba(217, 119, 6, 0.18) 45%, rgba(10, 10, 16, 0) 75%)'
              : isPomo
              ? 'radial-gradient(ellipse at center, rgba(20, 184, 166, 0.45) 0%, rgba(13, 148, 136, 0.18) 45%, rgba(10, 10, 16, 0) 75%)'
              : 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.45) 0%, rgba(99, 102, 241, 0.20) 45%, rgba(10, 10, 16, 0) 75%)',
            filter: 'blur(30px)',
          }}
        />

        {/* Outer Accent Glow */}
        <div
          className="w-[95%] h-[180px] rounded-full opacity-20"
          style={{
            background: isTimer
              ? 'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.35) 0%, rgba(0, 0, 0, 0) 70%)'
              : isPomo
              ? 'radial-gradient(ellipse at center, rgba(6, 182, 212, 0.3) 0%, rgba(0, 0, 0, 0) 70%)'
              : 'radial-gradient(ellipse at center, rgba(236, 72, 153, 0.25) 0%, rgba(0, 0, 0, 0) 70%)',
            filter: 'blur(45px)',
          }}
        />
      </div>

      {/* ── Cyber Laser Shimmer Beam (Glides across timer when running) ── */}
      {isRunning && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 w-32 bg-gradient-to-r from-transparent via-purple-400/10 to-transparent animate-cyberBeam z-0"
        />
      )}

      {/* ── Top HUD Status Beacon ── */}
      <div className="relative z-10 flex items-center gap-2 mb-2 px-3 py-0.5 rounded-full bg-[#12121c]/80 border border-[#262638] backdrop-blur-md shadow-sm">
        <span
          className={`w-2 h-2 rounded-full transition-all ${
            isRunning
              ? isTimer
                ? 'bg-amber-400 shadow-[0_0_10px_#f59e0b] animate-ping'
                : isPomo
                ? 'bg-teal-400 shadow-[0_0_10px_#2dd4bf] animate-ping'
                : 'bg-emerald-400 shadow-[0_0_10px_#34d399] animate-pulse'
              : 'bg-gray-500'
          }`}
        />
        <span
          className={`text-[10px] font-mono font-bold tracking-widest uppercase ${
            isRunning
              ? isTimer
                ? 'text-amber-300'
                : isPomo
                ? 'text-teal-300'
                : 'text-purple-300'
              : 'text-gray-400'
          }`}
        >
          {isRunning
            ? isTimer
              ? '● COUNTDOWN REVERSE TIMER'
              : isPomo
              ? '● POMODORO STREAM'
              : '● LIVE FOCUS FLOW'
            : isTimer
            ? '⏸ COUNTDOWN STANDBY'
            : '⏸ STANDBY'}
        </span>
        {activeSubject && (
          <span className="text-[10px] text-gray-400 font-medium pl-1 border-l border-[#2e2e42] truncate max-w-[120px]">
            {activeSubject}
          </span>
        )}
      </div>

      {/* ── Main High-Impact Neon Digits ── */}
      <div className="relative z-10 flex items-baseline justify-center gap-1 sm:gap-2 w-full text-center">
        {/* Main H:MM:SS */}
        <span
          className={`font-mono tabular-nums leading-none tracking-tight font-black transition-all duration-300 select-none ${
            isRunning
              ? isTimer
                ? 'text-amber-100 drop-shadow-[0_0_26px_rgba(245,158,11,0.70)]'
                : isPomo
                ? 'text-teal-100 drop-shadow-[0_0_24px_rgba(20,184,166,0.65)]'
                : 'text-white drop-shadow-[0_0_26px_rgba(168,85,247,0.70)]'
              : 'text-gray-200'
          }`}
          style={{
            fontSize: 'clamp(36px, 9vw, 68px)',
            fontFamily: '"Roboto Mono", ui-monospace, monospace',
            letterSpacing: '-0.02em',
          }}
        >
          {mainTime.split('').map((char, i) => {
            if (char === ':') {
              return (
                <span
                  key={i}
                  className={`inline-block transition-opacity duration-300 ${
                    isRunning ? 'opacity-90 font-light' : 'opacity-40 font-light'
                  }`}
                  style={{ margin: '0 1px' }}
                >
                  :
                </span>
              )
            }
            return <span key={i}>{char}</span>
          })}
        </span>

        {/* Milliseconds Pill Accent */}
        {msPart && msPart !== '00' && (
          <div
            className={`font-mono tabular-nums font-bold text-xs sm:text-sm px-1.5 py-0.5 rounded-lg border transition-all duration-300 self-center mb-1 ${
              isRunning
                ? isTimer
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                  : isPomo
                  ? 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.35)]'
                  : 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.35)]'
                : 'bg-[#1a1a24] border-[#2e2e3e] text-gray-400'
            }`}
          >
            .{msPart}
          </div>
        )}
      </div>

      {/* ── Live Kinetic Equalizer Waveform Bars ── */}
      <div className="relative z-10 flex items-center justify-center gap-1 mt-4 h-6 px-4">
        {isRunning ? (
          eqBars.map((bar, idx) => (
            <span
              key={idx}
              className={`w-1 rounded-full transition-all ${
                isTimer
                  ? 'bg-gradient-to-t from-amber-500 via-orange-400 to-yellow-300'
                  : isPomo
                  ? 'bg-gradient-to-t from-teal-500 to-cyan-300'
                  : 'bg-gradient-to-t from-purple-600 via-indigo-500 to-cyan-400'
              }`}
              style={{
                animation: `${bar.anim} 1.1s ease-in-out ${bar.delay} infinite`,
                boxShadow: isTimer
                  ? '0 0 6px rgba(245, 158, 11, 0.5)'
                  : isPomo
                  ? '0 0 6px rgba(20, 184, 166, 0.5)'
                  : '0 0 6px rgba(168, 85, 247, 0.5)',
              }}
            />
          ))
        ) : (
          <div className="flex items-center gap-2">
            <span className="w-8 h-[2px] bg-[#2d2d42] rounded-full" />
            <span className="text-[10px] text-gray-300 font-mono tracking-wider font-semibold">
              {isTimer ? 'SET DURATION · PRESS START' : 'READY · PRESS START'}
            </span>
            <span className="w-8 h-[2px] bg-[#2d2d42] rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}
