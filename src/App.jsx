/**
 * App.jsx — Root with full auth routes.
 */

import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getSession, clearSession } from './utils/auth'

import Stopwatch from './pages/Stopwatch'
import DayPlanner from './pages/DayPlanner'
import Plan from './pages/Plan'
import History from './pages/History'
import Profile from './pages/Profile'
import Analytics from './pages/Analytics'
import Welcome from './pages/Welcome'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ActiveTimerBanner from './components/ActiveTimerBanner'
import { getWallpaper, getWallpaperConfig, subscribeToUserWallpaper } from './utils/wallpaperStorage'

// Secondary / public route-level code splitting
const HistoryDetail = lazy(() => import('./pages/HistoryDetail'))
const Syllabus = lazy(() => import('./pages/Syllabus'))
const WatchPartner = lazy(() => import('./pages/WatchPartner'))
const PartnerHistory = lazy(() => import('./pages/PartnerHistory'))
const WatchSearch = lazy(() => import('./pages/WatchPartner').then(m => ({ default: m.WatchSearch })))

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App Error caught by boundary:', error, errorInfo)
  }

  handleReload = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          for (const r of regs) r.unregister()
        })
      }
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const k of keys) caches.delete(k)
        })
      }
    } catch {}
    window.location.href = window.location.pathname + '?v=' + Date.now()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-[#0d0d0d] text-white">
          <div className="text-4xl mb-3">⚠️</div>
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-xs text-gray-400 max-w-sm mb-6">
            An unexpected error occurred while loading this view. Tap below to reload fresh.
          </p>
          <button
            onClick={this.handleReload}
            className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-all shadow-lg"
          >
            ↻ Reload Application
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
    </div>
  )
}

// ── Auth guard ────────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const session = getSession()
  if (!session) return <Navigate to="/welcome" replace />
  return children
}

// ── Public watch pages (no login needed) ─────────────────────────────────────
function PublicWatchSearch() {
  return <WatchSearch userName={null} />
}

function AnimatedRoutes() {
  const location = useLocation()
  const session = getSession()
  const userName = session?.username || ''

  return (
    <div key={location.pathname} style={{ animation: 'fadeIn 150ms ease-out' }}>
      <ActiveTimerBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          {/* Auth pages */}
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/signup" element={<SignUp />} />

          {/* Old /login redirect */}
          <Route path="/login" element={<Navigate to="/signin" replace />} />

          {/* Main app — requires auth */}
          <Route path="/" element={<RequireAuth><Stopwatch userName={userName} /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><History userName={userName} /></RequireAuth>} />
          <Route path="/history/:date" element={<RequireAuth><HistoryDetail userName={userName} /></RequireAuth>} />
          <Route path="/plan" element={<RequireAuth><Plan userName={userName} /></RequireAuth>} />
          <Route path="/planner" element={<RequireAuth><DayPlanner userName={userName} /></RequireAuth>} />
          <Route path="/planner/:date" element={<RequireAuth><DayPlanner userName={userName} /></RequireAuth>} />
          <Route path="/syllabus" element={<RequireAuth><Syllabus userName={userName} /></RequireAuth>} />
          <Route path="/analytics" element={<RequireAuth><Analytics userName={userName} /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile userName={userName} /></RequireAuth>} />

          {/* Watch — public (no auth required to watch a partner) */}
          <Route path="/watch" element={<WatchSearch userName={userName} />} />
          <Route path="/watch/:partnerName" element={<WatchPartner />} />

          {/* Partner history — public */}
          <Route path="/partner/:partnerName" element={<PartnerHistory />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to={session ? '/' : '/welcome'} replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default function App() {
  const [, setTick] = useState(0)
  const session = getSession()
  const userName = session?.username || ''
  const wallpaper = getWallpaper(userName)
  const wallpaperConfig = getWallpaperConfig(userName)

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener('storage', handler)
    window.addEventListener('study_wallpaper_changed', handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener('study_wallpaper_changed', handler)
    }
  }, [])

  useEffect(() => {
    if (!userName) return
    const unsubscribe = subscribeToUserWallpaper(userName, () => {
      setTick((t) => t + 1)
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [userName])

  return (
    <BrowserRouter>
      {/* ── Global Personal Focus Wallpaper Layer across all pages ── */}
      {wallpaper && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
          <div
            className="w-full h-full transition-all duration-500"
            style={{
              backgroundImage: `url(${wallpaper})`,
              backgroundPosition: 'center',
              backgroundSize: wallpaperConfig.fit === 'contain' ? 'contain' : 'cover',
              backgroundRepeat: 'no-repeat',
              filter: wallpaperConfig.blur ? 'blur(6px)' : 'none',
              transform: wallpaperConfig.blur ? 'scale(1.06)' : 'none',
            }}
          />
          {/* Global Dark Focus Dimming Overlay */}
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: wallpaperConfig.dim ?? 0.45 }}
          />
        </div>
      )}
      <div className="relative z-10 min-h-screen">
        <ErrorBoundary>
          <AnimatedRoutes />
        </ErrorBoundary>
      </div>
    </BrowserRouter>
  )
}
