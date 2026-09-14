/**
 * App.jsx
 * Root component — handles routing, auth guard, and global layout.
 * Auth is name-based via localStorage ("studyTrackerUser").
 */

import React, { useState, useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'

import Login from './pages/Login'
import Stopwatch from './pages/Stopwatch'
import History from './pages/History'
import HistoryDetail from './pages/HistoryDetail'

// ── Auth guard ───────────────────────────────────────────────────────────────
function RequireAuth({ children }) {
  const userName = localStorage.getItem('studyTrackerUser')
  if (!userName) {
    return <Navigate to="/login" replace />
  }
  return children
}

// ── Animated wrapper (simple fade) ──────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()
  const userName = localStorage.getItem('studyTrackerUser') || ''

  return (
    <div
      key={location.pathname}
      style={{ animation: 'fadeIn 150ms ease-out' }}
    >
      <Routes location={location}>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Stopwatch (home) */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Stopwatch userName={userName} />
            </RequireAuth>
          }
        />

        {/* History list */}
        <Route
          path="/history"
          element={
            <RequireAuth>
              <History userName={userName} />
            </RequireAuth>
          }
        />

        {/* History detail for a specific date */}
        <Route
          path="/history/:date"
          element={
            <RequireAuth>
              <HistoryDetail userName={userName} />
            </RequireAuth>
          }
        />

        {/* Catch-all → home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

// ── App root ─────────────────────────────────────────────────────────────────
export default function App() {
  // Force re-render when localStorage changes (Switch User)
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
