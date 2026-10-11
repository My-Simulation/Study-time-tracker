/**
 * PushNotificationPrompt.jsx
 * Sleek, high-converting in-app prompt for logged-in users to enable
 * Web Push Reminders with a single tap.
 */

import React, { useState, useEffect } from 'react'
import {
  isPushSupported,
  getPushPermissionState,
  isUserSubscribedToPush,
  subscribeUserToPush,
} from '../utils/pushNotification'

export default function PushNotificationPrompt({ userName }) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!userName || !isPushSupported()) return

    const perm = getPushPermissionState()
    if (perm === 'denied') return

    const cleanUser = userName.trim().toLowerCase()
    const isLocalEnabled = localStorage.getItem(`stt_push_enabled_${cleanUser}`) === 'true'
    if (isLocalEnabled && perm === 'granted') return

    const dismissedUntil = localStorage.getItem(`stt_push_dismissed_${cleanUser}`)
    if (dismissedUntil && Number(dismissedUntil) > Date.now()) return

    // Verify if already subscribed in browser
    isUserSubscribedToPush(userName).then((alreadySubbed) => {
      if (!alreadySubbed) {
        // Show prompt with gentle 1.2s delay so page loads first
        const t = setTimeout(() => setIsVisible(true), 1200)
        return () => clearTimeout(t)
      }
    })
  }, [userName])

  const handleEnable = async () => {
    setIsLoading(true)
    setErrorMessage('')
    try {
      await subscribeUserToPush(userName)
      setSuccess(true)
      setTimeout(() => {
        setIsVisible(false)
      }, 2500)
    } catch (err) {
      console.warn('Push subscribe error:', err)
      setErrorMessage(err.message || 'Could not enable notifications.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    if (userName) {
      const cleanUser = userName.trim().toLowerCase()
      // Snooze for 24 hours
      localStorage.setItem(
        `stt_push_dismissed_${cleanUser}`,
        String(Date.now() + 24 * 60 * 60 * 1000)
      )
    }
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="relative bg-[#13141f]/95 backdrop-blur-xl border border-purple-500/40 rounded-2xl p-4 shadow-[0_12px_40px_rgba(0,0,0,0.7)] flex flex-col gap-3">
        {/* Glow ambient background */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-purple-500/15 blur-2xl pointer-events-none rounded-full" />

        <div className="flex items-start gap-3">
          {/* Bell Icon with glowing pulse */}
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-xl flex-shrink-0 shadow-inner">
            <span className="animate-bounce">🔔</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>Daily Study & Streak Alert</span>
                <span className="text-[10px] font-mono bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded-full border border-purple-500/30">
                  NEW
                </span>
              </h4>
              <button
                onClick={handleDismiss}
                className="text-gray-400 hover:text-white text-base leading-none p-1 transition-colors"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1 leading-relaxed">
              Jab aap 1 din padhai miss karoge, JeetPrep aapke phone par gentle reminder bhejega taaki streak aur time table na tute!
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="text-[11px] text-rose-300 bg-rose-950/40 border border-rose-500/30 px-2.5 py-1.5 rounded-lg">
            {errorMessage}
          </p>
        )}

        {success ? (
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-2 px-3 rounded-xl text-center flex items-center justify-center gap-1.5">
            <span>✓</span>
            <span>Reminders Enabled! Lock screen alerts active.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleEnable}
              disabled={isLoading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Turn On Reminders</span>
                </>
              )}
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-2.5 text-xs text-gray-400 hover:text-white rounded-xl transition-colors font-medium"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
