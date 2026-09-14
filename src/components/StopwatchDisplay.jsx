/**
 * StopwatchDisplay.jsx
 * Renders the large digital timer with radial glow behind it.
 * This element is captured by html2canvas on Save.
 *
 * FIX: Timer was clipping on desktop — was using 13vw (viewport width)
 * which ballooned to 150px+ on wide screens. Now capped at 54px max
 * and uses padding to ensure it never overflows the card.
 */

import React from 'react'

export default function StopwatchDisplay({ displayTime, captureRef }) {
  return (
    <div
      ref={captureRef}
      className="relative flex items-center justify-center py-8 px-4 select-none w-full overflow-hidden"
      style={{ minHeight: '110px' }}
    >
      {/* Radial gradient glow behind the timer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          style={{
            width: '80%',
            height: '140px',
            background:
              'radial-gradient(ellipse at center, rgba(30,40,80,0.55) 0%, rgba(13,13,13,0) 70%)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Timer digits — font scales with container, never overflows */}
      <span
        className="relative z-10 font-mono tabular-nums leading-none text-white w-full text-center"
        style={{
          /*
           * clamp(min, preferred, max)
           * - min 28px: very small screens
           * - preferred 7.5vw: scales with viewport
           * - max 54px: never exceeds this → "0:00:00.00" at 54px
           *   in Roboto Mono ≈ 10 chars × 54 × 0.60 = 324px
           *   fits comfortably in any card ≥ 340px wide
           */
          fontSize: 'clamp(28px, 7.5vw, 54px)',
          fontWeight: 700,
          letterSpacing: '-0.01em',
          fontFamily: '"Roboto Mono", ui-monospace, monospace',
          display: 'block',
          overflow: 'hidden',
        }}
      >
        {displayTime.split('').map((char, i) => {
          if (char === ':' || char === '.') {
            return (
              <span
                key={i}
                style={{ fontWeight: 300, opacity: 0.7, margin: '0 0.5px' }}
              >
                {char}
              </span>
            )
          }
          return <span key={i}>{char}</span>
        })}
      </span>
    </div>
  )
}
