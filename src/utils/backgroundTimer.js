/**
 * backgroundTimer.js
 * Comprehensive background & lock screen timer support:
 * 1. MediaSession API: Live Controllable widget on Lock Screen & Notification Drawer (Play/Pause/Lap)
 * 2. Silent PCM Audio: Real WAV audio stream keeping mobile audio engine & MediaSession active in background
 * 3. Dedicated Web Worker: Ticks every second independently of UI thread / rAF so timer never freezes when minimized
 * 4. Audio timeupdate backup: Native media engine events drive ticks even during extreme OS battery throttling
 * 5. Screen Wake Lock: Keeps the screen awake during study sessions
 * 6. Floating Picture-in-Picture (PiP): Floating mini-stopwatch with graceful iOS support
 * 7. Dynamic Document Title: Shows running timer in browser tab
 * 8. Status Bar Notifications: Periodic silent in-place notification updates via Service Worker
 */

import { formatTime } from './formatTime'

class BackgroundTimerService {
  constructor() {
    this.audio = null
    this.wakeLock = null
    this.pipCanvas = null
    this.pipVideo = null
    this.isPiPActive = false
    this.activeNotification = null
    this.worker = null
    this.fallbackInterval = null
    this.lastProcessedSecond = -1

    this.actionCallbacks = {
      onPlay: null,
      onPause: null,
      onLap: null,
      onTick: null,
    }

    this.timerState = {
      isRunning: false,
      startTimestamp: null,
      baseElapsed: 0,
      subject: '',
      topic: '',
    }

    this.lastState = {
      isRunning: false,
      displayTime: '0:00:00.00',
      elapsed: 0,
      subject: '',
      topic: '',
    }

    this._initAudio()
    this._initWorker()
    this._initVisibilityListener()
  }

  _initAudio() {
    try {
      this.audio = new Audio('/silent-presence.wav')
      this.audio.loop = true
      this.audio.volume = 0.05
      // Audio timeupdate fires every ~250ms natively in background while audio plays
      this.audio.addEventListener('timeupdate', () => {
        this._handleBackgroundTick()
      })
    } catch (err) {
      console.warn('Audio init error:', err)
    }
  }

