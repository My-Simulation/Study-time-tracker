/**
 * AICoachDrawer.jsx
 * Interactive AI Study Mentor Drawer.
 * Evaluates live user study data, analyzes strengths/weaknesses, and answers questions.
 */

import React, { useState, useEffect, useRef } from 'react'
import {
  chatWithAIMentor,
  getRemainingDailyQuota,
  getGeminiApiKey,
  getCustomGeminiApiKey,
  hasCustomGeminiApiKey,
  setGeminiApiKey,
  hasGeminiApiKey,
} from '../utils/aiService'

const QUICK_PROMPTS = [
  { label: '📊 Analyze My Progress', prompt: 'Mera recent study performance analyze karke batao, mai kaisa chal raha hu?' },
  { label: '⚖️ Neglected Subjects', prompt: 'Maine pichle 14 din me kaunsa subject sabse kam padha hai aur kya karna chahiye?' },
  { label: '🔥 Streak & Consistency', prompt: 'Mera streak kaisa chal raha hai aur mai consistency kaise maintain karu?' },
  { label: '💡 Quick Study Tips', prompt: 'Exam me retention aur focus badhane ke liye 3 practical tips do.' },
]

export default function AICoachDrawer({ isOpen, onClose, userContext }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: `👋 **Namaste ${userContext?.displayName || userContext?.userName || 'Aspirant'}!**\n\nMai aapka **AI Study Mentor** hu. Maine aapka study account, streaks, aur subject history review kar li hai.\n\nAap mujhse apne performance ke baare me pooch sakte hain ya neeche diye kisi topic par click karein!`,
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState(() => getRemainingDailyQuota())
  const [showSettings, setShowSettings] = useState(false)
  const [customKey, setCustomKey] = useState(() => getCustomGeminiApiKey())
  const [keySaved, setKeySaved] = useState(false)

  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  if (!isOpen) return null

  const handleSend = async (textToSend) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const userMsg = { id: `user_${Date.now()}`, role: 'user', text: query }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const reply = await chatWithAIMentor(userContext, messages, query)
      const aiMsg = { id: `ai_${Date.now()}`, role: 'assistant', text: reply }
      setMessages((prev) => [...prev, aiMsg])
      setQuota(getRemainingDailyQuota())
    } catch (err) {
      console.error('Chat error:', err)
      const errorMsg = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        text: `⚠️ ${err?.message || 'Could not connect to AI. Please try again.'}`,
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleSaveKey = (e) => {
    e?.preventDefault()
    setGeminiApiKey(customKey)
    setKeySaved(true)
    setTimeout(() => {
      setKeySaved(false)
      setShowSettings(false)
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fadeIn">
      {/* Drawer Container */}
      <div
        className="w-full max-w-md h-full bg-[#121215] border-l border-[#292934] shadow-2xl flex flex-col justify-between"
        style={{ animation: 'slideLeft 250ms ease-out' }}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#24242e] bg-[#16161c] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-lg shadow-md">
              🤖
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                AI Study Mentor
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              </h3>
              <p className="text-[10px] text-gray-400">
                Synced with @{userContext?.userName} data
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 rounded-lg bg-[#1e1e26] hover:bg-[#282833] text-gray-400 hover:text-white transition-colors text-xs"
              title="API Settings"
            >
              ⚙️
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-[#1e1e26] hover:bg-[#282833] text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Optional Custom API Key Settings Banner */}
        {showSettings && (
          <form onSubmit={handleSaveKey} className="p-3 bg-[#191924] border-b border-[#2d2d3d] flex flex-col gap-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span>🔑</span>
                <span>Google Gemini API Key:</span>
              </span>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-purple-400 hover:underline font-semibold"
              >
                Free aistudio.google.com ↗
              </a>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="Built-in AI active (or paste personal key)"
                className="flex-1 px-3 py-1.5 rounded-xl bg-[#121216] border border-[#333] text-white text-xs outline-none focus:border-purple-500 font-mono"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow transition-colors whitespace-nowrap"
              >
                {keySaved ? 'Saved ✓' : 'Save Key'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 leading-tight">
              Project master AI key already active! Optional: Apna personal key laga sakte hain.
            </p>
          </form>
        )}

        {/* AI Status Pill */}
        <div className="px-3.5 py-1.5 bg-purple-950/20 border-b border-purple-500/15 flex items-center justify-between gap-2">
          <span className="text-[11px] text-purple-200/90 truncate flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{hasCustomGeminiApiKey() ? 'Personal Gemini Key Active' : 'Real Gemini AI Active (Free for All Users)'}</span>
          </span>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="text-[10px] font-bold text-purple-300 bg-purple-500/15 border border-purple-500/25 px-2.5 py-0.5 rounded-full hover:bg-purple-500/30 whitespace-nowrap"
          >
            {showSettings ? 'Close' : '⚙️ Custom Key'}
          </button>
        </div>

        {/* Live Account Highlights Strip */}
        <div className="px-4 py-2 bg-[#17171e] border-b border-[#23232c] flex items-center justify-between text-[11px]">
          <span className="text-gray-400">
            Streak: <strong className="text-orange-400">{userContext?.currentStreak || 0}d 🔥</strong>
          </span>
          <span className="text-gray-400">
            Today: <strong className="text-purple-300">{userContext?.todayStudiedHours || 0}h</strong>
          </span>
          <span className="text-gray-400">
            Status: <strong className={hasGeminiApiKey() ? 'text-emerald-400' : 'text-amber-400'}>{hasGeminiApiKey() ? 'Gemini 1.5 Live' : 'Offline Mode'}</strong>
          </span>
        </div>

        {/* Chat Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.map((m) => {
            const isUser = m.role === 'user'
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    isUser
                      ? 'bg-purple-600 text-white rounded-br-sm shadow-md'
                      : 'bg-[#1a1a22] text-gray-200 border border-[#2b2b38] rounded-bl-sm shadow-sm whitespace-pre-wrap'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            )
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 p-2">
              <span className="w-3 h-3 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
              <span>Analyzing your study records…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="p-2.5 border-t border-[#202028] bg-[#141418] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              type="button"
              disabled={loading}
              onClick={() => handleSend(qp.prompt)}
              className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[#1c1c24] hover:bg-[#252532] text-purple-300 border border-[#2e2e3f] whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer disabled:opacity-50"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form onSubmit={(e) => { e.preventDefault(); handleSend() }} className="p-3 border-t border-[#22222b] bg-[#16161c] flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI Mentor anything about your study..."
            disabled={loading}
            className="flex-1 px-3.5 py-2 rounded-xl bg-[#101014] border border-[#2c2c38] text-white placeholder-gray-500 text-xs outline-none focus:border-purple-500 transition-colors"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white flex items-center justify-center text-xs transition-colors shadow flex-shrink-0 cursor-pointer"
          >
            ➤
          </button>
        </form>
      </div>
    </div>
  )
}
