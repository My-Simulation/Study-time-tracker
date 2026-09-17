import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Purge any stale cache storage from earlier service worker versions
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    for (const key of keys) {
      if (key !== 'stt-nocache-v2') {
        caches.delete(key)
      }
    }
  }).catch(() => {})
}

// Register Service Worker for PWA installability
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      reg.update().catch(() => {})
    }).catch((err) => {
      console.warn('Service worker registration failed:', err)
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
