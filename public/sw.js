// ─────────────────────────────────────────────────────────
// Service Worker — Study Time Tracker
// Cache Strategy:
//   • HTML / Navigation (/, /index.html, routes) → NETWORK-FIRST
//     (Always get fresh code from server on deploy; fallback to cache only when offline)
//   • Built JS/CSS assets (/assets/*) → CACHE-FIRST
//     (Vite uses immutable content hashes; safe to cache permanently)
//   • Firebase / APIs → NETWORK-FIRST
// ─────────────────────────────────────────────────────────

const CACHE_NAME = 'stt-v9'
const ASSET_CACHE = 'stt-assets-v9'

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg',
  '/silent-presence.wav',
]

// ── Install: pre-cache critical shell ───────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Pre-cache partial failure:', err)
      })
    )
  )
})

// ── Activate: purge ALL old caches ──────────────────────────
self.addEventListener('activate', (event) => {
  const CURRENT = new Set([CACHE_NAME, ASSET_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CURRENT.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch: intelligent routing ──────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return

  // 1. Service worker itself: NEVER cache
  if (url.pathname === '/sw.js') {
    return
  }

  // 2. Firebase, Google APIs, external network requests: Network First
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(networkFirst(request, CACHE_NAME))
    return
  }

  // 3. Vite content-hashed assets: Cache First (fast & safe)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // 4. HTML / Navigation / SPA routes: NETWORK-FIRST ALWAYS
  // This guarantees user always gets latest deploy without stuck cache!
  if (
    request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.origin === self.location.origin && !url.pathname.includes('.')
  ) {
    event.respondWith(networkFirstHTML(request))
    return
  }

  // 5. Static public assets (icons, wav, json, svg): Cache First with network update
  event.respondWith(cacheFirst(request, CACHE_NAME))
})

// ── Helpers ──────────────────────────────────────────────────

// Network-first for HTML pages: fetch latest, fallback to cached index.html if offline
async function networkFirstHTML(request) {
  try {
    const response = await fetch(request)
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_NAME)
      cache.put('/index.html', response.clone())
      return response
    }
    return response
  } catch {
    // Offline fallback
    const cached = await caches.match('/index.html')
    return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return cached || new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type !== 'opaque') {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached || new Response('Offline', { status: 503 })
  }
}

// ── Web Push Event (Background notification from server) ──────────
self.addEventListener('push', (event) => {
  let data = {
    title: '⚡ JeetPrep Study Alert',
    body: 'Aapne aaj apna timer use nahi kara! Daily time table ready karo aur JeetPrep ke sath apne aim tak pahuncho.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'jeetprep-daily-study-reminder',
    url: '/',
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = { ...data, ...payload }
    } catch {
      data.body = event.data.text() || data.body
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [250, 100, 250, 100, 250],
    tag: data.tag || 'jeetprep-reminder',
    renotify: true,
    data: {
      url: data.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      { action: 'start', title: '⏱️ Start Timer' },
      { action: 'planner', title: '📋 Time Table' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  )
})

// ── Notification Click ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const isTimerNotif = event.notification.tag === 'stt_timer'
  const action = event.action

  // If user clicked action buttons on the persistent stopwatch notification (Pause, Resume, Lap)
  if (isTimerNotif && (action === 'pause' || action === 'resume' || action === 'lap')) {
    const isPause = action === 'pause'
    const isResume = action === 'resume'
    let currentTitle = event.notification.title || ''

    if (isPause) {
      if (!currentTitle.includes('(Paused)')) {
        currentTitle = `${currentTitle}  (Paused)`
      }
    } else if (isResume) {
      currentTitle = currentTitle.replace(/\s*\(Paused\)/, '')
    }

    const nextActions = isPause
      ? [
          { action: 'resume', title: 'Resume' },
          { action: 'lap', title: 'Lap' },
        ]
      : [
          { action: 'pause', title: 'Pause' },
          { action: 'lap', title: 'Lap' },
        ]

    // Keep notification alive! Immediately update UI & broadcast action
    event.waitUntil(
      (async () => {
        try {
          await self.registration.showNotification(currentTitle, {
            body: event.notification.body || '',
            tag: 'stt_timer',
            renotify: false,
            silent: true,
            badge: '/icon-192.png',
            actions: nextActions,
            data: event.notification.data || { url: '/' },
          })
        } catch (e) {}

        // 1. BroadcastChannel broadcast (immediate cross-context)
        try {
          const bc = new BroadcastChannel('stt_timer_channel')
          bc.postMessage({ type: 'STT_TIMER_ACTION', action })
          bc.close()
        } catch (e) {}

        // 2. Window client postMessage
        try {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
          if (clients && clients.length > 0) {
            clients.forEach((client) => {
              client.postMessage({
                type: 'STT_TIMER_ACTION',
                action,
              })
            })
          }
        } catch (e) {}
      })()
    )
    return
  }

  // If user clicked the notification card itself or non-timer notifications
  event.notification.close()

  let targetUrl = event.notification.data?.url || '/'
  if (event.action === 'planner') {
    targetUrl = '/plan'
  } else if (event.action === 'start') {
    targetUrl = '/'
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (client.navigate && targetUrl !== '/') client.navigate(targetUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl)
      }
    })
  )
})

