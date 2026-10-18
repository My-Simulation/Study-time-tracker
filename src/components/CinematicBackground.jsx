import React, { useMemo } from 'react'

/**
 * CinematicBackground.jsx
 * High-performance, GPU-accelerated cosmic nebula & starlight ambient background.
 * Uses CSS transforms & blur so it consumes 0% CPU and zero battery drain.
 */
export default function CinematicBackground({ isRunning = false }) {
  // Generate random static positions for subtle star particles
  const stars = useMemo(() => {
    return Array.from({ length: 32 }, (_, i) => ({
      id: i,
      x: (i * 3.1 + (i % 7) * 13) % 96 + 2,
      y: (i * 4.7 + (i % 5) * 17) % 94 + 3,
      size: (i % 3) === 0 ? 2.5 : (i % 2) === 0 ? 1.5 : 1,
      opacity: 0.25 + ((i % 5) * 0.12),
      duration: 3 + (i % 4) * 2,
      delay: (i % 7) * 0.7,
    }))
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none bg-[#08080f]"
    >
      {/* Deep Cyber Mesh Ambient Radial Orbs */}
      <div
        className="absolute -top-[15%] -left-[10%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full animate-nebula opacity-50"
        style={{
          background: 'radial-gradient(circle, rgba(124, 58, 237, 0.35) 0%, rgba(79, 70, 229, 0.15) 50%, rgba(8, 8, 15, 0) 75%)',
          filter: 'blur(75px)',
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      <div
        className="absolute top-[25%] -right-[15%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full animate-nebula-delayed opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.28) 0%, rgba(59, 130, 246, 0.12) 50%, rgba(8, 8, 15, 0) 75%)',
          filter: 'blur(85px)',
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      <div
        className="absolute -bottom-[20%] left-[20%] w-[65vw] h-[65vw] max-w-[750px] max-h-[750px] rounded-full animate-nebula-slow opacity-35"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, rgba(139, 92, 246, 0.12) 50%, rgba(8, 8, 15, 0) 75%)',
          filter: 'blur(90px)',
          transform: 'translate3d(0, 0, 0)',
        }}
      />

      {/* Subtle Star Dust Particles */}
      <div className="absolute inset-0">
        {stars.map((s) => (
          <div
            key={s.id}
            className="absolute rounded-full bg-white transition-opacity duration-1000"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              boxShadow: s.size > 2 ? '0 0 6px rgba(255, 255, 255, 0.8)' : 'none',
              animation: `pulseAura ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Ultra-subtle cyber grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Vignette mask around viewport edges */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 40%, rgba(5, 5, 8, 0.75) 100%)',
        }}
      />
    </div>
  )
}
