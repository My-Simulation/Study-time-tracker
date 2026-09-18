/**
 * ShareCardModal.jsx — Shareable study summary graphic card
 * Generates an aesthetic WhatsApp / Instagram story card using html2canvas & Web Share API
 */

import React, { useRef, useState } from 'react'
import { formatHoursMinutes, formatDuration } from '../utils/formatTime'

export default function ShareCardModal({
  isOpen,
  onClose,
  userName,
  todayStudiedSec,
  dayNum,
  streakCount,
  dayPlan,
  activeSubject,
}) {
  const cardRef = useRef(null)
  const [downloading, setDownloading] = useState(false)
  const [shared, setShared] = useState(false)

  if (!isOpen) return null

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2.5,
        useCORS: true,
        logging: false,
      })
      const image = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = image
      link.download = `StudyCard_${userName}_${new Date().toISOString().slice(0, 10)}.png`
      link.click()
    } catch (err) {
      console.error('Download card error:', err)
      alert('Could not download image. Please take a screenshot!')
    } finally {
      setDownloading(false)
    }
  }

  const handleNativeShare = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#0a0a0a',
        scale: 2.5,
        useCORS: true,
      })
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], `study-streak-${userName}.png`, { type: 'image/png' })
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${userName}'s Study Streak`,
            text: `Studied ${formatHoursMinutes(todayStudiedSec)} today on Day ${dayNum}! 🔥`,
            files: [file],
          })
          setShared(true)
        } else {
          // Fallback to regular download
          handleDownload()
        }
      }, 'image/png')
    } catch (e) {
      console.warn('Share error:', e)
      handleDownload()
    } finally {
      setDownloading(false)
    }
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl max-w-sm w-full p-5 flex flex-col items-center gap-4 shadow-2xl">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="text-sm font-bold text-white">Share Your Focus Card</h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-[#202020] text-gray-400 hover:text-white flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* ── Visual Card to Capture ── */}
        <div
          ref={cardRef}
          className="w-full rounded-2xl p-5 text-white flex flex-col justify-between relative overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #111116 0%, #171526 50%, #0d131f 100%)',
            border: '1.5px solid rgba(139, 92, 246, 0.35)',
            boxShadow: '0 8px 32px rgba(124, 58, 237, 0.25)',
            minHeight: '340px',
          }}
        >
          {/* Subtle glow circle in background */}
          <div
            className="absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: '#7c3aed' }}
          />
          <div
            className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full blur-3xl opacity-30 pointer-events-none"
            style={{ background: '#06b6d4' }}
          />

          {/* Card Top */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center font-black text-base shadow-md border border-white/20">
                {(userName[0] || 'U').toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-black text-white capitalize">@{userName}</p>
                <p className="text-[10px] text-gray-400 font-mono">{todayFormatted}</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-purple-500/20 border border-purple-500/40 px-2.5 py-1 rounded-full text-[11px] font-black text-purple-300">
              <span>DAY {dayNum}</span>
            </div>
          </div>

          {/* Card Center: Time & Flame */}
          <div className="relative z-10 my-6 text-center flex flex-col items-center">
            <span className="text-[10px] font-bold tracking-widest text-purple-300 uppercase">
              STUDY TIME LOGGED
            </span>
            <div className="text-4xl font-black tracking-tight text-white font-mono mt-1 drop-shadow-md">
              {formatDuration(todayStudiedSec)}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm">🔥</span>
              <span className="text-xs font-bold text-amber-300 font-mono">
                {streakCount > 0 ? `${streakCount} Day Study Streak` : 'Consistency is Key'}
              </span>
            </div>
          </div>

          {/* Card Bottom: Subjects / Topics & App Watermark */}
          <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-[11px]">
            <div className="truncate max-w-[170px]">
              <span className="text-gray-400 block text-[9px] uppercase font-bold">Focus</span>
              <span className="font-semibold text-gray-200 truncate block">
                {activeSubject || dayPlan?.goals?.[0] || 'Deep Work Session'}
              </span>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                ⚡ Self-Study Tracker
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 w-full mt-1">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              disabled={downloading}
              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>🚀</span>
              <span>{shared ? 'Shared!' : 'Share to WhatsApp / Insta'}</span>
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-2.5 rounded-xl bg-[#222] hover:bg-[#2c2c2c] border border-[#333] text-gray-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <span>📥</span>
            <span>{downloading ? 'Generating...' : 'Save PNG Image'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
