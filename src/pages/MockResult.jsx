/**
 * MockResult.jsx — Exact 1:1 Replica of Classplus & Testbook CBT Result Screen
 * Uses the exact clean white/light theme from the user's screenshot:
 * - Top navbar: "Day 1 - Prelims Quant Notebook", Rating stars, "Go to Tests", "Solutions"
 * - Overall Performance Summary: 5 Floating circular badge cards (Rank, Score, Attempted, Accuracy, Percentile)
 * - Sectional Summary Table: Clean white table with colored right-accent pills (Speed Maths, Arithmetic, DI, Overall)
 * - Rank Predictor & Top Rankers
 * - Deep Question-by-Question Solutions Modal/View
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMockAttemptById } from '../utils/mockTestFirestore.js'
import { getSession } from '../utils/auth.js'
import { saveSession } from '../utils/firestoreHelpers.js'
import { todayString } from '../utils/formatTime.js'

function formatSeconds(sec) {
  if (!sec || isNaN(sec)) return '00:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function MockResult() {
  const { attemptId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const userName = session?.username || ''

  const [attempt, setAttempt] = useState(location.state?.attemptData || null)
  const [isLoading, setIsLoading] = useState(!attempt)
  const [activeView, setActiveView] = useState('summary') // 'summary' | 'solutions'
  const [solutionsFilter, setSolutionsFilter] = useState('all') // 'all' | 'correct' | 'incorrect' | 'unattempted'
  const [userRating, setUserRating] = useState(4)
  const [hasAddedToTracker, setHasAddedToTracker] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  useEffect(() => {
    if (attempt) {
      setIsLoading(false)
      return
    }

    if (!attemptId) {
      navigate('/mocks', { replace: true })
      return
    }

    setIsLoading(true)
    getMockAttemptById(attemptId, userName)
      .then((data) => {
        if (data) {
          setAttempt(data)
        } else {
          showToast('Mock attempt not found.')
        }
      })
      .catch((err) => {
        console.error(err)
        showToast('Error loading mock results.')
      })
      .finally(() => setIsLoading(false))
  }, [attemptId, userName, attempt, navigate])

  const handleAddToStudyTracker = async () => {
    if (!userName || hasAddedToTracker || !attempt) return
    const seconds = attempt.timeTakenSeconds || attempt.totalDurationMinutes * 60 || 1500
    try {
      await saveSession({
        userName,
        date: todayString(),
        totalSeconds: seconds,
        totalTime: formatSeconds(seconds),
        subject: attempt.category || 'Mock Test',
        topic: attempt.testTitle || 'CBT Mock Exam',
        notes: `CBT Mock Completed: Score ${attempt.score}/${attempt.maxMarks} (${attempt.accuracy}% Acc)`,
        focusScore: 5,
      })
      setHasAddedToTracker(true)
      showToast('Test duration added to your Study Tracker session! ✅')
    } catch (err) {
      console.warn('Failed to auto-add to study tracker:', err)
      showToast('Could not add to study tracker.')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-gray-800 flex flex-col items-center justify-center font-sans">
        <div className="w-10 h-10 border-4 border-[#008bd2] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm text-gray-600 font-medium">Generating Performance Summary…</p>
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] text-gray-800 flex flex-col items-center justify-center p-6 text-center font-sans">
        <span className="text-4xl mb-3">📄</span>
        <h2 className="text-lg font-bold text-gray-900">Mock Test Result Not Found</h2>
        <p className="text-xs text-gray-500 mt-1 mb-4">The requested attempt may not exist or has been cleared.</p>
        <button
          onClick={() => navigate('/mocks')}
          className="px-5 py-2 rounded-lg bg-[#008bd2] text-white font-bold text-xs shadow hover:bg-[#0077b5]"
        >
          Go to Tests
        </button>
      </div>
    )
  }

  const filteredQuestions = (attempt.questions || []).filter((q) => {
    if (solutionsFilter === 'correct') return q.isCorrect
    if (solutionsFilter === 'incorrect') return q.isAttempted && !q.isCorrect
    if (solutionsFilter === 'unattempted') return !q.isAttempted
    return true
  })

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-gray-800 antialiased font-sans pb-24 selection:bg-[#008bd2]/20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1e293b] text-white px-4 py-2.5 rounded-lg shadow-xl text-xs font-semibold animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* ── Exact Top App Bar (Classplus Header Style) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-8 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => navigate('/mocks')}
              className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Back to Tests"
            >
              ←
            </button>
            <h1 className="text-sm sm:text-base font-bold text-gray-900 truncate">
              {attempt.testTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-4 flex-shrink-0">
            {/* Rating Stars */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              <span className="text-[11px] font-medium">Rate the Test</span>
              <div className="flex text-gray-300 cursor-pointer ml-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    onClick={() => setUserRating(star)}
                    className="hover:scale-125 transition-transform"
                  >
                    {star <= userRating ? (
                      <span className="text-amber-400">★</span>
                    ) : (
                      <span className="text-gray-300">★</span>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/mocks')}
              className="text-xs font-medium text-[#008bd2] hover:underline cursor-pointer"
            >
              Go to Tests
            </button>

            <span className="text-gray-400 text-xs">or</span>

            <button
              type="button"
              onClick={() => setActiveView(activeView === 'solutions' ? 'summary' : 'solutions')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                activeView === 'solutions'
                  ? 'bg-[#008bd2] text-white border-[#008bd2] shadow-sm'
                  : 'bg-white text-[#008bd2] border-[#008bd2] hover:bg-[#008bd2]/5'
              }`}
            >
              {activeView === 'solutions' ? 'Overview' : 'Solutions'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-6">
        {/* Banner: Quick add to Study tracker session */}
        {!hasAddedToTracker && (
          <div className="mb-6 p-3.5 rounded-xl bg-white border border-blue-200/80 shadow-xs flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">⏱️</span>
              <div>
                <p className="text-xs font-bold text-gray-800">Add test duration to your daily study tracker</p>
                <p className="text-[11px] text-gray-500">
                  {formatSeconds(attempt.timeTakenSeconds || attempt.totalDurationMinutes * 60)} study focus will count toward your streak and daily hours.
                </p>
              </div>
            </div>
            <button
              onClick={handleAddToStudyTracker}
              className="px-3.5 py-1.5 rounded-lg bg-[#008bd2] hover:bg-[#0077b5] text-white text-xs font-bold transition-transform active:scale-95 shadow-sm"
            >
              + Log to Study Tracker
            </button>
          </div>
        )}

        {activeView === 'summary' ? (
          <div className="space-y-8 animate-fadeIn">
            {/* ── 1. Overall Performance Summary (Exact Screenshot Style) ── */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-4 tracking-tight">
                Overall Performance Summary
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                {/* 1. Rank Card */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="w-11 h-11 rounded-full bg-[#f43f5e] text-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">
                    🏅
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-gray-900 font-sans">
                        {attempt.rank}
                      </span>
                      <span className="text-xs text-gray-400 font-normal">/ {attempt.totalStudents || 603}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-normal">Rank</span>
                  </div>
                </div>

                {/* 2. Score Card */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="w-11 h-11 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-gray-900 font-sans">
                        {attempt.score}
                      </span>
                      <span className="text-xs text-gray-400 font-normal">/ {attempt.maxMarks}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-normal">Score</span>
                  </div>
                </div>

                {/* 3. Attempted Card */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="w-11 h-11 rounded-full bg-[#06b6d4] text-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">
                    📝
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-gray-900 font-sans">
                        {attempt.attemptedCount}
                      </span>
                      <span className="text-xs text-gray-400 font-normal">/ {attempt.totalQuestions}</span>
                    </div>
                    <span className="text-xs text-gray-500 font-normal">Attempted</span>
                  </div>
                </div>

                {/* 4. Accuracy Card */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="w-11 h-11 rounded-full bg-[#10b981] text-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">
                    🎯
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-lg font-bold text-gray-900 font-sans">
                        {attempt.accuracy}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold">%</span>
                    </div>
                    <span className="text-xs text-gray-500 font-normal">Accuracy</span>
                  </div>
                </div>

                {/* 5. Percentile Card */}
                <div className="bg-white rounded-xl p-3.5 border border-gray-200/80 shadow-xs flex items-center gap-3 hover:shadow-sm transition-shadow col-span-2 sm:col-span-1">
                  <div className="w-11 h-11 rounded-full bg-[#6366f1] text-white flex items-center justify-center flex-shrink-0 text-lg shadow-sm">
                    👥
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-0.5">
                      <span className="text-lg font-bold text-gray-900 font-sans">
                        {attempt.percentile}
                      </span>
                      <span className="text-xs text-gray-500 font-semibold">%</span>
                    </div>
                    <span className="text-xs text-gray-500 font-normal">Percentile</span>
                  </div>
                </div>
              </div>
            </section>

            {/* ── 2. Sectional Summary Table (1:1 Exact Match of Screenshot) ── */}
            <section>
              <h2 className="text-base font-bold text-gray-900 mb-4 tracking-tight">
                Sectional Summary
              </h2>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200 bg-white text-gray-400 font-normal">
                        <th className="py-3 px-6 w-1/4">Section Name</th>
                        <th className="py-3 px-6 w-1/5">Score</th>
                        <th className="py-3 px-6 w-1/5">Attempted</th>
                        <th className="py-3 px-6 w-1/6">Accuracy</th>
                        <th className="py-3 px-6 w-1/5">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(attempt.sectionalSummary || []).map((sec, idx) => (
                        <tr key={sec.sectionId || idx} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-4 px-6 font-semibold text-gray-800 text-xs sm:text-sm">
                            {sec.sectionName}
                          </td>

                          {/* Score Cell with Right Purple Strip */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f5f3ff] border-r-[3.5px] border-[#a855f7] text-xs">
                              <span className="font-bold text-gray-800 font-sans mr-1">{sec.score}</span>
                              <span className="text-gray-400 font-normal">/ {sec.maxScore}</span>
                            </div>
                          </td>

                          {/* Attempted Cell with Right Sky Strip */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f0f9ff] border-r-[3.5px] border-[#0ea5e9] text-xs">
                              <span className="font-bold text-gray-800 font-sans mr-1">{sec.attempted}</span>
                              <span className="text-gray-400 font-normal">/ {sec.totalQuestions}</span>
                            </div>
                          </td>

                          {/* Accuracy Cell with Right Green Strip */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f0fdf4] border-r-[3.5px] border-[#22c55e] text-xs">
                              <span className="font-bold text-gray-800 font-sans">{sec.accuracy}%</span>
                            </div>
                          </td>

                          {/* Time Cell with Right Amber Strip */}
                          <td className="py-4 px-6">
                            <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#fffbeb] border-r-[3.5px] border-[#f59e0b] text-xs">
                              <span className="font-bold text-gray-800 font-sans mr-1">
                                {formatSeconds(sec.timeSpentSeconds)}
                              </span>
                              <span className="text-gray-400 font-normal">/ {sec.timeLimitMinutes} min</span>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {/* Overall Row (Bold, Exact match) */}
                      <tr className="bg-white border-t border-gray-200">
                        <td className="py-4 px-6 font-bold text-gray-900 text-xs sm:text-sm">
                          Overall
                        </td>
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f5f3ff] border-r-[3.5px] border-[#a855f7] text-xs">
                            <span className="font-bold text-gray-900 font-sans mr-1">{attempt.score}</span>
                            <span className="text-gray-400 font-normal">/ {attempt.maxMarks}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f0f9ff] border-r-[3.5px] border-[#0ea5e9] text-xs">
                            <span className="font-bold text-gray-900 font-sans mr-1">{attempt.attemptedCount}</span>
                            <span className="text-gray-400 font-normal">/ {attempt.totalQuestions}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#f0fdf4] border-r-[3.5px] border-[#22c55e] text-xs">
                            <span className="font-bold text-gray-900 font-sans">{attempt.accuracy}%</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center px-3 py-1.5 rounded-sm bg-[#fffbeb] border-r-[3.5px] border-[#f59e0b] text-xs">
                            <span className="font-bold text-gray-900 font-sans mr-1">
                              {formatSeconds(attempt.timeTakenSeconds)}
                            </span>
                            <span className="text-gray-400 font-normal">/ {attempt.totalDurationMinutes} min</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            {/* ── 3. Rank Predictor & Top Rankers Headings ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                <h3 className="text-sm font-bold text-gray-900 mb-2">Rank Predictor</h3>
                <p className="text-xs text-gray-600 mb-3">
                  Based on your score of <strong className="text-gray-900">{attempt.score}</strong> in{' '}
                  {attempt.examName}, your current percentile is{' '}
                  <span className="text-emerald-600 font-bold">{attempt.percentile}%</span>.
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, attempt.percentile)}%` }}
                  />
                </div>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-1">Top Rankers</h3>
                  <p className="text-xs text-gray-500">
                    Compare your speed, accuracy, and section-wise attempts with the batch toppers.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('solutions')}
                  className="mt-3 w-full py-2.5 rounded-lg bg-[#008bd2] hover:bg-[#0077b5] text-white font-semibold text-xs transition-colors cursor-pointer"
                >
                  View Detailed Solutions & Short-Tricks ➔
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── 4. Detailed Solutions Mode (Clean Testbook Layout) ── */
          <div className="space-y-6 animate-fadeIn">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 flex-wrap pb-3 border-b border-gray-200 bg-white p-3 rounded-xl border">
              {[
                { id: 'all', label: `All Questions (${attempt.questions?.length || 0})` },
                { id: 'correct', label: `Correct (${attempt.correctCount})` },
                { id: 'incorrect', label: `Incorrect (${attempt.incorrectCount})` },
                { id: 'unattempted', label: `Unattempted (${attempt.unattemptedCount})` },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setSolutionsFilter(btn.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    solutionsFilter === btn.id
                      ? 'bg-[#008bd2] text-white shadow-xs'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Questions List */}
            <div className="space-y-4">
              {filteredQuestions.map((q) => {
                const isCorrect = q.isCorrect
                const isSkipped = !q.isAttempted

                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-xl bg-white border border-gray-200 shadow-xs space-y-3.5"
                  >
                    {/* Question Header */}
                    <div className="flex items-center justify-between gap-2 flex-wrap border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-sans">
                          Question {q.questionIndex}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{q.sectionName || ''}</span>
                      </div>

                      <div className="flex items-center gap-2 text-xs font-semibold">
                        {isCorrect && (
                          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Correct (+{attempt.marksPerCorrect || 1})
                          </span>
                        )}
                        {!isCorrect && !isSkipped && (
                          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            ✗ Incorrect (-{attempt.negativeMarks || 0})
                          </span>
                        )}
                        {isSkipped && (
                          <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                            — Unattempted (0)
                          </span>
                        )}
                        <span className="text-gray-400 text-xs">
                          ⏱️ {formatSeconds(q.timeSpentSeconds || 0)}
                        </span>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.questionText}</p>
                      {q.questionTextHi && (
                        <p className="text-xs text-gray-600 mt-1 leading-relaxed">{q.questionTextHi}</p>
                      )}
                    </div>

                    {/* Options */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options?.map((opt, optIdx) => {
                        const isCorrectOpt = optIdx === q.correctOption
                        const isUserChoice = optIdx === q.userSelected

                        let optClasses = 'bg-gray-50 border-gray-200 text-gray-700'
                        if (isCorrectOpt) {
                          optClasses = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                        } else if (isUserChoice && !isCorrect) {
                          optClasses = 'bg-rose-50 border-rose-300 text-rose-900 font-semibold'
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-lg border flex items-center justify-between gap-2 text-xs ${optClasses}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-white border border-gray-300 text-gray-700 flex-shrink-0">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="truncate">{opt}</span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              {isCorrectOpt && <span className="text-emerald-600 font-bold">✓ Correct Option</span>}
                              {isUserChoice && !isCorrectOpt && (
                                <span className="text-rose-600 font-bold">Your Answer</span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Explanation */}
                    {(q.explanation || q.explanationHi) && (
                      <div className="p-3.5 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-blue-950 space-y-1 mt-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1">
                          <span>💡</span> Solution & Short-Trick:
                        </span>
                        {q.explanation && <p className="leading-relaxed">{q.explanation}</p>}
                        {q.explanationHi && (
                          <p className="text-blue-900 text-[11px] leading-relaxed pt-1 border-t border-blue-200/50">
                            {q.explanationHi}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
