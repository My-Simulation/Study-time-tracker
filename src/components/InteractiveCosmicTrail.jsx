import React, { useEffect, useRef } from 'react'

/**
 * InteractiveCosmicTrail.jsx
 * Cinematic interactive cursor & touch constellation ribbon trail.
 * When the user moves or drags their cursor/finger across the screen without lifting,
 * a luminous continuous cosmic ribbon, constellation star flares, and stardust sparks
 * form seamlessly along the entire path before gently dissolving into cosmic mist.
 *
 * Features:
 * - 100% gapless continuous Bézier spline connecting midpoint-to-midpoint
 * - Tapering neon atmospheric glow + radiant diamond laser core
 * - Extended ~1.2s persistence so drawings & gestures feel magical & responsive
 * - Twinkling constellation star cross-flares along the trajectory
 * - Floating cosmic dust motes with gentle inertial drift
 * - Luminous Nova ring shockwave on click / touch down
 * - Completely non-blocking (pointer-events: none, passive listeners)
 * - 0% CPU idle efficiency (auto-suspends RAF loop when inactive)
 * - Retina / high-DPI display crisp rendering
 */
export default function InteractiveCosmicTrail() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    let animationFrameId = null
    let isLooping = false
    let lastTime = performance.now()

    let width = window.innerWidth
    let height = window.innerHeight
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    const points = []
    const particles = []
    const shockwaves = []

    const TRAIL_LIFETIME = 1250 // milliseconds path remains visible (allows drawing shapes!)
    const MAX_POINTS = 120

    // Cinematic neon palette: Electric Purple -> Cyber Cyan -> Radiant Azure -> Starlight White
    const PALETTE = [
      { r: 168, g: 85, b: 247 }, // Electric Violet
      { r: 99, g: 102, b: 241 },  // Indigo Flare
      { r: 6, g: 182, b: 212 },   // Cyber Cyan
      { r: 56, g: 189, b: 248 },  // Sky Plasma
      { r: 236, g: 72, b: 153 },  // Hot Aurora Pink
      { r: 251, g: 191, b: 36 },  // Warm Stellar Gold
    ]

    let lastPoint = null
    let starCounter = 0

    function wakeLoop() {
      if (!isLooping) {
        isLooping = true
        lastTime = performance.now()
        animationFrameId = requestAnimationFrame(render)
      }
    }

    function resize() {
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      wakeLoop()
    }

    function addPoint(x, y, isTouch = false) {
      const now = performance.now()

      if (lastPoint) {
        const dx = x - lastPoint.x
        const dy = y - lastPoint.y
        const dist = Math.hypot(dx, dy)

        // Interpolate points for buttery-smooth unbroken curve during fast mouse/finger sweeps
        if (dist > 10) {
          const steps = Math.min(Math.floor(dist / 8), 8)
          for (let i = 1; i < steps; i++) {
            const ix = lastPoint.x + (dx * i) / steps
            const iy = lastPoint.y + (dy * i) / steps
            points.push({
              x: ix,
              y: iy,
              time: now,
              speed: dist / steps,
              isStar: false,
            })
          }
        }

        // Spawn ambient stardust motes with subtle organic drift
        const particleCount = isTouch ? 2 : 1
        for (let k = 0; k < particleCount; k++) {
          const angle = Math.random() * Math.PI * 2
          const speed = Math.random() * 1.8 + 0.3
          const col = PALETTE[Math.floor(Math.random() * PALETTE.length)]
          particles.push({
            x: x + (Math.random() - 0.5) * 6,
            y: y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed + (dx * 0.025),
            vy: Math.sin(angle) * speed + (dy * 0.025),
            size: Math.random() * 2.4 + 0.8,
            color: col,
            life: 1.0,
            decay: Math.random() * 0.024 + 0.015,
          })
        }
      }

      starCounter++
      const isStarNode = starCounter % 7 === 0

      points.push({
        x,
        y,
        time: now,
        speed: lastPoint ? Math.hypot(x - lastPoint.x, y - lastPoint.y) : 0,
        isStar: isStarNode,
      })

      if (points.length > MAX_POINTS) {
        points.shift()
      }

      lastPoint = { x, y }
      wakeLoop()
    }

    function addShockwave(x, y) {
      shockwaves.push({
        x,
        y,
        radius: 4,
        maxRadius: 42,
        alpha: 0.95,
      })
      // Nova burst of glowing stardust
      for (let i = 0; i < 10; i++) {
        const angle = (Math.PI * 2 * i) / 10 + (Math.random() * 0.3 - 0.15)
        const speed = Math.random() * 2.8 + 1.2
        const col = PALETTE[i % PALETTE.length]
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 2.6 + 1.2,
          color: col,
          life: 1.0,
          decay: Math.random() * 0.022 + 0.015,
        })
      }
      wakeLoop()
    }

    // Dedicated Touch event handlers for mobile devices (iPhone, Android, Tablets)
    let isTouchActive = false

    const handleTouchStart = (e) => {
      isTouchActive = true
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]
        addPoint(t.clientX, t.clientY, true)
        addShockwave(t.clientX, t.clientY)
      }
    }

    const handleTouchMove = (e) => {
      isTouchActive = true
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i]
        addPoint(t.clientX, t.clientY, true)
      }
    }

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        isTouchActive = false
        lastPoint = null
      }
    }

    // Pointer events for desktop mouse move and pen
    const handlePointerMove = (e) => {
      if (e.pointerType === 'touch' || isTouchActive) return
      addPoint(e.clientX, e.clientY, false)
    }

    const handlePointerDown = (e) => {
      if (e.pointerType === 'touch' || isTouchActive) return
      addPoint(e.clientX, e.clientY, false)
      addShockwave(e.clientX, e.clientY)
    }

    const handlePointerUp = (e) => {
      if (e.pointerType === 'touch') return
      lastPoint = null
    }

    function render(time) {
      lastTime = time

      // Reset transform and clear entire viewport
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()

      const now = performance.now()

      // 1. Filter out expired points
      while (points.length > 0 && now - points[0].time > TRAIL_LIFETIME) {
        points.shift()
      }

      // 2. Render Nova shockwaves on tap / click
      for (let i = shockwaves.length - 1; i >= 0; i--) {
        const sw = shockwaves[i]
        sw.radius += (sw.maxRadius - sw.radius) * 0.18 + 0.9
        sw.alpha *= 0.91

        if (sw.alpha < 0.02 || sw.radius >= sw.maxRadius) {
          shockwaves.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
        ctx.lineWidth = 2
        ctx.strokeStyle = `rgba(168, 85, 247, ${sw.alpha * 0.9})`
        ctx.shadowColor = '#06b6d4'
        ctx.shadowBlur = 14
        ctx.stroke()
        ctx.restore()
      }

      // 3. Render Continuous Seamless Cosmic Ribbon
      if (points.length >= 2) {
        // Compute midpoints between all adjacent points so curves join with C1 continuity (no gaps)
        const midpoints = []
        for (let i = 0; i < points.length - 1; i++) {
          midpoints.push({
            x: (points[i].x + points[i + 1].x) / 2,
            y: (points[i].y + points[i + 1].y) / 2,
          })
        }

        // Two passes: (0) Atmospheric outer neon glow, (1) Ultra-bright laser starlight core
        for (let pass = 0; pass < 2; pass++) {
          ctx.save()
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'

          for (let i = 0; i < points.length - 1; i++) {
            const p = points[i]
            const ageProgress = 1 - (now - p.time) / TRAIL_LIFETIME
            if (ageProgress <= 0.02) continue

            // Determine start and end coords for this segment
            const startX = i === 0 ? p.x : midpoints[i - 1].x
            const startY = i === 0 ? p.y : midpoints[i - 1].y
            const ctrlX = p.x
            const ctrlY = p.y
            const endX = i === points.length - 2 ? points[i + 1].x : midpoints[i].x
            const endY = i === points.length - 2 ? points[i + 1].y : midpoints[i].y

            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY)

            const colorIndex = (i * 2) % PALETTE.length
            const c1 = PALETTE[colorIndex]
            const c2 = PALETTE[(colorIndex + 1) % PALETTE.length]

            if (pass === 0) {
              // Outer Cosmic Neon Aura
              const baseWidth = Math.max(2, (ageProgress * 11) + Math.min(p.speed * 0.15, 6))
              ctx.lineWidth = baseWidth
              ctx.strokeStyle = `rgba(${c1.r}, ${c1.g}, ${c1.b}, ${ageProgress * 0.45})`
              ctx.shadowColor = `rgb(${c2.r}, ${c2.g}, ${c2.b})`
              ctx.shadowBlur = 14
            } else {
              // Radiant Inner Laser Core
              ctx.lineWidth = Math.max(1.2, ageProgress * 3.6)
              ctx.strokeStyle = `rgba(255, 255, 255, ${ageProgress * 0.95})`
              ctx.shadowColor = `rgb(${c1.r}, ${c1.g}, ${c1.b})`
              ctx.shadowBlur = 7
            }

            ctx.stroke()
          }

          ctx.restore()
        }

        // Render Constellation Star Nodes along the trail
        ctx.save()
        for (let i = 0; i < points.length; i++) {
          const pt = points[i]
          if (!pt.isStar) continue

          const ageProgress = 1 - (now - pt.time) / TRAIL_LIFETIME
          if (ageProgress <= 0.08) continue

          const starAlpha = ageProgress * 0.95
          const starSize = 2.4 * ageProgress

          // Glow stellar node
          ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`
          ctx.shadowColor = '#38bdf8'
          ctx.shadowBlur = 10
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, starSize, 0, Math.PI * 2)
          ctx.fill()

          // 4-point twinkle cross flare
          if (ageProgress > 0.3) {
            const flareLen = starSize * 3.6
            ctx.strokeStyle = `rgba(168, 85, 247, ${starAlpha * 0.85})`
            ctx.lineWidth = 1.2
            ctx.beginPath()
            ctx.moveTo(pt.x - flareLen, pt.y)
            ctx.lineTo(pt.x + flareLen, pt.y)
            ctx.moveTo(pt.x, pt.y - flareLen)
            ctx.lineTo(pt.x, pt.y + flareLen)
            ctx.stroke()
          }
        }
        ctx.restore()
      }

      // 4. Update and render stardust sparks
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.965
        p.vy *= 0.965
        p.life -= p.decay

        if (p.life <= 0) {
          particles.splice(i, 1)
          continue
        }

        ctx.save()
        ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${p.life * 0.9})`
        ctx.shadowColor = `rgb(${p.color.r}, ${p.color.g}, ${p.color.b})`
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // 5. Idle check — pause render loop when no active elements exist
      if (points.length === 0 && particles.length === 0 && shockwaves.length === 0) {
        isLooping = false
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.restore()
        return
      }

      animationFrameId = requestAnimationFrame(render)
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })
    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handlePointerUp, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-30 select-none"
      style={{ touchAction: 'none' }}
    />
  )
}
