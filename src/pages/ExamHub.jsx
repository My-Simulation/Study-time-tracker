/**
 * ExamHub.jsx — Search-first Govt & Competitive Exam Resource Hub
 * Allows students to search any exam (SSC CGL, UPSC, JEE, NEET, NDA, Banking, Railways)
 * and view authentic verified Syllabus, original PYQs, and Exam Pattern.
 * Includes 1-Click "Import to My Syllabus Tracker" to track preparation progress.
 */

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { EXAM_DATABASE, searchExams } from '../utils/examHubData'
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

  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Filter exams based on search query
  const searchResults = useMemo(() => {
    return searchExams(searchQuery)
  }, [searchQuery])

  // Current selected exam
  const currentExam = useMemo(() => {
    if (!searchResults.length) return null
    return searchResults.find((e) => e.id === selectedExamId) || searchResults[0]
  }, [searchResults, selectedExamId])

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
        {/* ── SEARCH BAR SECTION (Clean & Uncluttered) ── */}
        <section className="flex flex-col gap-3">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any exam (e.g. SSC CGL, UPSC, JEE Main, NEET, NDA, Banking, Railways)..."
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

          {/* Quick Pill Suggestions */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] text-gray-500 flex-shrink-0 mr-1">Popular:</span>
            {POPULAR_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => setSearchQuery(tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                  searchQuery.toLowerCase() === tag.toLowerCase()
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#181827] border border-[#2b2b3f] text-gray-300 hover:text-white hover:border-gray-500'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* ── EXAM SELECTOR CAROUSEL (If Multiple Results) ── */}
        {searchResults.length > 0 && (
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
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {exam.name}
                  </span>
                  <span className="text-[10px] text-gray-500 truncate max-w-[150px]">
                    {exam.conductingBody.split('(')[0]}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── NO RESULTS STATE ── */}
        {searchResults.length === 0 && (
          <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center flex flex-col items-center gap-2 my-4">
            <span className="text-3xl">🔍</span>
            <h3 className="text-sm font-bold text-white">No exam found for "{searchQuery}"</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Aap SSC, UPSC, JEE, NEET, NDA, Banking, ya Railways jaisa koi bhi term search kar sakte hain.
            </p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-xs font-bold text-purple-400 hover:underline"
            >
              Clear Search & Show All Exams
            </button>
          </div>
        )}

        {/* ── SELECTED EXAM DETAILS CONTAINER ── */}
        {currentExam && (
          <div className="flex flex-col gap-4">
            {/* Exam Hero Card */}
            <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#181829] via-[#141422] to-[#10101a] border border-[#2c2c42] shadow-xl flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-600/30 text-purple-300 border border-purple-500/40">
                      {currentExam.category}
                    </span>
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
