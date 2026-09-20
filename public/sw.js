// ─────────────────────────────────────────────────────────
// Service Worker — Study Time Tracker
// Cache Strategy:
//   • HTML / Navigation (/, /index.html, routes) → NETWORK-FIRST
//     (Always get fresh code from server on deploy; fallback to cache only when offline)
//   • Built JS/CSS assets (/assets/*) → CACHE-FIRST
//     (Vite uses immutable content hashes; safe to cache permanently)
//   • Firebase / APIs → NETWORK-FIRST
// ─────────────────────────────────────────────────────────

const CACHE_NAME = 'stt-v6'
const ASSET_CACHE = 'stt-assets-v6'

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

// ── Notification Click ──────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
