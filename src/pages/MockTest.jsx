/**
 * MockTest.jsx — CBT Mock Test Series Hub with Difficulty Filters & External Paper Importer
 * Features:
 * - Authentic IBPS RRB Clerk Memory-Based Papers (Simple, Moderate, Tough)
 * - Difficulty Filter Tabs (All | 🟢 Simple | 🟡 Moderate | 🔴 Tough)
 * - ⚡ AI Instant Mock Generator (Gemini 2.5)
 * - 📥 Import External Test (Paste PDF / Question Paper text from Testbook / Adda247)
 * - Test History & Overall Stats
 */

import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PRELOADED_MOCK_TESTS } from '../utils/mockTestData.js'
import { getUserMockAttempts } from '../utils/mockTestFirestore.js'
import { generateAiMockTest } from '../utils/mockAiGenerator.js'
import { getGeminiApiKey } from '../utils/aiService.js'
import { getSession } from '../utils/auth.js'

const EXAM_CATEGORIES = [
  { id: 'all', label: '🌐 All Exams' },
  { id: 'banking', label: '🏛️ Banking (RRB / SBI / PO)' },
  { id: 'ssc', label: '📋 SSC (CGL / CHSL / GD)' },
  { id: 'engineering', label: '⚛️ Engineering (JEE Main)' },
  { id: 'medical', label: '🩺 Medical (NEET UG)' },
  { id: 'teaching', label: '👨‍🏫 Teaching (CTET / TET)' },
  { id: 'state_police', label: '👮 State & Police (UP / State)' },
  { id: 'defense', label: '🎖️ Defense (NDA / CDS)' },
]

const EXAM_PRESETS = [
  'IBPS RRB Clerk',
  'IBPS RRB PO / Officer',
  'SBI Clerk / PO',
  'SSC CGL',
  'SSC CHSL',
  'JEE Main (PCM)',
  'NEET UG (PCB)',
  'CTET Paper-1 (Primary)',
  'UP Police Constable / SI',
  'State PSC (UPPSC / BPSC / RAS)',
  'UPSC NDA / CDS',
  'Railway RRB NTPC',
]

const SUBJECT_PRESETS = [
  'Quantitative Aptitude (Maths)',
  'Speed Maths & Simplification',
  'Reasoning Ability',
  'General Awareness & Current Affairs',
  'English Language & Comprehension',
  'सामान्य हिन्दी (General Hindi)',
  'Child Development & Pedagogy (CDP)',
  'Environmental Studies (EVS)',
  'Physics (भौतिक विज्ञान)',
  'Chemistry (रसायन विज्ञान)',
  'Biology (जीव विज्ञान - Botany & Zoology)',
  'Higher Mathematics (11th-12th)',
]