  _initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') return
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'start') {
            if (!timer) {
              timer = setInterval(function() {
                self.postMessage('tick');
              }, 1000);
            }
          } else if (e.data === 'stop') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        };
      `
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      this.worker = new Worker(URL.createObjectURL(blob))
      this.worker.onmessage = (e) => {
        if (e.data === 'tick') {
          this._handleBackgroundTick()
        }
      }
    } catch (err) {
      console.warn('Background Worker init error:', err)
    }
  }

  _initVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && this.timerState.isRunning) {
          this._handleBackgroundTick()
        } else if (document.visibilityState === 'visible') {
          if (this.timerState.isRunning) {
            this.requestWakeLock()
          }
        }
      })
    }
  }

  setCallbacks({ onPlay, onPause, onLap, onTick }) {
    this.actionCallbacks = {
      onPlay: onPlay || this.actionCallbacks.onPlay,
      onPause: onPause || this.actionCallbacks.onPause,
      onLap: onLap || this.actionCallbacks.onLap,
      onTick: onTick || this.actionCallbacks.onTick,
    }
    this._setupMediaSessionHandlers()
  }

  _setupMediaSessionHandlers() {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        if (this.actionCallbacks.onPlay) this.actionCallbacks.onPlay()
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        if (this.actionCallbacks.onPause) this.actionCallbacks.onPause()
      })
      navigator.mediaSession.setActionHandler('stop', () => {
        if (this.actionCallbacks.onPause) this.actionCallbacks.onPause()
      })
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (this.actionCallbacks.onLap) this.actionCallbacks.onLap()
      })
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (this.actionCallbacks.onLap) this.actionCallbacks.onLap()
      })
    } catch (e) {
      console.warn('MediaSession handler error:', e)
    }
  }

  /**
   * Starts the background audio. MUST be called synchronously inside a user click handler (e.g. Start button).
   */
  startAudio() {
    try {
      if (!this.audio) this._initAudio()
      if (this.audio) {
        this.audio.currentTime = 0
        const p = this.audio.play()
        if (p !== undefined) {
          p.catch((err) => {
            console.warn('Audio play error:', err)
          })
        }
      }
    } catch (e) {
      console.warn('startAudio error:', e)
    }

    // Ask for notification permission if not yet decided
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }

  /**
   * Pauses the background audio.
   */
  pauseAudio() {
    if (this.audio) {
      try {
        this.audio.pause()
      } catch (e) {}
    }
  }

  /**
   * Primary state coordinator: keeps background workers ticking accurately
   */
  setTimerState({ isRunning, startTimestamp, baseElapsed, subject, topic }) {
    this.timerState.isRunning = Boolean(isRunning)
    this.timerState.startTimestamp = startTimestamp ? Number(startTimestamp) : null
    this.timerState.baseElapsed = Number(baseElapsed) || 0
    if (subject !== undefined) this.timerState.subject = subject
    if (topic !== undefined) this.timerState.topic = topic

    if (this.timerState.isRunning && this.timerState.startTimestamp) {
      if (this.worker) this.worker.postMessage('start')
      if (!this.fallbackInterval) {
        this.fallbackInterval = setInterval(() => this._handleBackgroundTick(), 1000)
      }
    } else {
      if (this.worker) this.worker.postMessage('stop')
      if (this.fallbackInterval) {
        clearInterval(this.fallbackInterval)
        this.fallbackInterval = null
      }
    }

    const currentElapsed = this.timerState.isRunning && this.timerState.startTimestamp
      ? this.timerState.baseElapsed + Math.max(0, Date.now() - this.timerState.startTimestamp)
      : this.timerState.baseElapsed
    const formatted = formatTime(currentElapsed)
    this._renderMediaAndNotifications(formatted, currentElapsed)
  }

  /**
   * Background tick loop: executed by Web Worker, audio timeupdate, or fallback interval.
   * Runs continuously even when app is minimized or phone is locked!
   */
  _handleBackgroundTick() {
    if (!this.timerState.isRunning || !this.timerState.startTimestamp) return
    const now = Date.now()
    const elapsed = this.timerState.baseElapsed + Math.max(0, now - this.timerState.startTimestamp)
    const sec = Math.floor(elapsed / 1000)

    if (sec === this.lastProcessedSecond) return
    this.lastProcessedSecond = sec

    const displayTime = formatTime(elapsed)
    this._renderMediaAndNotifications(displayTime, elapsed)

    if (this.actionCallbacks.onTick) {
      this.actionCallbacks.onTick(elapsed, displayTime)
    }
  }

  /**
   * Called whenever stopwatch ticks or state changes.
   */
  update({ isRunning, displayTime, elapsed = 0, subject, topic }) {
    if (isRunning !== undefined) this.timerState.isRunning = Boolean(isRunning)
    if (subject !== undefined) this.timerState.subject = subject
    if (topic !== undefined) this.timerState.topic = topic

    this._renderMediaAndNotifications(
      displayTime || this.lastState.displayTime,
      elapsed !== undefined ? elapsed : this.lastState.elapsed
    )
  }

  _renderMediaAndNotifications(displayTime, elapsed) {
    const isRunning = this.timerState.isRunning
    const subject = this.timerState.subject
    const topic = this.timerState.topic
    this.lastState = { isRunning, displayTime, elapsed, subject, topic }

    const timeFormatted = displayTime.split('.')[0]
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const subtitle = subject
      ? `${subject}${topic ? ` · ${topic}` : ''}`
      : 'Study Time Tracker'

    // 1. Dynamic document title
    if (typeof document !== 'undefined') {
      if (isRunning) {
        document.title = `(${timeFormatted}) Study Tracker`
      } else if (displayTime !== '0:00:00.00') {
        document.title = `(Paused) Study Tracker`
      } else {
        document.title = 'Study Time Tracker'
      }
    }

    // 2. Lock Screen & Notification Shade via MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const titleStr = isRunning ? `⏱️ ${timeFormatted}` : `⏸️ Paused: ${timeFormatted}`

        navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused'
        navigator.mediaSession.metadata = new MediaMetadata({
          title: titleStr,
          artist: subtitle,
          album: isRunning ? '🟢 Live Timer Running' : '⏸️ Timer Paused',
          artwork: [
            { src: `${origin}/icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${origin}/icon-512.png`, sizes: '512x512', type: 'image/png' },
          ],
        })

        // Position state for hardware media lock screen progress bar ticking
        if ('setPositionState' in navigator.mediaSession) {
          try {
            const elapsedSec = Math.floor(elapsed / 1000)
            navigator.mediaSession.setPositionState({
              duration: 86400,
              playbackRate: isRunning ? 1.0 : 0.0,
              position: Math.min(86400, elapsedSec),
            })
          } catch (e) {}
        }
      } catch (err) {
        console.warn('MediaSession metadata error:', err)
      }
    }

    // 3. Status Bar Notification (for Android / Desktop / PWA while minimized)
    if (
      typeof document !== 'undefined' &&
      document.visibilityState === 'hidden' &&
      isRunning
    ) {
      this._updateNotification(
        `⏱️ ${timeFormatted} · Timer Running`,
        `${subtitle} is active. Tap to return to app.`,
        origin
      )
    }

    // 4. Update PiP canvas if active
    if (this.isPiPActive && this.pipCanvas) {
      this._drawPiPCanvas(displayTime, isRunning, subject, topic)
    }
  }

  _updateNotification(title, body, origin) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const options = {
      body,
      icon: `${origin}/icon-192.png`,
      badge: `${origin}/icon-192.png`,
      tag: 'stt-active-timer',
      renotify: false,
      silent: true,
    }

    // Priority 1: ServiceWorkerRegistration (required on mobile Chrome / Android)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, options).catch(() => {})
        })
        .catch(() => {})
    } else {
      // Priority 2: Standard Notification constructor (Desktop Safari / Firefox)
      try {
        this.activeNotification = new Notification(title, options)
      } catch (e) {}
    }
  }

  /**
   * Request Screen Wake Lock so phone screen doesn't turn off
   */
  async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen')
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null
          })
        }
      } catch (err) {
        console.warn('Wake Lock error:', err)
      }
    }
  }

  /**
   * Release Wake Lock
   */
  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release()
      } catch {}
      this.wakeLock = null
    }
  }

  /**
   * Picture-in-Picture Floating Mini-Stopwatch Widget
   */
  async togglePictureInPicture() {
    if (typeof document === 'undefined') return false

    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture()
        this.isPiPActive = false
        return false
      } catch (err) {
        console.warn('Exit PiP error:', err)
      }
    }

    // iOS WebKit check: Apple iOS strictly restricts PiP to native video files and blocks canvas streams
    const isIOS = typeof navigator !== 'undefined' && (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    )

    if (isIOS) {
      alert(
        '📱 iPhone / iOS Note:\n\n' +
        'Apple iOS does not allow web browsers to pop out floating PiP windows for custom canvas timers.\n\n' +
        '✨ Good news: Your timer is ALREADY active on your iPhone Lock Screen and Notification Center! You can lock your phone or swipe down from the top to see and control the live timer.'
      )
      return false
    }

    if (!document.pictureInPictureEnabled) {
      alert(
        'Floating Picture-in-Picture is not supported by this browser.\n\n' +
        '💡 Don\'t worry: Your timer will still run continuously on your Lock Screen and in the Notification Bar!'
      )
      return false
    }

    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas')
        this.pipCanvas.width = 360
        this.pipCanvas.height = 180
      }

      this._drawPiPCanvas(
        this.lastState.displayTime,
        this.lastState.isRunning,
        this.lastState.subject,
        this.lastState.topic
      )

      if (!this.pipVideo) {
        this.pipVideo = document.createElement('video')
        this.pipVideo.id = 'stt-pip-video'
        this.pipVideo.muted = true
        this.pipVideo.playsInline = true
        this.pipVideo.style.position = 'fixed'
        this.pipVideo.style.width = '1px'
        this.pipVideo.style.height = '1px'
        this.pipVideo.style.opacity = '0'
        this.pipVideo.style.pointerEvents = 'none'
        this.pipVideo.style.bottom = '0'
        this.pipVideo.style.right = '0'
        document.body.appendChild(this.pipVideo)

        this.pipVideo.addEventListener('leavepictureinpicture', () => {
          this.isPiPActive = false
        })
      }

      this.pipVideo.srcObject = this.pipCanvas.captureStream(30)
      await this.pipVideo.play()
      await this.pipVideo.requestPictureInPicture()
      this.isPiPActive = true
      return true
    } catch (err) {
      console.warn('PiP launch error:', err)
      alert(
        `Could not open Floating PiP window: ${err?.message || 'Permission denied'}.\n\n` +
        `💡 Tip: Lock your screen or check your notification shade — the live timer is running there!`
      )
      return false
    }
  }

  _drawPiPCanvas(displayTime, isRunning, subject, topic) {
    if (!this.pipCanvas) return
    const ctx = this.pipCanvas.getContext('2d')
    const w = this.pipCanvas.width
    const h = this.pipCanvas.height

    // Background
    ctx.fillStyle = '#0f0f13'
    ctx.fillRect(0, 0, w, h)

    // Border glowing gradient
    ctx.lineWidth = 4
    ctx.strokeStyle = isRunning ? '#8b5cf6' : '#ec4899'
    ctx.strokeRect(2, 2, w - 4, h - 4)

    // Status dot
    ctx.fillStyle = isRunning ? '#22c55e' : '#f59e0b'
    ctx.beginPath()
    ctx.arc(24, 28, 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = 'bold 13px sans-serif'
    ctx.fillStyle = '#9ca3af'
    ctx.fillText(isRunning ? 'STUDYING' : 'PAUSED', 38, 32)

    if (subject) {
      ctx.font = 'bold 12px sans-serif'
      ctx.fillStyle = '#c084fc'
      const subText = topic ? `${subject}: ${topic}` : subject
      ctx.fillText(subText.slice(0, 22), w - 150, 32)
    }

    // Big digital stopwatch numbers
    ctx.font = 'bold 44px monospace'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.fillText(displayTime.split('.')[0], w / 2, 100)

    // Milliseconds
    const ms = displayTime.split('.')[1] || '00'
    ctx.font = '20px monospace'
    ctx.fillStyle = '#8b5cf6'
    ctx.fillText(`.${ms}`, w / 2 + 115, 100)

    // Bottom hint
    ctx.font = '11px sans-serif'
    ctx.fillStyle = '#6b7280'
    ctx.fillText(
      isRunning ? '⏱️ Background active · Lock screen controls on' : 'Tap play in app or lock screen to resume',
      w / 2,
      155
    )
    ctx.textAlign = 'start'
  }
}

export const backgroundTimer = new BackgroundTimerService()
