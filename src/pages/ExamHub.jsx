/**
 * ExamHub.jsx — Search-first Govt & Competitive Exam Resource Hub
 * Allows students to search any exam (SSC CGL, UPSC, JEE, NEET, NDA, Banking, Railways)
 * and view authentic verified Syllabus, original PYQs, and Exam Pattern.
 * Includes 1-Click "Import to My Syllabus Tracker" to track preparation progress.
 */

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAM_DATABASE, searchExams } from '../utils/examHubData'
import { fetchExamByAI, getSavedAiExams } from '../utils/examAiSearch'
import { getSession } from '../utils/auth'
import { getSyllabus, saveSyllabus } from '../utils/firestoreHelpers'

const POPULAR_TAGS = ['SSC CGL', 'UPSC CSE', 'JEE Main', 'NEET UG', 'UPSC NDA', 'Banking PO', 'RRB NTPC']

export default function ExamHub() {
  const navigate = useNavigate()
  const session = getSession()
  const userName = session?.username || ''

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExamId, setSelectedExamId] = useState(EXAM_DATABASE[0]?.id || '')
  const [activeTab, setActiveTab] = useState('syllabus') // 'syllabus' | 'pyq' | 'pattern'
  const [isImporting, setIsImporting] = useState(false)
  const [toastMessage, setToastMessage] = useState('')

  // AI Exam Search State
  const [aiExams, setAiExams] = useState(() => getSavedAiExams())
  const [isAiSearching, setIsAiSearching] = useState(false)
  const [aiSearchError, setAiSearchError] = useState('')

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Filter exams based on search query (combines local database + AI-generated exams)
  const searchResults = useMemo(() => {
    const local = searchExams(searchQuery)
    const q = (searchQuery || '').trim().toLowerCase()
    if (!q) {
      return [...local, ...aiExams]
    }
    const matchingAi = aiExams.filter((e) =>
      e.name?.toLowerCase().includes(q) ||
      e.fullName?.toLowerCase().includes(q) ||
      e.category?.toLowerCase().includes(q) ||
      e.conductingBody?.toLowerCase().includes(q)
    )
    const seen = new Set(local.map((e) => e.id))
    const combined = [...local]
    for (const exam of matchingAi) {
      if (!seen.has(exam.id)) {
        combined.push(exam)
        seen.add(exam.id)
      }
    }
    return combined
  }, [searchQuery, aiExams])

  // Current selected exam
  const currentExam = useMemo(() => {
    if (!searchResults.length) return null
    return searchResults.find((e) => e.id === selectedExamId) || searchResults[0]
  }, [searchResults, selectedExamId])

  // AI Search Handler for any exam (State Govt, Police, CET, REET, Teaching, etc.)
  const handleTriggerAiSearch = async (queryToSearch) => {
    const term = (queryToSearch || searchQuery).trim()
    if (!term) return

    setIsAiSearching(true)
    setAiSearchError('')

    try {
      const examData = await fetchExamByAI(term)
      setAiExams((prev) => {
        const exists = prev.some((e) => e.id === examData.id)
        if (exists) return prev.map((e) => (e.id === examData.id ? examData : e))
        return [examData, ...prev]
      })
      setSelectedExamId(examData.id)
      showToast(`✨ Kit AI generated official details for ${examData.name}!`)
    } catch (err) {
      console.error('AI search error:', err)
      setAiSearchError(err.message || 'Could not fetch exam details. Please try again or check your query.')
    } finally {
      setIsAiSearching(false)
    }
  }

  // Import exam syllabus into personal tracker
  const handleImportToMySyllabus = async () => {
    if (!userName) {
      navigate('/welcome')
      return
    }
    if (!currentExam) return

    setIsImporting(true)
    try {
      // Get existing syllabus
      const existing = (await getSyllabus(userName)) || []
      
      // Merge subjects: if subject with same name doesn't exist, append it
      const existingNames = new Set(existing.map((s) => s.name?.toLowerCase().trim()))
      const newSubjects = currentExam.syllabus.filter(
        (sub) => !existingNames.has(sub.name.toLowerCase().trim())
      )

      const merged = [...existing, ...newSubjects]
      await saveSyllabus(userName, merged)
      showToast(`✓ Imported ${currentExam.name} syllabus to your tracker!`)
    } catch (err) {
      console.error('Import syllabus error:', err)
      alert('Could not import syllabus. Please try again.')
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white flex flex-col font-sans pb-28">
      {/* ── Top Bar ── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0d0d12]/85 border-b border-[#222232] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="w-9 h-9 rounded-xl bg-[#1b1b26] hover:bg-[#262638] active:scale-95 border border-[#2e2e42] flex items-center justify-center text-gray-300 transition-all cursor-pointer"
            title="Back to Stopwatch"
          >
            ←
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
              <span>🏛️</span>
              <span>Govt & Entrance Exam Search</span>
            </h1>
            <p className="text-[11px] text-gray-400">Authentic Syllabus, Official PYQs & Exam Patterns</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/syllabus')}
          className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all flex items-center gap-1.5"
        >
          <span>📋</span>
          <span className="hidden sm:inline">My Syllabus</span>
        </button>
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-4xl w-full mx-auto px-4 py-5 flex-1 flex flex-col gap-5">
        {/* ── SEARCH BAR SECTION (Clean & Uncluttered with AI Search) ── */}
        <section className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (searchResults.length === 0 || !currentExam) {
                      handleTriggerAiSearch(searchQuery)
                    }
                  }
                }}
                placeholder="Search any exam (e.g. SSC CGL, UPSC, UP Police, REET, JEE, BPSC, Banking)..."
                autoFocus
                className="w-full rounded-2xl bg-[#151522] border border-[#2b2b3f] text-white text-sm pl-11 pr-10 py-3.5 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 transition-all placeholder:text-gray-500 shadow-lg"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-sm w-6 h-6 flex items-center justify-center rounded-full bg-[#202030]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Direct AI Research Button */}
            {searchQuery.trim().length > 1 && (
              <button
                type="button"
                onClick={() => handleTriggerAiSearch(searchQuery)}
                disabled={isAiSearching}
                className="px-4 py-3 sm:py-0 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isAiSearching ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>✨ AI Research</span>
                )}
              </button>
            )}
          </div>

          {/* Quick Pill Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] text-gray-500 flex-shrink-0 mr-1">Popular:</span>
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer ${
                  searchQuery.toLowerCase() === tag.toLowerCase()
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#181827] border border-[#2b2b3f] text-gray-300 hover:text-white hover:border-gray-500'
                }`}
              >
                {tag}
              </button>
            ))}
            {searchQuery.trim().length > 1 && (
              <button
                onClick={() => handleTriggerAiSearch(searchQuery)}
                disabled={isAiSearching}
                className="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer"
              >
                <span>✨ Research "{searchQuery.slice(0, 15)}" with AI</span>
              </button>
            )}
          </div>
        </section>

        {/* ── AI RESEARCHING LOADING BANNER ── */}
        {isAiSearching && (
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#18122c] via-[#121224] to-[#0c0c16] border border-purple-500/50 shadow-2xl flex flex-col items-center text-center gap-3 animate-in fade-in duration-300">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-purple-600/20 border border-purple-500/60 flex items-center justify-center text-2xl shadow-inner animate-bounce">
                🤖
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-500 opacity-40 blur-md animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center justify-center gap-2">
                <span>Kit AI is researching "{searchQuery}"</span>
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              </h3>
              <p className="text-xs text-purple-200/70 mt-1 max-w-md leading-relaxed">
                Scanning authentic curriculum, stage-wise marking blueprints, subject chapter breakdown, and official PYQ links...
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-mono mt-1">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <span>Generating verified Syllabus & Exam Scheme...</span>
            </div>
          </div>
        )}

        {/* ── AI SEARCH ERROR (If any) ── */}
        {aiSearchError && !isAiSearching && (
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{aiSearchError}</span>
            </div>
            <button
              onClick={() => handleTriggerAiSearch(searchQuery)}
              className="px-3 py-1 rounded-xl bg-rose-600/30 hover:bg-rose-600/50 text-white font-bold text-[11px] transition-colors cursor-pointer"
            >
              Retry AI Search
            </button>
          </div>
        )}

        {/* ── EXAM SELECTOR CAROUSEL (If Multiple Results) ── */}
        {searchResults.length > 0 && !isAiSearching && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {searchResults.map((exam) => {
              const isSelected = currentExam?.id === exam.id
              return (
                <button
                  key={exam.id}
                  onClick={() => setSelectedExamId(exam.id)}
                  className={`px-4 py-2.5 rounded-2xl text-left border flex flex-col gap-0.5 transition-all flex-shrink-0 min-w-[140px] cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-900/40 to-[#1e1e32] border-purple-500 shadow-md ring-1 ring-purple-500/40'
                      : 'bg-[#141420] border-[#252538] hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                      {exam.name}
                    </span>
                    {exam.aiGenerated && (
                      <span className="text-[9px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/30 px-1 py-0.2 rounded">
                        AI
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                    {exam.conductingBody?.split('(')[0] || 'Govt Exam'}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── NO RESULTS STATE (With 1-Click AI Search Feature) ── */}
        {searchResults.length === 0 && !isAiSearching && (
          <div className="p-8 rounded-3xl bg-gradient-to-br from-[#161626] to-[#10101b] border border-purple-500/30 text-center flex flex-col items-center gap-4 my-2 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-3xl">
              🤖
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-black text-white">
                "{searchQuery}" not found in local database?
              </h3>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                Koi baat nahi! Kit AI se kisi bhi <b>State Exam</b> (UP Police, REET, BPSC, MPTET, Rajasthan CET), <b>Central Exam</b>, ya <b>Entrance Exam</b> ka official syllabus aur exam pattern 5 seconds me generate kar sakte hain!
              </p>
            </div>

            <button
              onClick={() => handleTriggerAiSearch(searchQuery)}
              disabled={isAiSearching}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/40 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
            >
              <span>⚡</span>
              <span>Research "{searchQuery}" with Kit AI</span>
            </button>

            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              ← Clear Search & Show Popular Exams
            </button>
          </div>
        )}

        {/* ── SELECTED EXAM DETAILS CONTAINER ── */}
        {currentExam && !isAiSearching && (
          <div className="flex flex-col gap-4">
            {/* Exam Hero Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#181829] via-[#141422] to-[#10101a] border border-[#2c2c42] shadow-xl flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-600/30 text-purple-300 border border-purple-500/40">
                      {currentExam.category}
                    </span>
                    {currentExam.aiGenerated && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                        <span>✨</span>
                        <span>Kit AI Researched</span>
                      </span>
                    )}
                    <span className="text-[11px] text-gray-400">
                      Conducted by: <b className="text-gray-200">{currentExam.conductingBody}</b>
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
                    {currentExam.name}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">{currentExam.fullName}</p>
                </div>

                {/* Import button */}
                <button
                  onClick={handleImportToMySyllabus}
                  disabled={isImporting}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-white shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  <span>📥</span>
                  <span>{isImporting ? 'Importing...' : 'Import to My Syllabus'}</span>
                </button>
              </div>

              {/* Quick Key Facts Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#232338]">
                <div className="p-2.5 rounded-xl bg-[#181826]/70 border border-[#27273e]">
                  <span className="text-[10px] text-gray-400 block">Exam Mode</span>
                  <span className="text-xs font-bold text-white truncate block">
                    {currentExam.overview.mode.split('(')[0]}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#181826]/70 border border-[#27273e]">
                  <span className="text-[10px] text-gray-400 block">Duration</span>
                  <span className="text-xs font-bold text-amber-300 truncate block">
                    {currentExam.overview.duration.split('(')[0]}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#181826]/70 border border-[#27273e]">
                  <span className="text-[10px] text-gray-400 block">Negative Marking</span>
                  <span className="text-xs font-bold text-red-400 truncate block">
                    {currentExam.overview.negativeMarking.split('|')[0]}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#181826]/70 border border-[#27273e]">
                  <span className="text-[10px] text-gray-400 block">Eligibility</span>
                  <span className="text-xs font-bold text-emerald-400 truncate block">
                    {currentExam.overview.eligibility.split('.')[0]}
                  </span>
                </div>
              </div>
            </div>

            {/* ── Sub Tabs (Syllabus, PYQ, Pattern) ── */}
            <div className="flex items-center gap-1 bg-[#141420] p-1 rounded-2xl border border-[#252538]">
              <button
                onClick={() => setActiveTab('syllabus')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'syllabus' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>📋</span>
                <span>Official Syllabus</span>
              </button>
              <button
                onClick={() => setActiveTab('pyq')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'pyq' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>📑</span>
                <span>Original PYQs ({currentExam.pyqs.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('pattern')}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'pattern' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>🎯</span>
                <span>Pattern & Scheme</span>
              </button>
            </div>

            {/* ── TAB CONTENT: SYLLABUS ── */}
            {activeTab === 'syllabus' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Showing {currentExam.syllabus.length} subject(s) with authentic chapter breakdown:
                  </p>
                  <button
                    onClick={handleImportToMySyllabus}
                    className="text-xs text-purple-400 hover:text-purple-300 font-bold hover:underline flex items-center gap-1"
                  >
                    <span>+ Add all to My Tracker</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentExam.syllabus.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-2xl bg-[#141420] border border-[#252538] flex flex-col gap-2.5 shadow-md"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                          <span className="text-purple-400">●</span>
                          <span>{sub.name}</span>
                        </h4>
                        <span className="text-[10px] font-bold text-gray-500">
                          {sub.topics.length} topics
                        </span>
                      </div>

                      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
                        {sub.topics.map((t, idx) => (
                          <div
                            key={t.id}
                            className="p-2 rounded-xl bg-[#181828] border border-[#232338] text-[11px] text-gray-300 flex items-center gap-2"
                          >
                            <span className="text-gray-500 text-[10px] w-4 font-mono">{idx + 1}.</span>
                            <span className="flex-1 truncate">{t.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB CONTENT: PYQS ── */}
            {activeTab === 'pyq' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-400">
                  Authentic official previous year question papers and solution keys for {currentExam.name}:
                </p>

                <div className="flex flex-col gap-2.5">
                  {currentExam.pyqs.map((paper, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#141420] border border-[#252538] hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm font-black text-purple-300 flex-shrink-0">
                          {paper.year}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white">{paper.title}</h4>
                            {paper.hasAnswerKey && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                Answer Key ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{paper.shift}</p>
                        </div>
                      </div>

                      <a
                        href={paper.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 rounded-xl bg-[#202032] hover:bg-purple-600 hover:text-white border border-[#30304a] text-purple-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 flex-shrink-0"
                      >
                        <span>📥</span>
                        <span>Open Official Paper</span>
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── TAB CONTENT: PATTERN & SCHEME ── */}
            {activeTab === 'pattern' && (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-2xl bg-[#141420] border border-[#252538] flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span>📌</span>
                    <span>Eligibility & Examination Stages:</span>
                  </h4>
                  <p className="text-xs text-gray-300 leading-relaxed">
                    {currentExam.overview.eligibility}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Stages: <b className="text-gray-200">{currentExam.overview.stages}</b>
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-white">Stage-wise Marking & Blueprint:</h4>
                  {currentExam.pattern.map((stage, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-[#141420] border border-[#252538] flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#232338] pb-2">
                        <span className="text-xs font-black text-white">{stage.stage}</span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-400">
                          <span>Total: <b>{stage.totalMarks} Marks</b></span>
                          <span>•</span>
                          <span>Time: <b>{stage.time}</b></span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {stage.subjects.map((sub, sIdx) => (
                          <div
                            key={sIdx}
                            className="p-2 rounded-xl bg-[#181828] text-xs text-gray-300 flex items-center justify-between"
                          >
                            <span>{sub.name}</span>
                            <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
                              <span>{sub.questions} Qs</span>
                              <span className="text-purple-300 font-bold">{sub.marks} M</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c2e] border border-purple-500/50 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold animate-fadeIn flex items-center gap-2">
          <span>✨</span>
          <span>{toastMessage}</span>
          <button
            onClick={() => navigate('/syllabus')}
            className="ml-2 text-purple-300 underline font-extrabold cursor-pointer"
          >
            View Tracker
          </button>
        </div>
      )}
    </div>
  )
}
