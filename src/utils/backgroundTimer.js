/**
 * backgroundTimer.js
 * Comprehensive background & lock screen timer support:
 * 1. MediaSession API: Controls on Lock Screen & Top Notification Bar (Play/Pause/Lap)
 * 2. Silent Audio Loop: Keeps background timer running accurately without mobile sleep throttling
 * 3. Screen Wake Lock: Keeps the screen awake during study sessions
 * 4. Floating Picture-in-Picture (PiP): Floating mini-stopwatch on top of any app
 * 5. Dynamic Document Title: Shows running timer in browser tab
 */

// Tiny 1-second silent WAV audio data URI to activate background media session
const SILENT_AUDIO_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

class BackgroundTimerService {
  constructor() {
    this.audio = null
    this.wakeLock = null
    this.pipCanvas = null
    this.pipVideo = null
    this.isPiPActive = false
    this.actionCallbacks = {
      onPlay: null,
      onPause: null,
      onLap: null,
    }
    this.lastState = {
      isRunning: false,
      displayTime: '0:00:00.00',
      subject: '',
      topic: '',
    }

    this._initAudio()
    this._initVisibilityListener()
  }

  _initAudio() {
    try {
      this.audio = new Audio(SILENT_AUDIO_URI)
      this.audio.loop = true
      this.audio.volume = 0.01 // Virtually silent
    } catch (err) {
      console.warn('Audio init error:', err)
    }
  }

  _initVisibilityListener() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        // Re-acquire wake lock if visible and timer is still running
        if (document.visibilityState === 'visible' && this.lastState.isRunning) {
          this.requestWakeLock()
        }
      })
    }
  }

  setCallbacks({ onPlay, onPause, onLap }) {
    this.actionCallbacks = { onPlay, onPause, onLap }
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
    } catch (e) {
      console.warn('MediaSession handler error:', e)
    }
  }

  /**
   * Called whenever stopwatch ticks or state changes.
   */
  update({ isRunning, displayTime, subject = '', topic = '' }) {
    this.lastState = { isRunning, displayTime, subject, topic }

    // 1. Dynamic document title
    if (typeof document !== 'undefined') {
      if (isRunning) {
        document.title = `(${displayTime.split('.')[0]}) Study Tracker`
      } else if (displayTime !== '0:00:00.00') {
        document.title = `(Paused) Study Tracker`
      } else {
        document.title = 'Study Time Tracker'
      }
    }

    // 2. Lock Screen & Notification Shade via MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const titleStr = isRunning
          ? `⏱️ ${displayTime.split('.')[0]}`
          : `⏸️ Paused: ${displayTime.split('.')[0]}`
        const subtitle = subject
          ? `${subject}${topic ? ` · ${topic}` : ''}`
          : 'Study Time Tracker'

        navigator.mediaSession.playbackState = isRunning ? 'playing' : 'paused'
        navigator.mediaSession.metadata = new MediaMetadata({
          title: titleStr,
          artist: subtitle,
          album: isRunning ? '🟢 Live Timer Running' : '⏸️ Timer Paused',
          artwork: [
            { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          ],
        })
      } catch (err) {
        console.warn('MediaSession metadata error:', err)
      }
    }

    // 3. Audio state
    if (this.audio) {
      if (isRunning && this.audio.paused) {
        this.audio.play().catch(() => {
          // Auto-play might require user gesture
        })
      } else if (!isRunning && !this.audio.paused) {
        this.audio.pause()
      }
    }

    // 4. Update PiP canvas if active
    if (this.isPiPActive && this.pipCanvas) {
      this._drawPiPCanvas(displayTime, isRunning, subject, topic)
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

    if (!document.pictureInPictureEnabled) {
      alert('Floating Picture-in-Picture is not supported on this browser.')
      return false
    }

    try {
      if (!this.pipCanvas) {
        this.pipCanvas = document.createElement('canvas')
        this.pipCanvas.width = 360
        this.pipCanvas.height = 180
      }

      if (!this.pipVideo) {
        this.pipVideo = document.createElement('video')
        this.pipVideo.muted = true
        this.pipVideo.playsInline = true
        this.pipVideo.srcObject = this.pipCanvas.captureStream(30)
        this.pipVideo.addEventListener('leavepictureinpicture', () => {
          this.isPiPActive = false
        })
      }

      this._drawPiPCanvas(
        this.lastState.displayTime,
        this.lastState.isRunning,
        this.lastState.subject,
        this.lastState.topic
      )

      await this.pipVideo.play()
      await this.pipVideo.requestPictureInPicture()
      this.isPiPActive = true
      return true
    } catch (err) {
      console.warn('PiP launch error:', err)
      alert('Please start the timer first, then tap Floating Mini Timer!')
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
