/**
 * backgroundTimer.js
 * Clean, lightweight background & lock screen timer support:
 * 1. MediaSession API: Live Controllable widget on Lock Screen (Play/Pause/Lap)
 * 2. Silent PCM Audio: Real WAV audio stream keeping mobile audio engine & MediaSession active in background
 * 3. Screen Wake Lock: Keeps the screen awake during study sessions
 * 4. Floating Picture-in-Picture (PiP): Floating mini-stopwatch with graceful iOS support
 * 5. Dynamic Document Title: Shows running timer in browser tab
 */

import { formatTime } from './formatTime'

class BackgroundTimerService {
  constructor() {
    this.audio = null
    this.wakeLock = null
    this.pipCanvas = null
    this.pipVideo = null
    this.isPiPActive = false
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
    this._initVisibilityListener()
  }

  _initAudio() {
    try {
      // 1-second silent WAV base64: ensures zero network delay and reliable playback on mobile browsers
      const SILENT_WAV_BASE64 =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      this.audio = new Audio(SILENT_WAV_BASE64)
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
   * Primary state coordinator: keeps background ticks running accurately
   */
  setTimerState({ isRunning, startTimestamp, baseElapsed, subject, topic }) {
    this.timerState.isRunning = Boolean(isRunning)
    this.timerState.startTimestamp = startTimestamp ? Number(startTimestamp) : null
    this.timerState.baseElapsed = Number(baseElapsed) || 0
    if (subject !== undefined) this.timerState.subject = subject
    if (topic !== undefined) this.timerState.topic = topic

    if (this.timerState.isRunning && this.timerState.startTimestamp) {
      if (!this.fallbackInterval) {
        this.fallbackInterval = setInterval(() => this._handleBackgroundTick(), 1000)
      }
    } else {
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

    if (!this.timerState.isRunning && this.timerState.baseElapsed === 0) {
      this.closeAndroidNotification()
    }
  }

  /**
   * Background tick loop: executed by audio timeupdate or fallback interval.
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
    try {
      const isRunning = this.timerState.isRunning
      const subject = this.timerState.subject || ''
      const topic = this.timerState.topic || ''
      this.lastState = { isRunning, displayTime, elapsed, subject, topic }

      const rawTime = typeof displayTime === 'string' && displayTime ? displayTime : formatTime(Number(elapsed) || 0)
      const timeFormatted = rawTime.includes('.') ? rawTime.split('.')[0] : rawTime
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const subtitle = subject
        ? `${subject}${topic ? ` · ${topic}` : ''}`
        : 'Study Time Tracker'

      // 1. Dynamic document title
      if (typeof document !== 'undefined') {
        if (isRunning) {
          document.title = `(${timeFormatted}) Study Tracker`
        } else if (rawTime !== '0:00:00.00' && rawTime !== '0:00:00') {
          document.title = `(Paused) Study Tracker`
        } else {
          document.title = 'Study Time Tracker'
        }
      }

      // 2. Lock Screen via MediaSession
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata !== 'undefined') {
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

          if ('setPositionState' in navigator.mediaSession) {
            try {
              const elapsedSec = Math.floor((Number(elapsed) || 0) / 1000)
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

      // 3. Update PiP canvas if active
      if (this.isPiPActive && this.pipCanvas) {
        this._drawPiPCanvas(rawTime, isRunning, subject, topic)
      }

      // 4. Android Status Bar & Lock Screen persistent notification
      this._updateAndroidNotification(timeFormatted, isRunning, subtitle)
    } catch (outerErr) {
      console.warn('renderMedia error:', outerErr)
    }
  }

  /**
   * Pinned, silent notification on Android (Status bar + Lock screen)
   */
  async _updateAndroidNotification(timeFormatted, isRunning, subtitle) {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const isAndroid = /android/i.test(navigator.userAgent)
    if (!isAndroid) return // Keep clean on iOS

    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.showNotification) {
        const titleStr = isRunning ? `⏱️ ${timeFormatted}` : `⏸️ Paused: ${timeFormatted}`
        const bodyStr = isRunning
          ? `🟢 Running · ${subtitle}`
          : `⏸️ Paused · ${subtitle}`

        await reg.showNotification(titleStr, {
          body: bodyStr,
          tag: 'stt_timer',
          renotify: false,
          silent: true,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
        })
      }
    } catch (e) {
      // ignore
    }
  }

  /**
   * Closes the Android timer notification
   */
  async closeAndroidNotification() {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg && reg.getNotifications) {
        const notifs = await reg.getNotifications({ tag: 'stt_timer' })
        notifs.forEach((n) => n.close())
      }
    } catch (e) {}
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
