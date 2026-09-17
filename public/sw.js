// Service Worker for PWA Installation & Background Notification clicks
const CACHE_VERSION = 'stt-nocache-v2';

self.addEventListener('install', (event) => {
  // Immediately take over without waiting
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge ALL old caches to ensure fresh bundles are always fetched directly from Netlify CDN
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    })
  );
  self.clients.claim();
});

// Focus open app window when user taps the background timer notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
});


