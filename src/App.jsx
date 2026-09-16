/**
 * App.jsx — Root with full auth routes.
 */

import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { getSession, clearSession } from './utils/auth'

import Welcome from './pages/Welcome'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Stopwatch from './pages/Stopwatch'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'
import Plan from './pages/Plan'
import Syllabus from './pages/Syllabus'
import DayPlanner from './pages/DayPlanner'
import WatchPartner, { WatchSearch } from './pages/WatchPartner'
import PartnerHistory from './pages/PartnerHistory'
import ActiveTimerBanner from './components/ActiveTimerBanner'

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

        {/* Watch — public (no auth required to watch a partner) */}
        <Route path="/watch" element={<WatchSearch userName={userName} />} />
        <Route path="/watch/:partnerName" element={<WatchPartner />} />

        {/* Partner history — public */}
        <Route path="/partner/:partnerName" element={<PartnerHistory />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to={session ? '/' : '/welcome'} replace />} />
      </Routes>
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
