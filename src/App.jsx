/**
 * App.jsx
 * Root component — routing, auth guard, global layout.
 */

import React, { useState, useEffect } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useLocation,
} from 'react-router-dom'

import Login from './pages/Login'
import Stopwatch from './pages/Stopwatch'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'
import Plan from './pages/Plan'
import WatchPartner, { WatchSearch } from './pages/WatchPartner'
import PartnerHistory from './pages/PartnerHistory'

function RequireAuth({ children }) {
  const userName = localStorage.getItem('studyTrackerUser')
  if (!userName) return <Navigate to="/login" replace />
  return children
}

function AnimatedRoutes() {
  const location = useLocation()
  const userName = localStorage.getItem('studyTrackerUser') || ''

  return (
    <div key={location.pathname} style={{ animation: 'fadeIn 150ms ease-out' }}>
      <Routes location={location}>
        {/* Auth */}
        <Route path="/login" element={<Login />} />

        {/* Main timer */}
        <Route path="/" element={<RequireAuth><Stopwatch userName={userName} /></RequireAuth>} />

        {/* History */}
        <Route path="/history" element={<RequireAuth><History userName={userName} /></RequireAuth>} />
        <Route path="/history/:date" element={<RequireAuth><HistoryDetail userName={userName} /></RequireAuth>} />

        {/* Weekly plan */}
        <Route path="/plan" element={<RequireAuth><Plan userName={userName} /></RequireAuth>} />

        {/* Watch partner */}
        <Route path="/watch" element={<RequireAuth><WatchSearch userName={userName} /></RequireAuth>} />
        <Route path="/watch/:partnerName" element={<RequireAuth><WatchPartner /></RequireAuth>} />

        {/* Partner history */}
        <Route path="/partner/:partnerName" element={<RequireAuth><PartnerHistory /></RequireAuth>} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
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
