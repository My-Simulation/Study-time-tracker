/**
 * CbtExamPlayer.jsx — Exact 1:1 TCS iON & Testbook Light Theme CBT Interface
 * Clean white/light grey exam environment matching real Indian CBT platforms:
 * - Stage 1: Official Instructions & Declaration
 * - Stage 2: Light Theme Live CBT Exam Player with Section Tabs, Reverse Timer, and Bilingual View
 * - Question Palette Sidebar with 5 Status states (Answered, Not Answered, Review, Visited)
 * - Stage 3: Submit Confirmation & Instant Score Evaluation
 */

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { getMockTestById, PRELOADED_MOCK_TESTS } from '../utils/mockTestData.js'
import { calculateScorecard, saveMockAttempt } from '../utils/mockTestFirestore.js'
import { getSession } from '../utils/auth.js'

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function CbtExamPlayer() {
  const { testId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const session = getSession()
  const userName = session?.username || ''

  const test = useMemo(() => {
    if (location.state?.customTest) return location.state.customTest
    return getMockTestById(testId) || PRELOADED_MOCK_TESTS[0]
  }, [testId, location.state])

  // Stages: 'instructions' | 'exam' | 'submitting'
  const [stage, setStage] = useState('instructions')
  const [hasAgreedTerms, setHasAgreedTerms] = useState(false)
  const [defaultLang, setDefaultLang] = useState('en')
  const [currentLang, setCurrentLang] = useState('en')

  // Exam States
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({}) // { [qId]: optionIndex }
  const [questionStatus, setQuestionStatus] = useState({}) // { [qId]: 'answered' | 'not_answered' | 'review' | 'review_answered' }
  const [timeSpent, setTimeSpent] = useState({})
  const [remainingSeconds, setRemainingSeconds] = useState(test.durationMinutes * 60)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showPaletteMobile, setShowPaletteMobile] = useState(false)

  const activeQuestionTimerRef = useRef(null)
  const currentQ = test.questions?.[currentQuestionIndex] || null

  useEffect(() => {
    setCurrentLang(defaultLang)
  }, [defaultLang])

  // Time spent per question
  useEffect(() => {
    if (stage !== 'exam' || !currentQ) return

    setQuestionStatus((prev) => {
      if (!prev[currentQ.id]) {
        return { ...prev, [currentQ.id]: 'not_answered' }
      }
      return prev
    })

    const interval = setInterval(() => {
      setTimeSpent((prev) => ({
        ...prev,
        [currentQ.id]: (prev[currentQ.id] || 0) + 1,
      }))
    }, 1000)

    return () => clearInterval(interval)
  }, [stage, currentQ?.id])

  // Countdown timer
  useEffect(() => {
    if (stage !== 'exam') return

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitExam(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [stage])

  // Option selection
  const handleSelectOption = (optIdx) => {
    if (!currentQ) return
    setUserAnswers((prev) => ({ ...prev, [currentQ.id]: optIdx }))
    setQuestionStatus((prev) => {
      const isReview = prev[currentQ.id] === 'review' || prev[currentQ.id] === 'review_answered'
      return {
        ...prev,
        [currentQ.id]: isReview ? 'review_answered' : 'answered',
      }
    })
  }

  // Clear Response
  const handleClearResponse = () => {
    if (!currentQ) return
    setUserAnswers((prev) => {
      const next = { ...prev }
      delete next[currentQ.id]
      return next
    })
    setQuestionStatus((prev) => ({
      ...prev,
      [currentQ.id]: 'not_answered',
    }))
  }

  // Save & Next
  const handleSaveAndNext = () => {
    if (!currentQ) return
    if (userAnswers[currentQ.id] !== undefined) {
      setQuestionStatus((prev) => ({ ...prev, [currentQ.id]: 'answered' }))
    } else {
      setQuestionStatus((prev) => ({ ...prev, [currentQ.id]: 'not_answered' }))
    }
    if (currentQuestionIndex < (test.questions?.length || 1) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  // Mark for Review & Next
  const handleMarkForReview = () => {
    if (!currentQ) return
    const hasAns = userAnswers[currentQ.id] !== undefined
    setQuestionStatus((prev) => ({
      ...prev,
      [currentQ.id]: hasAns ? 'review_answered' : 'review',
    }))
    if (currentQuestionIndex < (test.questions?.length || 1) - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  // Jump to specific Question
  const handleJumpToQuestion = (idx) => {
    if (currentQ && !questionStatus[currentQ.id]) {
      setQuestionStatus((prev) => ({ ...prev, [currentQ.id]: 'not_answered' }))
    }
    setCurrentQuestionIndex(idx)
    setShowPaletteMobile(false)
  }

  // Jump to Section
  const handleJumpToSection = (sectionId) => {
    const targetIdx = test.questions?.findIndex((q) => q.sectionId === sectionId)
    if (targetIdx !== -1 && targetIdx !== undefined) {
      handleJumpToQuestion(targetIdx)
    }
  }

  // Submit test
  const handleSubmitExam = async (isAuto = false) => {
    setShowSubmitModal(false)
    setStage('submitting')

    try {
      const attemptData = calculateScorecard(test, userAnswers, timeSpent)
      const attemptId = await saveMockAttempt(userName, attemptData)
      navigate(`/mock-result/${attemptId}`, {
        state: { attemptData },
        replace: true,
      })
    } catch (err) {
      console.error('Error submitting exam:', err)
      navigate('/mocks', { replace: true })
    }
  }

  // Palette counts
  const paletteCounts = useMemo(() => {
    let answered = 0
    let notAnswered = 0
    let review = 0
    let reviewAnswered = 0
    let notVisited = 0

    test.questions?.forEach((q) => {
      const st = questionStatus[q.id]
      if (st === 'answered') answered++
      else if (st === 'not_answered') notAnswered++
      else if (st === 'review') review++
      else if (st === 'review_answered') reviewAnswered++
      else notVisited++
    })

    return { answered, notAnswered, review, reviewAnswered, notVisited }
  }, [test.questions, questionStatus])

  // ─────────────────────────────────────────────────────────────
  // STAGE 1: INSTRUCTIONS (Light Testbook Theme)
  // ─────────────────────────────────────────────────────────────
  if (stage === 'instructions') {
    return (
      <div className="min-h-screen bg-[#f4f6f9] text-gray-800 antialiased font-sans py-8 px-4 sm:px-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header Card */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-xs flex items-center justify-between gap-4 flex-wrap">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#008bd2] bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                {test.examName} CBT Series
              </span>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">{test.title}</h1>
              <p className="text-xs text-gray-500 mt-1">{test.description}</p>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200 font-sans text-xs">
              <div className="text-center px-2">
                <span className="block text-gray-500 text-[10px]">DURATION</span>
                <span className="text-sm font-bold text-gray-800">{test.durationMinutes} Mins</span>
              </div>
              <div className="w-px h-6 bg-gray-300" />
              <div className="text-center px-2">
                <span className="block text-gray-500 text-[10px]">QUESTIONS</span>
                <span className="text-sm font-bold text-gray-800">{test.totalQuestions || test.questions?.length}</span>
              </div>
              <div className="w-px h-6 bg-gray-300" />
              <div className="text-center px-2">
                <span className="block text-gray-500 text-[10px]">MAX MARKS</span>
                <span className="text-sm font-bold text-gray-800">{test.totalMarks}</span>
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-xs space-y-5 text-xs text-gray-700 leading-relaxed">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
              <span>📋 General Instructions & Marking Scheme</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <span className="font-bold text-gray-900 block">Correct Answer:</span>
                  <span className="text-emerald-700 font-bold">+{test.marksPerCorrect || 1} Marks</span>
                </div>
              </div>
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-3">
                <span className="text-2xl">❌</span>
                <div>
                  <span className="font-bold text-gray-900 block">Negative Marking:</span>
                  <span className="text-rose-700 font-bold">
                    -{test.negativeMarks || 0} Marks for each wrong answer
                  </span>
                </div>
              </div>
            </div>

            {/* Sections Breakdown */}
            {test.sections && (
              <div className="space-y-2 pt-2">
                <h3 className="font-bold text-gray-900">Sections Included in Test:</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {test.sections.map((sec, idx) => (
                    <div
                      key={sec.id || idx}
                      className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex justify-between items-center"
                    >
                      <span className="font-semibold text-gray-800">{sec.name}</span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        {sec.questionCount} Qs
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Palette legend */}
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-gray-900">Question Palette Legend (TCS Pattern):</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="w-5 h-5 rounded bg-[#28a745] text-white font-bold flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Answered</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="w-5 h-5 rounded bg-[#dc3545] text-white font-bold flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Not Answered</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="w-5 h-5 rounded bg-[#6f42c1] text-white font-bold flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Marked for Review</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                  <span className="w-5 h-5 rounded bg-white text-gray-600 border border-gray-400 font-bold flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>Not Visited</span>
                </div>
              </div>
            </div>

            {/* Language Selector */}
            <div className="pt-3 border-t border-gray-200 flex items-center justify-between flex-wrap gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-900 mb-1">
                  Choose your default language:
                </label>
                <p className="text-[11px] text-gray-500">
                  (You can switch language per question during the exam as well)
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDefaultLang('en')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    defaultLang === 'en'
                      ? 'bg-[#008bd2] text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setDefaultLang('hi')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    defaultLang === 'hi'
                      ? 'bg-[#008bd2] text-white shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-300'
                  }`}
                >
                  हिन्दी (Hindi)
                </button>
              </div>
            </div>

            {/* Agreement Checkbox */}
            <div className="pt-3 border-t border-gray-200 flex items-start gap-3">
              <input
                type="checkbox"
                id="agree"
                checked={hasAgreedTerms}
                onChange={(e) => setHasAgreedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-[#008bd2] focus:ring-[#008bd2] border-gray-300 cursor-pointer"
              />
              <label htmlFor="agree" className="text-xs text-gray-700 cursor-pointer select-none">
                I have read all instructions. I understand that the test window will be in focus and I declare to attempt the test honestly.
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              onClick={() => navigate('/mocks')}
              className="px-5 py-2.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel & Exit
            </button>

            <button
              disabled={!hasAgreedTerms}
              onClick={() => setStage('exam')}
              className={`px-8 py-3 rounded-lg font-bold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer ${
                hasAgreedTerms
                  ? 'bg-[#008bd2] hover:bg-[#0077b5] text-white active:scale-98'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <span>I am ready to begin</span>
              <span>➔</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // STAGE 2: LIVE CBT EXAM INTERFACE (TCS iON / Testbook Light)
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f4f6f9] text-gray-800 antialiased font-sans flex flex-col justify-between selection:bg-[#008bd2]/20">
      {/* ── Top Header Bar ── */}
      <header className="bg-white border-b border-gray-300 px-4 py-2.5 sticky top-0 z-30 flex items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">📝</span>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-bold text-gray-900 truncate">{test.title}</h1>
            <span className="text-[10px] text-gray-500 font-medium truncate block">
              {test.examName} • Max Marks: {test.totalMarks}
            </span>
          </div>
        </div>

        {/* Section Tabs (Desktop) */}
        <div className="hidden lg:flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
          {test.sections?.map((sec) => {
            const isCurrentSec = currentQ?.sectionId === sec.id
            return (
              <button
                key={sec.id}
                onClick={() => handleJumpToSection(sec.id)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                  isCurrentSec
                    ? 'bg-white text-[#008bd2] shadow-xs border border-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {sec.name}
              </button>
            )
          })}
        </div>

        {/* Countdown Timer & Submit */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Digital Timer */}
          <div
            className={`px-3 py-1 rounded-lg border font-mono font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow-2xs ${
              remainingSeconds < 300
                ? 'bg-rose-50 border-rose-400 text-rose-600 animate-pulse'
                : 'bg-white border-gray-300 text-gray-800'
            }`}
          >
            <span className="text-xs">⏱️</span>
            <span>Time Left: {formatTime(remainingSeconds)}</span>
          </div>

          {/* Mobile Palette Trigger */}
          <button
            onClick={() => setShowPaletteMobile(true)}
            className="lg:hidden px-2.5 py-1.5 rounded-lg bg-gray-100 border border-gray-300 text-gray-700 text-xs font-bold cursor-pointer"
          >
            Palette ({currentQuestionIndex + 1}/{test.questions?.length})
          </button>

          {/* Submit Test Button */}
          <button
            onClick={() => setShowSubmitModal(true)}
            className="px-4 py-1.5 rounded-lg bg-[#28a745] hover:bg-[#218838] text-white font-bold text-xs shadow-xs active:scale-95 cursor-pointer"
          >
            Submit Test
          </button>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Question Box */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-4">
          {/* Section Pills (Mobile) */}
          <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {test.sections?.map((sec) => (
              <button
                key={sec.id}
                onClick={() => handleJumpToSection(sec.id)}
                className={`px-3 py-1 rounded text-xs font-semibold whitespace-nowrap transition-all ${
                  currentQ?.sectionId === sec.id
                    ? 'bg-[#008bd2] text-white'
                    : 'bg-white text-gray-600 border border-gray-300'
                }`}
              >
                {sec.name}
              </button>
            ))}
          </div>

          {/* Question Subheader */}
          <div className="p-3 rounded-lg bg-white border border-gray-200 flex items-center justify-between gap-3 flex-wrap shadow-2xs">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-[#008bd2] font-bold text-xs">
                Question No. {currentQuestionIndex + 1}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                Right: <strong className="text-emerald-600">+{test.marksPerCorrect || 1}</strong> | Negative:{' '}
                <strong className="text-rose-600">-{test.negativeMarks || 0}</strong>
              </span>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded border border-gray-300 text-xs">
              <span className="text-[11px] text-gray-500 px-1.5 hidden sm:inline">View in:</span>
              <button
                type="button"
                onClick={() => setCurrentLang('en')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  currentLang === 'en' ? 'bg-[#008bd2] text-white' : 'text-gray-600'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setCurrentLang('hi')}
                className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition-all ${
                  currentLang === 'hi' ? 'bg-[#008bd2] text-white' : 'text-gray-600'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>

          {/* Question Statement & Options */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-xs space-y-4">
            <div className="text-sm sm:text-base font-medium text-gray-900 leading-relaxed select-none">
              {currentLang === 'hi' && currentQ?.questionTextHi
                ? currentQ.questionTextHi
                : currentQ?.questionText}
            </div>

            {/* 4 Options */}
            <div className="space-y-2.5 pt-2">
              {(() => {
                const optionsList =
                  currentLang === 'hi' && currentQ?.optionsHi ? currentQ.optionsHi : currentQ?.options || []
                return optionsList.map((opt, optIdx) => {
                  const isSelected = userAnswers[currentQ.id] === optIdx
                  return (
                    <label
                      key={optIdx}
                      onClick={() => handleSelectOption(optIdx)}
                      className={`p-3.5 rounded-lg border transition-all flex items-center gap-3.5 cursor-pointer active:scale-99 select-none ${
                        isSelected
                          ? 'bg-blue-50/70 border-[#008bd2] text-gray-900'
                          : 'bg-white border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[11px] flex-shrink-0 transition-colors ${
                          isSelected
                            ? 'border-[#008bd2] bg-[#008bd2] text-white'
                            : 'border-gray-400 text-gray-600 bg-white'
                        }`}
                      >
                        {String.fromCharCode(65 + optIdx)}
                      </div>
                      <span className="text-xs sm:text-sm font-medium leading-relaxed">{opt}</span>
                    </label>
                  )
                })
              })()}
            </div>
          </div>
        </main>

        {/* Right: Question Palette Sidebar (TCS Style) */}
        <aside
          className={`lg:w-80 bg-[#f8f9fa] border-l border-gray-300 flex flex-col justify-between fixed lg:static inset-y-0 right-0 z-40 transition-transform duration-200 ${
            showPaletteMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          {/* Candidate Profile Bar */}
          <div className="p-3.5 bg-white border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#008bd2] text-white font-bold flex items-center justify-center text-xs">
                {userName ? userName[0].toUpperCase() : 'C'}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-gray-900 truncate block">
                  {userName ? `@${userName}` : 'Candidate'}
                </span>
                <span className="text-[10px] text-gray-500">TCS iON CBT Mode</span>
              </div>
            </div>

            <button
              onClick={() => setShowPaletteMobile(false)}
              className="lg:hidden p-1 rounded bg-gray-100 text-gray-500 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Palette Legend */}
          <div className="p-3 bg-white border-b border-gray-200 grid grid-cols-2 gap-2 text-[10px] font-medium text-gray-700">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#28a745] text-white font-bold flex items-center justify-center text-[9px]">
                {paletteCounts.answered}
              </span>
              <span>Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#dc3545] text-white font-bold flex items-center justify-center text-[9px]">
                {paletteCounts.notAnswered}
              </span>
              <span>Not Answered</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-[#6f42c1] text-white font-bold flex items-center justify-center text-[9px]">
                {paletteCounts.review + paletteCounts.reviewAnswered}
              </span>
              <span>Marked for Review</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded bg-white text-gray-600 border border-gray-400 font-bold flex items-center justify-center text-[9px]">
                {paletteCounts.notVisited}
              </span>
              <span>Not Visited</span>
            </div>
          </div>

          {/* Question Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block mb-2.5">
              Question Palette ({test.questions?.length || 0})
            </span>

            <div className="grid grid-cols-5 gap-2">
              {test.questions?.map((q, idx) => {
                const st = questionStatus[q.id]
                const isCurrent = idx === currentQuestionIndex

                let btnBg = 'bg-white text-gray-700 border-gray-300' // not visited
                if (st === 'answered') {
                  btnBg = 'bg-[#28a745] text-white font-bold border-[#28a745]'
                } else if (st === 'not_answered') {
                  btnBg = 'bg-[#dc3545] text-white font-bold border-[#dc3545]'
                } else if (st === 'review' || st === 'review_answered') {
                  btnBg = 'bg-[#6f42c1] text-white font-bold border-[#6f42c1]'
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`h-8 rounded border font-sans text-xs flex items-center justify-center transition-all cursor-pointer relative ${btnBg} ${
                      isCurrent ? 'ring-2 ring-blue-500 ring-offset-1 font-black scale-105 z-10' : ''
                    }`}
                  >
                    {idx + 1}
                    {st === 'review_answered' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 absolute top-0.5 right-0.5" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* ── Bottom Controls Bar ── */}
      <footer className="bg-white border-t border-gray-300 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleMarkForReview}
            className="px-3 py-1.5 rounded bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-semibold transition-all cursor-pointer"
          >
            Mark for Review & Next
          </button>
          <button
            type="button"
            onClick={handleClearResponse}
            className="px-3 py-1.5 rounded bg-white hover:bg-gray-50 border border-gray-300 text-gray-600 text-xs font-semibold transition-all cursor-pointer"
          >
            Clear Response
          </button>
        </div>

        <div className="flex items-center gap-2">
          {currentQuestionIndex > 0 && (
            <button
              type="button"
              onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
              className="px-4 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-all cursor-pointer"
            >
              Previous
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveAndNext}
            className="px-6 py-1.5 rounded bg-[#008bd2] hover:bg-[#0077b5] text-white text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
          >
            Save & Next ➔
          </button>
        </div>
      </footer>

      {/* ── Submit Confirmation Dialog ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white border border-gray-300 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h3 className="text-base font-bold text-gray-900">Confirm Exam Submission</h3>
              <button
                onClick={() => setShowSubmitModal(false)}
                className="w-7 h-7 rounded-full bg-gray-100 text-gray-500 hover:text-gray-900 flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-600">
              Are you sure you want to submit your test? Here is your summary before final submission:
            </p>

            {/* Summary Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span className="block text-gray-500 text-[10px]">TOTAL</span>
                <span className="text-base font-bold text-gray-800">
                  {test.questions?.length || 0}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <span className="block text-emerald-700 text-[10px]">ANSWERED</span>
                <span className="text-base font-bold text-emerald-800">
                  {paletteCounts.answered + paletteCounts.reviewAnswered}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
                <span className="block text-rose-700 text-[10px]">UNANSWERED</span>
                <span className="text-base font-bold text-rose-800">
                  {paletteCounts.notAnswered + paletteCounts.notVisited}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <span className="block text-purple-700 text-[10px]">REVIEW</span>
                <span className="text-base font-bold text-purple-800">
                  {paletteCounts.review + paletteCounts.reviewAnswered}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Resume Test
              </button>
              <button
                type="button"
                onClick={() => handleSubmitExam(false)}
                className="px-6 py-2 rounded-lg bg-[#28a745] hover:bg-[#218838] text-white text-xs font-bold shadow-xs active:scale-98 transition-all cursor-pointer"
              >
                Yes, Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
