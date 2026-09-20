// ─────────────────────────────────────────────────────────
// Service Worker — Study Time Tracker
// Strategy:
//   • App shell (/, /index.html, /manifest.json, icons) → Cache-First
//   • JS/CSS assets (/assets/*) → Cache-First (immutable, versioned)
//   • Firebase / API network calls → Network-First with cache fallback
//   • Everything else → Network with fallback to cache
// ─────────────────────────────────────────────────────────

const SHELL_CACHE = 'stt-shell-v3'
const ASSET_CACHE = 'stt-assets-v3'

const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/favicon.svg',
  '/silent-presence.wav',
]

// ── Install: pre-cache shell ──────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch((err) => {
        console.warn('[SW] Shell pre-cache partial failure:', err)
      })
    )
  )
})

// ── Activate: delete old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  const CURRENT = new Set([SHELL_CACHE, ASSET_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !CURRENT.has(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

// ── Fetch: smart routing ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET, chrome-extension, devtools, etc.
  if (request.method !== 'GET') return
  if (!url.protocol.startsWith('http')) return

  // Firebase / Firestore / Google APIs → always network first
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('fonts.gstatic.com') ||
    url.hostname.includes('fonts.googleapis.com')
  ) {
    event.respondWith(networkFirst(request, SHELL_CACHE))
    return
  }

  // Vite-built assets (hashed filenames) → cache first, very long TTL
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  // App shell files → cache first
  if (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.wav')
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE))
    return
  }

  // All other same-origin routes (SPA navigation) → return cached index.html
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(request))
    )
    return
  }

  // Default: network with cache fallback
  event.respondWith(networkFirst(request, SHELL_CACHE))
})

// ── Helpers ───────────────────────────────────────────────
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
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response && response.status === 200 && response.type !== 'opaque') {
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await cache.match(request)
    return cached || new Response('Offline', { status: 503 })
  }
}

// ── Notification click ────────────────────────────────────
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
