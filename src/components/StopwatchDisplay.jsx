/**
 * StopwatchDisplay.jsx
 * Renders the large digital timer with radial glow behind it.
 * This element is captured by html2canvas on Save.
 */

import React from 'react'

export default function StopwatchDisplay({ displayTime, captureRef }) {
  return (
    <div
      ref={captureRef}
      className="relative flex items-center justify-center py-10 select-none"
      style={{ minHeight: '120px' }}
    >
      {/* Radial gradient glow behind the timer */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          style={{
            width: '340px',
            height: '160px',
            background:
              'radial-gradient(ellipse at center, rgba(30,40,80,0.55) 0%, rgba(13,13,13,0) 70%)',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Timer digits */}
      <span
        className="relative z-10 font-mono tabular-nums tracking-tight leading-none text-white"
        style={{
          fontSize: 'clamp(52px, 13vw, 88px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontFamily: '"Roboto Mono", ui-monospace, monospace',
        }}
      >
        {/* Render colons thinner */}
        {displayTime.split('').map((char, i) => {
          if (char === ':' || char === '.') {
            return (
              <span
                key={i}
                style={{ fontWeight: 300, opacity: 0.7, margin: '0 1px' }}
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
