import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Completely unregister any active service workers and clear cache
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister().catch(() => {})
    }
  }).catch(() => {})
}

if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((keys) => {
    for (const key of keys) {
      caches.delete(key).catch(() => {})
    }
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