export default function MockTest() {
  const navigate = useNavigate()
  const session = getSession()
  const userName = session?.username || ''

  // Main Tabs: 'catalog' | 'ai_generator' | 'import_paper' | 'history'
  const [activeTab, setActiveTab] = useState('catalog')
  const [selectedCategory, setSelectedCategory] = useState('all') // 'all' | 'banking' | 'ssc' | 'engineering' | 'medical' | 'teaching' | 'state_police' | 'defense'
  const [difficultyFilter, setDifficultyFilter] = useState('all') // 'all' | 'simple' | 'moderate' | 'tough'
  const [searchQuery, setSearchQuery] = useState('')
  const [pastAttempts, setPastAttempts] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // AI Generator Form State
  const [selectedExam, setSelectedExam] = useState('IBPS RRB Clerk')
  const [selectedSubject, setSelectedSubject] = useState('Quantitative Aptitude')
  const [customTopic, setCustomTopic] = useState('Simplification & Number Series')
  const [selectedDifficulty, setSelectedDifficulty] = useState('moderate')
  const [questionCount, setQuestionCount] = useState(15)
  const [durationMins, setDurationMins] = useState(15)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatorError, setGeneratorError] = useState('')

  // External Paper Import State
  const [importText, setImportText] = useState('')
  const [importExamTitle, setImportExamTitle] = useState('RRB Clerk 2024 Memory-Based Shift Paper')
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState('')

  useEffect(() => {
    setIsLoadingHistory(true)
    getUserMockAttempts(userName)
      .then((data) => setPastAttempts(data || []))
      .catch((err) => console.warn(err))
      .finally(() => setIsLoadingHistory(false))
  }, [userName])

  // Filter Catalog by Search Query, Category & Difficulty
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return PRELOADED_MOCK_TESTS.filter((t) => {
      const matchCat = selectedCategory === 'all' || t.categoryKey === selectedCategory
      const matchDiff = difficultyFilter === 'all' || t.difficulty === difficultyFilter

      let matchSearch = true
      if (q) {
        const titleMatch = (t.title || '').toLowerCase().includes(q)
        const examMatch = (t.examName || '').toLowerCase().includes(q)
        const catMatch = (t.category || '').toLowerCase().includes(q)
        const descMatch = (t.description || '').toLowerCase().includes(q)
        const sectionMatch = (t.sections || []).some((s) => (s.name || '').toLowerCase().includes(q))
        matchSearch = titleMatch || examMatch || catMatch || descMatch || sectionMatch
      }

      return matchCat && matchDiff && matchSearch
    })
  }, [selectedCategory, difficultyFilter, searchQuery])

  // Stats
  const totalMocks = pastAttempts.length
  const avgAccuracy =
    totalMocks > 0
      ? Math.round(
          pastAttempts.reduce((sum, a) => sum + (Number(a.accuracy) || 0), 0) / totalMocks
        )
      : 0
  const bestScore =
    totalMocks > 0
      ? Math.max(...pastAttempts.map((a) => Number(a.score) || 0))
      : 0
  const totalMockMinutes =
    totalMocks > 0
      ? Math.round(
          pastAttempts.reduce(
            (sum, a) => sum + ((a.timeTakenSeconds || a.totalDurationMinutes * 60 || 0) / 60),
            0
          )
        )
      : 0

  // AI Generator Submit
  const handleGenerateAiTest = async (e) => {
    e.preventDefault()
    setIsGenerating(true)
    setGeneratorError('')

    try {
      const diffLabel =
        selectedDifficulty === 'simple'
          ? 'Simple (Direct, formula-based & speed drill)'
          : selectedDifficulty === 'tough'
          ? 'Tough (High-calculative, multi-concept Advanced level)'
          : 'Moderate (Real Exam Standard Shift Paper)'

      const generatedTest = await generateAiMockTest({
        examName: selectedExam,
        subject: selectedSubject,
        topic: customTopic.trim() || 'Prelims Drill',
        questionCount: Number(questionCount) || 15,
        durationMinutes: Number(durationMins) || 15,
        difficulty: diffLabel,
      })

      navigate(`/mock-test/${generatedTest.id}`, {
        state: { customTest: generatedTest },
      })
    } catch (err) {
      console.error(err)
      setGeneratorError(err.message || 'Failed to generate AI Mock Test. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  // Parse & Import External Paper Text
  const handleImportExternalPaper = async (e) => {
    e.preventDefault()
    if (!importText.trim()) {
      setImportError('Please paste the questions text from Testbook / Adda247 or your PDF.')
      return
    }

    const apiKey = getGeminiApiKey()
    if (!apiKey) {
      setImportError('Gemini API key is required to parse external question paper text.')
      return
    }

    setIsImporting(true)
    setImportError('')

    const parsePrompt = `You are an expert CBT Test Parser.
The user has provided raw text copied from an external competitive exam question paper / memory-based PDF (e.g. Testbook, Adda247, Oliveboard).

RAW TEXT:
"""
${importText.slice(0, 8000)}
"""

TASK: Extract every single multiple-choice question from this text and return a structured JSON matching this schema:
{
  "title": "${importExamTitle.trim() || 'Imported Memory-Based CBT Mock'}",
  "examName": "IBPS RRB Clerk / Banking",
  "category": "Quantitative Aptitude & Reasoning",
  "difficulty": "moderate",
  "durationMinutes": 20,
  "totalMarks": 20,
  "marksPerCorrect": 1,
  "negativeMarks": 0.25,
  "sections": [
    { "id": "sec_imp_1", "name": "General Section", "questionCount": 10, "timeLimitMinutes": 20 }
  ],
  "questions": [
    {
      "id": "q_imp_1",
      "sectionId": "sec_imp_1",
      "questionText": "...",
      "questionTextHi": "...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "optionsHi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
      "correctOption": 0,
      "explanation": "...",
      "explanationHi": "..."
    }
  ]
}

Return ONLY valid JSON (no markdown ticks, no preamble).`

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: parsePrompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 6000 },
        }),
      })

      if (!response.ok) throw new Error('Failed to parse question paper with AI.')
      const json = await response.json()
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        parsed.id = `imported_${Date.now()}`
        parsed.totalQuestions = parsed.questions.length
        parsed.totalMarks = parsed.questions.length
        if (parsed.sections?.[0]) parsed.sections[0].questionCount = parsed.questions.length
        navigate(`/mock-test/${parsed.id}`, { state: { customTest: parsed } })
      } else {
        throw new Error('No valid questions could be detected in the pasted text.')
      }
    } catch (err) {
      console.error(err)
      setImportError(err.message || 'Could not parse text. Ensure questions and options are clearly visible.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-200 antialiased pb-20 selection:bg-purple-500/30">
      {/* ── Top Header Bar ── */}
      <header className="sticky top-0 z-30 bg-[#12121a]/95 backdrop-blur-md border-b border-[#242436] px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/stopwatch')}
              className="p-1.5 rounded-lg bg-[#1a1a26] hover:bg-[#252538] text-gray-400 hover:text-white transition-colors"
              title="Back to Stopwatch"
            >
              ←
            </button>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                <span>📝 All-India CBT Mock Series</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                  TCS iON Testbook Style
                </span>
              </h1>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                JEE Main, NEET UG, CTET Teaching, State Police (UP/State), Banking (RRB/SBI) & SSC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('import_paper')}
              className="px-3 py-1.5 rounded-xl bg-[#1e1e2d] hover:bg-[#28283d] text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>📥</span>
              <span className="hidden sm:inline">Import External Paper</span>
            </button>

            <button
              onClick={() => setActiveTab('ai_generator')}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡</span>
              <span className="hidden sm:inline">AI Mock Generator</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* ── Top Stats ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#14141e] border border-[#232334] shadow-sm">
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">MOCKS ATTEMPTED</span>
            <span className="text-xl sm:text-2xl font-black text-white font-mono">{totalMocks}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#14141e] border border-[#232334] shadow-sm">
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">AVERAGE ACCURACY</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {avgAccuracy}%
            </span>
          </div>
          <div className="p-4 rounded-2xl bg-[#14141e] border border-[#232334] shadow-sm">
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">BEST SCORE</span>
            <span className="text-xl sm:text-2xl font-black text-purple-400 font-mono">{bestScore}</span>
          </div>
          <div className="p-4 rounded-2xl bg-[#14141e] border border-[#232334] shadow-sm">
            <span className="text-[11px] text-gray-400 font-semibold block mb-1">TOTAL TEST TIME</span>
            <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono">
              {totalMockMinutes} <span className="text-xs text-gray-400">mins</span>
            </span>
          </div>
        </section>

        {/* ── Tabs Bar ── */}
        <div className="flex items-center gap-2 border-b border-[#242436] pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#151522] text-gray-400 hover:text-white border border-[#252538]'
            }`}
          >
            📚 Shift-Wise Papers ({PRELOADED_MOCK_TESTS.length})
          </button>
          <button
            onClick={() => setActiveTab('ai_generator')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai_generator'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#151522] text-gray-400 hover:text-white border border-[#252538]'
            }`}
          >
            <span>⚡</span>
            <span>AI Mock Generator</span>
          </button>
          <button
            onClick={() => setActiveTab('import_paper')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'import_paper'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#151522] text-gray-400 hover:text-white border border-[#252538]'
            }`}
          >
            <span>📥</span>
            <span>Import External Paper</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'history'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#151522] text-gray-400 hover:text-white border border-[#252538]'
            }`}
          >
            📊 My Attempts ({pastAttempts.length})
          </button>
        </div>

        {/* ── TAB 1: PRELOADED MOCK CATALOG + SEARCH & FILTERS ── */}
        {activeTab === 'catalog' && (
          <div className="space-y-4 animate-fadeIn">
            {/* ── Search Bar ── */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by exam name, paper, subject, or topic (e.g. JEE, NEET, CTET, UP Police, Banking, SSC, NDA, Hindi)..."
                className="w-full pl-10 pr-10 py-3 rounded-2xl bg-[#14141e] border border-[#242436] text-white placeholder-gray-500 text-xs sm:text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-white text-xs cursor-pointer font-bold"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* ── Exam Category Filter Pills ── */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              {EXAM_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id
                const count =
                  cat.id === 'all'
                    ? PRELOADED_MOCK_TESTS.length
                    : PRELOADED_MOCK_TESTS.filter((t) => t.categoryKey === cat.id).length

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/30'
                        : 'bg-[#14141e] text-gray-400 hover:text-white border border-[#242436]'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/20 text-white font-extrabold'
                          : 'bg-[#202030] text-gray-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* ── Sub-Filter Bar for Difficulty ── */}
            <div className="flex items-center justify-between gap-3 flex-wrap p-3 rounded-2xl bg-[#14141e] border border-[#232334]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400">Filter Level:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'all', label: 'All Levels' },
                    { id: 'simple', label: '🟢 Simple (Speed Drill & Basics)' },
                    { id: 'moderate', label: '🟡 Moderate (Exam Shift Standard)' },
                    { id: 'tough', label: '🔴 Tough (Calculative & Advanced)' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setDifficultyFilter(f.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        difficultyFilter === f.id
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-[#1b1b28] text-gray-400 hover:text-white border border-[#2c2c3e]'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-gray-500 font-mono">
                Showing {filteredCatalog.length} tests
              </span>
            </div>

            {/* Test Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCatalog.map((test) => {
                const isSimple = test.difficulty === 'simple'
                const isModerate = test.difficulty === 'moderate'
                const isTough = test.difficulty === 'tough'

                let diffBadge = (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    🟢 Simple Speed Drill
                  </span>
                )
                if (isModerate) {
                  diffBadge = (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      🟡 Moderate (Exam Standard)
                    </span>
                  )
                } else if (isTough) {
                  diffBadge = (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      🔴 Tough (Calculative & Mains)
                    </span>
                  )
                }

                return (
                  <div
                    key={test.id}
                    className="p-6 rounded-3xl bg-[#14141e] border border-[#242436] hover:border-purple-500/40 transition-all shadow-md flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                            {test.examName}
                          </span>
                          {diffBadge}
                        </div>

                        <span className="text-[11px] text-gray-400 font-mono">
                          ⏱️ {test.durationMinutes} mins • {test.totalMarks} Marks
                        </span>
                      </div>

                      <h3 className="text-base font-extrabold text-white">{test.title}</h3>
                      <p className="text-xs text-gray-400 mt-1 leading-relaxed">{test.description}</p>

                      {/* Sections breakdown */}
                      {test.sections && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-3">
                          {test.sections.map((sec, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#1d1d2b] text-gray-300 border border-[#2e2e42]"
                            >
                              {sec.name} ({sec.questionCount} Qs)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-[#232334] flex items-center justify-between">
                      <div className="text-[11px] text-gray-400">
                        {test.negativeMarks > 0 ? (
                          <>
                            Right: <strong className="text-emerald-400">+{test.marksPerCorrect}</strong> | Wrong:{' '}
                            <strong className="text-rose-400">-{test.negativeMarks}</strong>
                          </>
                        ) : (
                          <>
                            Right: <strong className="text-emerald-400">+{test.marksPerCorrect}</strong> |{' '}
                            <strong className="text-emerald-300">No Negative Marking (0)</strong>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/mock-test/${test.id}`)}
                        className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-transform active:scale-95 shadow-md shadow-purple-600/25 cursor-pointer"
                      >
                        Attempt Test ➔
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Empty Search Result State */}
            {filteredCatalog.length === 0 && (
              <div className="text-center py-12 px-4 rounded-3xl bg-[#14141e] border border-[#242436] space-y-3">
                <div className="text-3xl">🔍</div>
                <h3 className="text-base font-bold text-white">
                  No exams found matching "{searchQuery}"
                </h3>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  Try searching with another keyword or generate an instant AI mock test for this exact exam!
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCategory('all')
                      setDifficultyFilter('all')
                    }}
                    className="px-4 py-2 rounded-xl bg-[#1f1f2e] text-gray-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExam(searchQuery || 'SSC CGL')
                      setActiveTab('ai_generator')
                    }}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer shadow-md shadow-purple-600/30"
                  >
                    ⚡ Generate with AI
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: AI INSTANT MOCK GENERATOR WITH TOUGH/MODERATE/SIMPLE SELECTOR ── */}
        {activeTab === 'ai_generator' && (
          <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#14141e] border border-[#242436] shadow-xl space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <span>⚡</span> AI Exam Blueprint Engine (Gemini 2.5)
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                Generate Authentic AI Mock Test (Any Exam)
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Matches the exact TCS iON / NTA question blueprint for JEE Main, NEET UG, CTET, UP Police, Banking, SSC, or Defense.
              </p>
            </div>

            {generatorError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
                {generatorError}
              </div>
            )}

            <form onSubmit={handleGenerateAiTest} className="space-y-4 text-xs">
              {/* Difficulty Level Selector */}
              <div>
                <label className="block text-gray-300 font-bold mb-1.5">Choose Difficulty Level:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'simple', label: '🟢 Simple', desc: 'Speed Drill & Basics' },
                    { id: 'moderate', label: '🟡 Moderate', desc: 'Exam Shift Standard' },
                    { id: 'tough', label: '🔴 Tough', desc: 'Calculative & Advanced' },
                  ].map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDifficulty(d.id)}
                      className={`p-3 rounded-xl border text-center font-bold transition-all cursor-pointer ${
                        selectedDifficulty === d.id
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-sm'
                          : 'bg-[#181826] border-[#26263a] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs">{d.label}</span>
                      <span className="text-[10px] text-gray-500 font-normal">{d.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Exam Selection */}
              <div>
                <label className="block text-gray-300 font-bold mb-1.5">Target Exam:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {EXAM_PRESETS.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setSelectedExam(ex)}
                      className={`p-2.5 rounded-xl border text-left font-semibold transition-all cursor-pointer ${
                        selectedExam === ex
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                          : 'bg-[#181826] border-[#26263a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Selection */}
              <div>
                <label className="block text-gray-300 font-bold mb-1.5">Subject Section:</label>
                <div className="grid grid-cols-2 gap-2">
                  {SUBJECT_PRESETS.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSelectedSubject(sub)}
                      className={`p-2.5 rounded-xl border text-left font-semibold transition-all cursor-pointer ${
                        selectedSubject === sub
                          ? 'bg-purple-600/20 border-purple-500 text-purple-200'
                          : 'bg-[#181826] border-[#26263a] text-gray-400 hover:text-white'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specific Topic Input */}
              <div>
                <label className="block text-gray-300 font-bold mb-1">
                  Specific Topic / Focus Area (Optional):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Approximation, Quadratic Equations, Tabular DI, Profit & Loss"
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="w-full p-3 rounded-xl bg-[#181826] border border-[#2a2a3e] text-white placeholder-gray-500 text-xs focus:border-purple-500 outline-none"
                />
              </div>

              {/* Questions & Time */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-gray-300 font-bold mb-1">Questions Count:</label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#181826] border border-[#2a2a3e] text-white text-xs outline-none focus:border-purple-500"
                  >
                    <option value={10}>10 Questions (Quick Practice)</option>
                    <option value={15}>15 Questions (Standard Speed Drill)</option>
                    <option value={20}>20 Questions (Shift Section)</option>
                    <option value={25}>25 Questions (Full Section Mock)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-300 font-bold mb-1">Time Limit:</label>
                  <select
                    value={durationMins}
                    onChange={(e) => setDurationMins(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#181826] border border-[#2a2a3e] text-white text-xs outline-none focus:border-purple-500"
                  >
                    <option value={12}>12 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={20}>20 Minutes</option>
                    <option value={25}>25 Minutes</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Setting Exam Questions via AI…</span>
                  </>
                ) : (
                  <>
                    <span>Generate & Start CBT Test Now</span>
                    <span>➔</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB 3: IMPORT EXTERNAL TEST / RAW PDF TEXT ── */}
        {activeTab === 'import_paper' && (
          <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-[#14141e] border border-[#242436] shadow-xl space-y-6 animate-fadeIn">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <span>📥</span> External Paper Importer
              </span>
              <h2 className="text-lg sm:text-xl font-black text-white mt-1">
                Convert Any Testbook / Adda247 Paper into Live CBT Test
              </h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Aapke paas Testbook, Adda247, Guidely ya kisi teacher ki Memory-Based PDF hai? Uska text yahan paste karein. AI parser 5 second mein options, correct answer aur solutions alag karke live test bana dega!
              </p>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
                {importError}
              </div>
            )}

            <form onSubmit={handleImportExternalPaper} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-300 font-bold mb-1">Test Title:</label>
                <input
                  type="text"
                  value={importExamTitle}
                  onChange={(e) => setImportExamTitle(e.target.value)}
                  placeholder="e.g. IBPS RRB Clerk 2024 Shift-1 Memory Based Paper"
                  className="w-full p-3 rounded-xl bg-[#181826] border border-[#2a2a3e] text-white placeholder-gray-500 text-xs focus:border-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1">
                  Paste Questions Text (with Options & Answer Key):
                </label>
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`Paste text here... Example:\nQ1. What is 25% of 800 + 40?\n(a) 240 (b) 220 (c) 250 (d) 260\nAnswer: (a)\nSolution: 200 + 40 = 240`}
                  className="w-full p-3 rounded-xl bg-[#181826] border border-[#2a2a3e] text-white placeholder-gray-500 text-xs font-mono focus:border-cyan-500 outline-none leading-relaxed"
                />
                <span className="text-[11px] text-gray-500 mt-1 block">
                  Tip: You can copy entire pages directly from any PDF reader and paste here.
                </span>
              </div>

              <button
                type="submit"
                disabled={isImporting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-sm shadow-xl shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Parsing Questions & Creating CBT Test…</span>
                  </>
                ) : (
                  <>
                    <span>Convert into CBT Test & Start</span>
                    <span>➔</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB 4: MY ATTEMPTS HISTORY ── */}
        {activeTab === 'history' && (
          <div className="space-y-4 animate-fadeIn">
            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-gray-400 font-mono">
                Loading your previous mock reports…
              </div>
            ) : pastAttempts.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-[#14141e] border border-[#242436] space-y-3">
                <span className="text-4xl">📝</span>
                <h3 className="text-base font-bold text-white">No Mock Tests Attempted Yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Attempt your first standard CBT mock or generate an AI mock test to see your Rank, Accuracy, and Sectional table here.
                </p>
                <button
                  onClick={() => setActiveTab('catalog')}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Explore Shift-Wise Tests
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {pastAttempts.map((att) => (
                  <div
                    key={att.id}
                    className="p-5 rounded-2xl bg-[#14141e] border border-[#242436] hover:border-[#383852] transition-all flex items-center justify-between gap-4 flex-wrap"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 font-mono">
                          {att.examName}
                        </span>
                        <span className="text-[11px] text-gray-400">{att.date}</span>
                      </div>
                      <h4 className="text-sm font-extrabold text-white">{att.testTitle}</h4>
                      <div className="flex items-center gap-3 text-xs text-gray-400 font-mono mt-1">
                        <span>Score: <strong className="text-purple-400">{att.score}/{att.maxMarks}</strong></span>
                        <span>•</span>
                        <span>Accuracy: <strong className="text-emerald-400">{att.accuracy}%</strong></span>
                        <span>•</span>
                        <span>Percentile: <strong className="text-indigo-400">{att.percentile}%</strong></span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/mock-result/${att.id}`, { state: { attemptData: att } })
                      }
                      className="px-4 py-2 rounded-xl bg-[#1c1c2a] hover:bg-purple-600 text-purple-300 hover:text-white border border-[#2d2d42] hover:border-purple-500 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Performance Report</span>
                      <span>➔</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
