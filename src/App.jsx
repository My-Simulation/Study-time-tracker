/**
 * App.jsx — Root with full auth routes.
 */

import React, { useState, useEffect, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getSession, clearSession } from './utils/auth'

import Stopwatch from './pages/Stopwatch'
import ActiveTimerBanner from './components/ActiveTimerBanner'

// Route-level code splitting: loads pages on-demand instead of blocking the initial app load
const Welcome = lazy(() => import('./pages/Welcome'))
const SignIn = lazy(() => import('./pages/SignIn'))
const SignUp = lazy(() => import('./pages/SignUp'))
const History = lazy(() => import('./pages/History'))
const HistoryDetail = lazy(() => import('./pages/HistoryDetail'))
const Plan = lazy(() => import('./pages/Plan'))
const Syllabus = lazy(() => import('./pages/Syllabus'))
const DayPlanner = lazy(() => import('./pages/DayPlanner'))
const WatchPartner = lazy(() => import('./pages/WatchPartner'))
const PartnerHistory = lazy(() => import('./pages/PartnerHistory'))
const WatchSearch = lazy(() => import('./pages/WatchPartner').then(m => ({ default: m.WatchSearch })))
const Analytics = lazy(() => import('./pages/Analytics'))
const Profile = lazy(() => import('./pages/Profile'))

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

  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <BrowserRouter>
      <AnimatedRoutes />
    </BrowserRouter>
  )
}
