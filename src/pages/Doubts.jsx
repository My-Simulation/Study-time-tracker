/**
 * Doubts.jsx — Mentor Doubt Solver
 * - 1st Question is 100% FREE for every student.
 * - From 2nd question onwards: requires paid doubt tokens (e.g. ₹9 or ₹39 for 5 doubts).
 * - Admin (bandar / jeeteshsharma) can view student doubts in real-time and reply with handwritten photo + text solution.
 */

import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  checkIsAdmin,
  getUserDoubtBalance,
  addPaidDoubts,
  submitDoubt,
  subscribeToStudentDoubts,
  subscribeToAllDoubtsForAdmin,
  solveDoubtByAdmin,
  compressImageFile,
  generateLockedUpiUri,
  verifyAndProcessPayment,
  subscribeToPaymentRecords,
  revokePaymentByAdmin,
} from '../utils/doubtHelpers'
import { getSession } from '../utils/auth'
import { subscribeToVisitorLogs } from '../utils/visitorTracker'

const SUBJECT_OPTIONS = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'General Intelligence & Reasoning',
  'General Studies / GK',
  'English Language',
  'Indian Polity & Constitution',
  'History & Geography',
  'Economy & Banking',
  'Other / Concept Doubt',
]

const PRICING_PACKS = [
  { id: 'pack_1', count: 1, price: 9, label: 'Single Doubt', desc: '1 Question Solution', badge: '' },
  { id: 'pack_5', count: 5, price: 39, label: 'Standard Pack', desc: '5 Questions Solution', badge: 'Popular 🔥' },
  { id: 'pack_12', count: 12, price: 79, label: 'Aspirant Pro', desc: '12 Questions Solution', badge: 'Best Value 🚀' },
]

export default function Doubts() {
  const navigate = useNavigate()
  const session = getSession()
  const userName = session?.username || ''
  const isAdmin = checkIsAdmin(userName)

  // Navigation tab for Admin: 'student' or 'admin'
  const [activeTab, setActiveTab] = useState(isAdmin ? 'admin' : 'student')

  // Entitlement balance
  const [balance, setBalance] = useState({
    freeDoubtAvailable: true,
    freeDoubtUsed: false,
    paidDoubtsBalance: 0,
    canAskDoubt: true,
  })
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)

  // Doubts list
  const [myDoubts, setMyDoubts] = useState([])
  const [adminDoubts, setAdminDoubts] = useState([])
  const [adminFilter, setAdminFilter] = useState('pending') // 'pending' | 'solved' | 'all'

  // Modals & UI States
  const [showAskModal, setShowAskModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(false)
  const [payModalStep, setPayModalStep] = useState(1) // 1: Select Pack & QR, 2: Enter UTR
  const [selectedPack, setSelectedPack] = useState(PRICING_PACKS[1])
  const [imagePreviewModal, setImagePreviewModal] = useState(null)

  // Payment UTR Verification State
  const [enteredUtr, setEnteredUtr] = useState('')
  const [isVerifyingUtr, setIsVerifyingUtr] = useState(false)
  const [utrError, setUtrError] = useState('')

  // Clipboard paste helper for UTR
  const handlePasteUtr = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        showToast('Please paste manually.')
        return
      }
      const text = await navigator.clipboard.readText()
      const digitsOnly = (text || '').replace(/\D/g, '').slice(0, 12)
      if (digitsOnly) {
        setEnteredUtr(digitsOnly)
        setUtrError('')
        showToast('Pasted from clipboard! 📋')
      } else {
        setUtrError('Clipboard does not contain numbers.')
      }
    } catch {
      showToast('Could not access clipboard. Paste manually.')
    }
  }

  // Admin State (Payments & Visitor Logs)
  const [paymentRecords, setPaymentRecords] = useState([])
  const [visitorLogs, setVisitorLogs] = useState([])
  const [adminSubTab, setAdminSubTab] = useState('doubts') // 'doubts' | 'payments' | 'visitors'

  // Ask Doubt Form State
  const [questionText, setQuestionText] = useState('')
  const [subject, setSubject] = useState(SUBJECT_OPTIONS[0])
  const [questionImage, setQuestionImage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const questionFileInputRef = useRef(null)

  // Admin Solving State
  const [solvingDoubtId, setSolvingDoubtId] = useState(null)
  const [solutionText, setSolutionText] = useState('')
  const [solutionImage, setSolutionImage] = useState('')
  const [isSavingSolution, setIsSavingSolution] = useState(false)
  const solutionFileInputRef = useRef(null)

  // Toast / feedback message
  const [toastMessage, setToastMessage] = useState('')
  const showToast = (msg) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(''), 3500)
  }

  // Load user doubt balance
  const refreshBalance = async () => {
    if (!userName) return
    try {
      const b = await getUserDoubtBalance(userName)
      setBalance(b)
    } catch (err) {
      console.error('Failed to load doubt balance:', err)
    } finally {
      setIsLoadingBalance(false)
    }
  }

  useEffect(() => {
    refreshBalance()
  }, [userName])

  // Subscribe to student's own doubts
  useEffect(() => {
    if (!userName) return
    const unsubscribe = subscribeToStudentDoubts(userName, (list) => {
      setMyDoubts(list)
    })
    return () => unsubscribe()
  }, [userName])

  // Subscribe to Admin incoming doubts, payments, and live visitor logs
  useEffect(() => {
    if (!isAdmin) return
    const unsubDoubts = subscribeToAllDoubtsForAdmin((list) => {
      setAdminDoubts(list)
    })
    const unsubPayments = subscribeToPaymentRecords((records) => {
      setPaymentRecords(records)
    })
    const unsubVisitors = subscribeToVisitorLogs((logs) => {
      setVisitorLogs(logs)
    })
    return () => {
      unsubDoubts()
      unsubPayments()
      unsubVisitors()
    }
  }, [isAdmin])

  // Handle Question Image Select
  const handleQuestionImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImageFile(file, 900, 0.8)
      setQuestionImage(compressed)
      setSubmitError('')
    } catch {
      setSubmitError('Could not process this image. Try another photo.')
    }
  }

  // Handle Solution Image Select (Admin)
  const handleSolutionImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const compressed = await compressImageFile(file, 900, 0.8)
      setSolutionImage(compressed)
    } catch {
      alert('Could not process this solution image.')
    }
  }

  // Open Payment Modal
  const handleOpenPayModal = () => {
    setPayModalStep(1)
    setUtrError('')
    setShowPayModal(true)
  }

  // Submit Doubt Click
  const handleOpenAskModal = () => {
    if (!userName) {
      navigate('/welcome')
      return
    }
    if (!balance.canAskDoubt) {
      handleOpenPayModal()
      return
    }
    setSubmitError('')
    setShowAskModal(true)
  }

  const handleSubmitDoubt = async (e) => {
    e?.preventDefault()
    if (!questionText.trim() && !questionImage) {
      setSubmitError('Please enter question text or upload a photo.')
      return
    }

    setIsSubmitting(true)
    setSubmitError('')
    try {
      await submitDoubt({
        userName,
        displayName: session?.displayName || userName,
        subject,
        questionText,
        imageUrl: questionImage,
      })
      setShowAskModal(false)
      setQuestionText('')
      setQuestionImage('')
      await refreshBalance()
      showToast('Doubt submitted to Mentor! You will be notified once solved. 🚀')
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit doubt. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Admin: Submit Solution
  const handleAdminSubmitSolution = async (doubtId) => {
    if (!solutionText.trim() && !solutionImage) {
      alert('Please write solution text or upload a solution photo.')
      return
    }

    setIsSavingSolution(true)
    try {
      await solveDoubtByAdmin({
        doubtId,
        adminUsername: userName || 'Mentor',
        solutionText,
        solutionImageUrl: solutionImage,
      })
      setSolvingDoubtId(null)
      setSolutionText('')
      setSolutionImage('')
      showToast('Solution sent to student successfully! ✅')
    } catch (err) {
      console.error(err)
      alert('Failed to save solution.')
    } finally {
      setIsSavingSolution(false)
    }
  }

  // Payment Verification with 12-digit UTR
  const handleVerifyPayment = async (e) => {
    e?.preventDefault()
    setUtrError('')
    const clean = (enteredUtr || '').trim().replace(/\s+/g, '')
    if (!clean) {
      setUtrError('Please enter the 12-digit UTR / UPI Reference Number.')
      return
    }
    if (!/^\d{12}$/.test(clean)) {
      setUtrError('UTR must be exactly 12 digits (e.g. 428192839182). Check your PhonePe/GPay receipt.')
      return
    }

    setIsVerifyingUtr(true)
    try {
      await verifyAndProcessPayment({
        userName,
        displayName: session?.displayName || userName,
        pack: selectedPack,
        utr: clean,
      })
      await refreshBalance()
      setShowPayModal(false)
      setEnteredUtr('')
      showToast(`🎉 Verified! ${selectedPack.count} Doubt Token(s) credited successfully!`)
      setShowAskModal(true)
    } catch (err) {
      setUtrError(err.message || 'Payment verification failed.')
    } finally {
      setIsVerifyingUtr(false)
    }
  }

  // Admin: Revoke fraudulent payment
  const handleRevokePayment = async (record) => {
    if (!window.confirm(`Revoke transaction from @${record.userName} (UTR: ${record.utr}) and deduct ${record.packCount} tokens?`)) {
      return
    }
    try {
      await revokePaymentByAdmin({
        recordId: record.id,
        userName: record.userName,
        tokenCount: record.packCount,
      })
      showToast('Payment revoked & tokens deducted! ❌')
    } catch (err) {
      alert('Failed to revoke payment.')
    }
  }

  // Admin filter calculation
  const pendingAdminCount = adminDoubts.filter((d) => d.status === 'pending').length
  const filteredAdminDoubts = adminDoubts.filter((d) => {
    if (adminFilter === 'pending') return d.status === 'pending'
    if (adminFilter === 'solved') return d.status === 'solved'
    return true
  })

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
              <span>👨‍🏫</span>
              <span>Mentor Doubt Solver</span>
            </h1>
            <p className="text-[11px] text-gray-400">Direct handwritten solutions from Mentor</p>
          </div>
        </div>

        {/* Admin / Student Mode Switcher if Admin */}
        {isAdmin && (
          <div className="flex items-center bg-[#171724] border border-[#2b2b3f] rounded-xl p-0.5">
            <button
              onClick={() => setActiveTab('student')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'student' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              Student View
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'admin' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-400 hover:text-white'
              }`}
            >
              <span>👑 Mentor Inbox</span>
              {pendingAdminCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black animate-pulse">
                  {pendingAdminCount}
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* ── Main Container ── */}
      <main className="max-w-2xl w-full mx-auto px-4 py-5 flex-1 flex flex-col gap-5">
        {/* ── STUDENT VIEW ── */}
        {activeTab === 'student' && (
          <>
            {/* Balance & Entitlement Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#181829] to-[#12121f] border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-2xl flex-shrink-0">
                  {balance.freeDoubtAvailable ? '🎁' : balance.paidDoubtsBalance > 0 ? '⚡' : '🔒'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Your Doubt Balance</h3>
                    {balance.freeDoubtAvailable && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        1 FREE DOUBT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-300 mt-0.5">
                    {balance.freeDoubtAvailable ? (
                      <span>First doubt is <b>100% Free</b>! Mentor will solve it physically.</span>
                    ) : balance.paidDoubtsBalance > 0 ? (
                      <span>You have <b>{balance.paidDoubtsBalance} Paid Doubt Token(s)</b> available.</span>
                    ) : (
                      <span className="text-amber-400">Free doubt used. Top up to ask more questions.</span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleOpenPayModal}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-[#222234] hover:bg-[#2c2c42] border border-[#383854] text-purple-300 transition-all flex items-center gap-1.5"
                >
                  <span>💳</span>
                  <span>Get Tokens</span>
                </button>
                <button
                  onClick={handleOpenAskModal}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  <span>✏️</span>
                  <span>Ask Mentor</span>
                </button>
              </div>
            </div>

            {/* My Doubts List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <span>📑</span>
                  <span>My Asked Doubts ({myDoubts.length})</span>
                </h3>
                <span className="text-[11px] text-gray-500">Real-time update</span>
              </div>

              {myDoubts.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center flex flex-col items-center gap-2">
                  <span className="text-3xl">💡</span>
                  <h4 className="text-sm font-bold text-white">No doubts asked yet</h4>
                  <p className="text-xs text-gray-400 max-w-sm">
                    Kahi bhi sawal me fanse ho? Question ki photo upload karo ya likho, mentor apko step-by-step solution bhejenge!
                  </p>
                  <button
                    onClick={handleOpenAskModal}
                    className="mt-3 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white shadow-md transition-all"
                  >
                    Ask Your 1st Free Doubt 🎁
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {myDoubts.map((doubt) => {
                    const isSolved = doubt.status === 'solved'
                    return (
                      <div
                        key={doubt.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          isSolved
                            ? 'bg-[#141624] border-emerald-500/30 shadow-md shadow-emerald-950/10'
                            : 'bg-[#151522] border-amber-500/30'
                        }`}
                      >
                        {/* Header info */}
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            {doubt.subject || 'General'}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border flex items-center gap-1.5 ${
                              isSolved
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSolved ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
                              }`}
                            />
                            <span>{isSolved ? 'Solved by Mentor' : 'Mentor Solving...'}</span>
                          </span>
                        </div>

                        {/* Question Text & Photo */}
                        {doubt.questionText && (
                          <p className="text-xs font-medium text-gray-200 mb-2 leading-relaxed whitespace-pre-wrap">
                            {doubt.questionText}
                          </p>
                        )}

                        {doubt.imageUrl && (
                          <div className="mb-3">
                            <img
                              src={doubt.imageUrl}
                              alt="Question"
                              onClick={() => setImagePreviewModal(doubt.imageUrl)}
                              className="max-h-48 rounded-xl object-contain bg-black/40 border border-[#2b2b3f] cursor-zoom-in hover:opacity-95 transition-opacity"
                            />
                            <span className="text-[10px] text-gray-500 mt-1 block">Tap image to zoom 🔍</span>
                          </div>
                        )}

                        {/* Solution Section if Solved */}
                        {isSolved ? (
                          <div className="mt-3 pt-3 border-t border-emerald-500/20 bg-emerald-950/20 rounded-xl p-3 border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                                <span>👨‍🏫</span> Mentor Solution:
                              </span>
                              <span className="text-[10px] text-gray-400">
                                {doubt.solvedAt ? new Date(doubt.solvedAt).toLocaleDateString() : ''}
                              </span>
                            </div>

                            {doubt.solutionText && (
                              <p className="text-xs text-gray-200 leading-relaxed whitespace-pre-wrap mb-2">
                                {doubt.solutionText}
                              </p>
                            )}

                            {doubt.solutionImageUrl && (
                              <div>
                                <p className="text-[11px] font-semibold text-emerald-400 mb-1">
                                  Handwritten Solution:
                                </p>
                                <img
                                  src={doubt.solutionImageUrl}
                                  alt="Solution"
                                  onClick={() => setImagePreviewModal(doubt.solutionImageUrl)}
                                  className="max-h-60 rounded-xl object-contain bg-black/60 border border-emerald-500/40 cursor-zoom-in hover:opacity-95 transition-opacity"
                                />
                                <span className="text-[10px] text-emerald-400/80 mt-1 block">
                                  Tap solution image to view full size 🔍
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-amber-400/90 mt-2 bg-amber-950/20 p-2 rounded-lg border border-amber-900/30">
                            Mentor aapka question solve kar rahe hain. Jaldi hi solution yahan upload ho jayega!
                          </p>
                        )}

                        <div className="mt-2 text-[10px] text-gray-500 flex justify-between">
                          <span>Asked: {doubt.createdAt ? new Date(doubt.createdAt).toLocaleString() : ''}</span>
                          {doubt.isFreeDoubt && <span className="text-emerald-400 font-semibold">Free Doubt Used</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── ADMIN VIEW (Mentor Queue & Payment Records) ── */}
        {activeTab === 'admin' && isAdmin && (
          <div className="flex flex-col gap-4">
            {/* Admin SubTab Switcher */}
            <div className="flex items-center gap-2 border-b border-[#252538] pb-2">
              <button
                onClick={() => setAdminSubTab('doubts')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  adminSubTab === 'doubts'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-[#181827] text-gray-400 hover:text-white'
                }`}
              >
                <span>👑 Doubts Queue</span>
                {pendingAdminCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-black">
                    {pendingAdminCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setAdminSubTab('payments')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  adminSubTab === 'payments'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-[#181827] text-gray-400 hover:text-white'
                }`}
              >
                <span>💰 Payments & UTR</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] font-mono">
                  {paymentRecords.length}
                </span>
              </button>
              <button
                onClick={() => setAdminSubTab('visitors')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  adminSubTab === 'visitors'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-[#181827] text-gray-400 hover:text-white'
                }`}
              >
                <span>👁️ Live Visitors</span>
                <span className="px-1.5 py-0.2 rounded bg-black/40 text-[10px] font-mono">
                  {visitorLogs.length}
                </span>
              </button>
            </div>

            {/* ── SUB-TAB: PAYMENTS & UTR LOG ── */}
            {adminSubTab === 'payments' && (
              <div className="flex flex-col gap-4">
                {/* Revenue Stats Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Total Verified Revenue</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 font-mono">
                      ₹{paymentRecords.filter((r) => r.status === 'verified').reduce((sum, r) => sum + (r.amount || 0), 0)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Total Tokens Sold</span>
                    <span className="text-xl font-black text-amber-300 mt-1 font-mono">
                      {paymentRecords.filter((r) => r.status === 'verified').reduce((sum, r) => sum + (r.packCount || 0), 0)}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Total Transactions</span>
                    <span className="text-xl font-black text-white mt-1 font-mono">
                      {paymentRecords.length}
                    </span>
                  </div>
                </div>

                {paymentRecords.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center">
                    <p className="text-xs text-gray-400">No payment transactions recorded yet.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {paymentRecords.map((record) => {
                      const isVerified = record.status === 'verified'
                      return (
                        <div
                          key={record.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isVerified
                              ? 'bg-[#151524] border-[#292942]'
                              : 'bg-red-950/20 border-red-900/30 opacity-70'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">@{record.userName}</span>
                              <span className="text-[10px] text-gray-400">({record.displayName})</span>
                              <span
                                className={`px-2 py-0.2 rounded-full text-[10px] font-black border ${
                                  isVerified
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                                }`}
                              >
                                {isVerified ? 'Verified ✓' : 'Revoked ✕'}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-3 text-xs flex-wrap">
                              <span className="text-gray-400 font-mono text-[11px]">
                                UTR: <b className="text-amber-300 font-bold select-all">{record.utr}</b>
                              </span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-300 text-[11px]">{record.packLabel}</span>
                              <span className="text-gray-500">•</span>
                              <span className="text-gray-500 text-[10px]">
                                {record.createdAt ? new Date(record.createdAt).toLocaleString() : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-3 flex-shrink-0">
                            <span className="text-base font-black text-emerald-400 font-mono">
                              ₹{record.amount}
                            </span>

                            {isVerified && (
                              <button
                                onClick={() => handleRevokePayment(record)}
                                className="px-2.5 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 text-[11px] font-bold transition-all cursor-pointer"
                                title="Revoke fake transaction and deduct tokens"
                              >
                                Revoke
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB: LIVE VISITORS & GEOLOCATION LOG ── */}
            {adminSubTab === 'visitors' && (
              <div className="flex flex-col gap-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Total Tracked Visits</span>
                    <span className="text-xl font-black text-purple-400 mt-1 font-mono">
                      {visitorLogs.length}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Visits Today</span>
                    <span className="text-xl font-black text-emerald-400 mt-1 font-mono">
                      {
                        visitorLogs.filter((v) => {
                          const d = new Date(v.timestamp || 0)
                          const today = new Date()
                          return d.toDateString() === today.toDateString()
                        }).length
                      }
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Unique Cities</span>
                    <span className="text-xl font-black text-amber-300 mt-1 font-mono">
                      {new Set(visitorLogs.map((v) => v.city).filter(Boolean)).size}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#141422] border border-[#2b2b40] flex flex-col">
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Logged-in Users</span>
                    <span className="text-xl font-black text-cyan-400 mt-1 font-mono">
                      {visitorLogs.filter((v) => v.isLoggedIn).length}
                    </span>
                  </div>
                </div>

                {visitorLogs.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center">
                    <p className="text-xs text-gray-400">
                      No visitor logs recorded yet. Once users open your link (jeetprep.netlify.app), their real-time location and device info will appear here!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {visitorLogs.map((v) => (
                      <div
                        key={v.id}
                        className="p-3.5 rounded-2xl border bg-[#141422] border-[#292942] hover:border-purple-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          {/* Location + Country Flag + Identity */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{v.countryEmoji || '📍'}</span>
                            <span className="text-xs font-black text-white">
                              {v.city ? `${v.city}${v.region ? ', ' + v.region : ''}` : 'India'}
                            </span>
                            <span className="text-[10px] text-gray-400">({v.country || 'India'})</span>
                            {v.isLoggedIn ? (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                @{v.username}
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                                Guest Visitor
                              </span>
                            )}
                          </div>

                          {/* Device + Source + ISP + IP */}
                          <div className="mt-1 flex items-center gap-2.5 text-xs text-gray-400 flex-wrap">
                            <span className="text-[11px] text-cyan-300 font-medium">
                              {v.deviceType === 'Mobile' ? '📱' : '💻'} {v.os} • {v.browser}
                            </span>
                            <span className="text-gray-600">•</span>
                            <span className="text-[11px] text-amber-300 font-bold">
                              Via: {v.source || 'Direct Link'}
                            </span>
                            {v.isp && (
                              <>
                                <span className="text-gray-600">•</span>
                                <span className="text-[10px] text-gray-400 truncate max-w-[140px]" title={v.isp}>
                                  📶 {v.isp}
                                </span>
                              </>
                            )}
                            {v.ip && (
                              <>
                                <span className="text-gray-600">•</span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  IP: {v.ip}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div className="text-right flex-shrink-0">
                          <span className="text-[11px] text-purple-300 font-mono block">
                            {v.timestamp ? new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            {v.timestamp ? new Date(v.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB: DOUBTS QUEUE ── */}
            {adminSubTab === 'doubts' && (
              <>
                <div className="p-4 rounded-2xl bg-[#181829] border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>👑</span>
                      <span>Mentor Doubt Inbox (Admin)</span>
                    </h3>
                    <p className="text-xs text-gray-300 mt-0.5">
                      View and solve questions submitted by students. Upload your handwritten solution or type steps.
                    </p>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-1.5 bg-[#12121e] p-1 rounded-xl border border-[#29293e]">
                    <button
                      onClick={() => setAdminFilter('pending')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        adminFilter === 'pending' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Pending ({pendingAdminCount})
                    </button>
                    <button
                      onClick={() => setAdminFilter('solved')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        adminFilter === 'solved' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Solved
                    </button>
                    <button
                      onClick={() => setAdminFilter('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        adminFilter === 'all' ? 'bg-[#292942] text-white' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      All ({adminDoubts.length})
                    </button>
                  </div>
                </div>

                {filteredAdminDoubts.length === 0 ? (
                  <div className="p-8 rounded-2xl bg-[#14141f] border border-[#232333] text-center">
                    <p className="text-sm text-gray-400">No {adminFilter} doubts in the queue.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {filteredAdminDoubts.map((doubt) => {
                      const isSolved = doubt.status === 'solved'
                      const isReplying = solvingDoubtId === doubt.id

                      return (
                        <div
                          key={doubt.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isSolved ? 'bg-[#141422] border-emerald-500/20' : 'bg-[#181829] border-amber-500/40 shadow-md'
                          }`}
                        >
                          {/* Top bar with student username */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-bold text-xs flex items-center justify-center">
                                {(doubt.userName || 'S')[0].toUpperCase()}
                              </span>
                              <span className="text-xs font-bold text-white">@{doubt.userName}</span>
                              <span className="text-[10px] text-gray-400">({doubt.displayName})</span>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#252538] text-purple-300">
                              {doubt.subject}
                            </span>
                          </div>

                          {/* Question */}
                          {doubt.questionText && (
                            <p className="text-xs font-medium text-gray-200 mb-2 leading-relaxed whitespace-pre-wrap">
                              {doubt.questionText}
                            </p>
                          )}

                          {doubt.imageUrl && (
                            <div className="mb-3">
                              <img
                                src={doubt.imageUrl}
                                alt="Question"
                                onClick={() => setImagePreviewModal(doubt.imageUrl)}
                                className="max-h-56 rounded-xl object-contain bg-black/60 border border-[#303046] cursor-zoom-in"
                              />
                              <span className="text-[10px] text-gray-400 mt-1 block">Tap image to zoom full-screen 🔍</span>
                            </div>
                          )}

                          {/* If already solved, show solution */}
                          {isSolved && !isReplying && (
                            <div className="mt-3 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                              <p className="text-xs font-bold text-emerald-300 mb-1">✅ Solved Solution:</p>
                              {doubt.solutionText && <p className="text-xs text-gray-200 mb-2">{doubt.solutionText}</p>}
                              {doubt.solutionImageUrl && (
                                <img
                                  src={doubt.solutionImageUrl}
                                  alt="Solution"
                                  onClick={() => setImagePreviewModal(doubt.solutionImageUrl)}
                                  className="max-h-48 rounded-xl object-contain bg-black/40 border border-emerald-500/30 cursor-zoom-in"
                                />
                              )}
                              <button
                                onClick={() => {
                                  setSolvingDoubtId(doubt.id)
                                  setSolutionText(doubt.solutionText || '')
                                  setSolutionImage(doubt.solutionImageUrl || '')
                                }}
                                className="mt-2 text-[11px] text-amber-300 hover:underline block"
                              >
                                ✏️ Edit Solution
                              </button>
                            </div>
                          )}

                          {/* If replying / solving */}
                          {(!isSolved || isReplying) && (
                            <div className="mt-3 pt-3 border-t border-[#2d2d42]">
                              {!isReplying ? (
                                <button
                                  onClick={() => {
                                    setSolvingDoubtId(doubt.id)
                                    setSolutionText('')
                                    setSolutionImage('')
                                  }}
                                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow transition-all flex items-center gap-1.5"
                                >
                                  <span>✏️</span>
                                  <span>Solve This Doubt</span>
                                </button>
                              ) : (
                                <div className="p-3.5 rounded-xl bg-[#12121e] border border-amber-500/40 flex flex-col gap-3">
                                  <h4 className="text-xs font-bold text-amber-300">Submit Solution to @{doubt.userName}:</h4>
                                  
                                  <textarea
                                    value={solutionText}
                                    onChange={(e) => setSolutionText(e.target.value)}
                                    placeholder="Explain steps, key formulas, or final answer here..."
                                    rows={3}
                                    className="w-full rounded-xl bg-[#1a1a28] border border-[#2e2e46] text-white text-xs p-3 outline-none focus:border-amber-500 transition-colors"
                                  />

                                  {/* Upload Handwritten Solution Photo */}
                                  <div className="flex flex-col gap-2">
                                    <label className="text-[11px] font-semibold text-gray-300">
                                      Handwritten Solution Photo (Optional / Recommended):
                                    </label>
                                    <input
                                      ref={solutionFileInputRef}
                                      type="file"
                                      accept="image/*"
                                      onChange={handleSolutionImageUpload}
                                      className="hidden"
                                    />

                                    {solutionImage ? (
                                      <div className="relative inline-block w-fit">
                                        <img
                                          src={solutionImage}
                                          alt="Solution preview"
                                          className="max-h-40 rounded-xl object-contain border border-amber-500/40"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setSolutionImage('')}
                                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => solutionFileInputRef.current?.click()}
                                        className="px-3 py-2 rounded-xl bg-[#232338] hover:bg-[#2c2c44] border border-[#383854] text-xs font-bold text-gray-300 flex items-center gap-2 w-fit transition-all"
                                      >
                                        <span>📷</span>
                                        <span>Upload Notebook Solution Photo</span>
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => setSolvingDoubtId(null)}
                                      className="px-3 py-2 rounded-xl bg-[#20202e] hover:bg-[#28283a] text-xs font-semibold text-gray-400"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingSolution}
                                      onClick={() => handleAdminSubmitSolution(doubt.id)}
                                      className="flex-1 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all"
                                    >
                                      {isSavingSolution ? 'Sending...' : '🚀 Send Solution to Student'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL: Ask a Doubt (Student) ── */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fadeIn">
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-[#14141f] border border-[#2b2b3f] rounded-3xl max-w-lg w-full p-5 sm:p-6 flex flex-col gap-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="text-base font-bold text-white">Ask Mentor a Doubt</h3>
              </div>
              <button
                onClick={() => setShowAskModal(false)}
                className="w-7 h-7 rounded-full bg-[#202030] text-gray-400 hover:text-white flex items-center justify-center text-xs"
              >
                ✕
              </button>
            </div>

            {/* Token notice banner */}
            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
              <span>{balance.freeDoubtAvailable ? '🎁' : '⚡'}</span>
              <span>
                {balance.freeDoubtAvailable
                  ? 'This will use your 1 Free Welcome Doubt.'
                  : `This will use 1 of your ${balance.paidDoubtsBalance} paid tokens.`}
              </span>
            </div>

            <form onSubmit={handleSubmitDoubt} className="flex flex-col gap-4">
              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">Select Subject</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl bg-[#1b1b2a] border border-[#2e2e46] text-white text-xs px-3.5 py-2.5 outline-none focus:border-purple-500 transition-colors"
                >
                  {SUBJECT_OPTIONS.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* Question Text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">Question / Problem Details</label>
                <textarea
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  placeholder="Type the question or explain what concept you're confused about..."
                  rows={4}
                  className="w-full rounded-xl bg-[#1b1b2a] border border-[#2e2e46] text-white text-xs p-3 outline-none focus:border-purple-500 transition-colors leading-relaxed"
                />
              </div>

              {/* Question Image Upload */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-300">Attach Question Photo (Recommended)</label>
                <input
                  ref={questionFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleQuestionImageUpload}
                  className="hidden"
                />

                {questionImage ? (
                  <div className="relative inline-block w-fit">
                    <img
                      src={questionImage}
                      alt="Question preview"
                      className="max-h-48 rounded-xl object-contain border border-purple-500/40 bg-black/40"
                    />
                    <button
                      type="button"
                      onClick={() => setQuestionImage('')}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => questionFileInputRef.current?.click()}
                    className="p-4 rounded-xl border border-dashed border-[#3a3a54] hover:border-purple-500/60 bg-[#171724] hover:bg-[#1e1e30] flex flex-col items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
                  >
                    <span className="text-2xl">📷</span>
                    <span className="text-xs font-bold text-gray-300">Click or Upload Photo of Question</span>
                    <span className="text-[10px] text-gray-500">JPG, PNG, or Camera snapshot</span>
                  </button>
                )}
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
                  {submitError}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#202030] text-gray-300 text-xs font-bold hover:bg-[#28283c] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit to Mentor 🚀'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* ── MODAL: Top-up / Payment Pack ── */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md p-3 sm:p-4 animate-fadeIn">
          <div className="min-h-full flex items-center justify-center py-4">
            <div className="bg-[#131320] border border-[#2c2c42] rounded-3xl max-w-md w-full p-4 sm:p-5 flex flex-col gap-3.5 shadow-2xl my-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-1 border-b border-[#232336]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-lg">
                  💎
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white">Mentor Doubt Tokens</h3>
                  <p className="text-[10px] text-gray-400">Step-by-step physical solutions</p>
                </div>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="w-7 h-7 rounded-full bg-[#1e1e2f] hover:bg-[#28283e] text-gray-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Stepper Tabs */}
            <div className="flex rounded-xl bg-[#0c0c16] p-1 border border-[#232338]">
              <button
                type="button"
                onClick={() => setPayModalStep(1)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payModalStep === 1
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>1. Select & Pay</span>
              </button>
              <button
                type="button"
                onClick={() => setPayModalStep(2)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  payModalStep === 2
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <span>2. Enter UTR (Activate)</span>
                {enteredUtr.length === 12 && (
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 text-black text-[9px] flex items-center justify-center font-black">
                    ✓
                  </span>
                )}
              </button>
            </div>

            {/* STEP 1: Select Pack & Scan QR */}
            {payModalStep === 1 && (
              <div className="flex flex-col gap-3.5 animate-fadeIn">
                {/* 3 Compact Cards */}
                <div>
                  <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-2 block">
                    Choose Pack:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {PRICING_PACKS.map((pack) => {
                      const isSelected = selectedPack.id === pack.id
                      return (
                        <div
                          key={pack.id}
                          onClick={() => setSelectedPack(pack)}
                          className={`relative p-2.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-purple-950/40 border-purple-500 shadow-md ring-1 ring-purple-500/60'
                              : 'bg-[#181827] border-[#29293e] hover:border-gray-500'
                          }`}
                        >
                          {pack.badge && (
                            <span className="text-[8px] font-black px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 mb-1 inline-block truncate">
                              {pack.badge}
                            </span>
                          )}
                          <div className="my-auto py-1">
                            <span className="text-base sm:text-lg font-black text-white font-mono block">
                              ₹{pack.price}
                            </span>
                            <span className="text-[11px] font-bold text-purple-300 block">
                              {pack.count} {pack.count > 1 ? 'Doubts' : 'Doubt'}
                            </span>
                          </div>
                          <span className="text-[9px] text-gray-400 mt-1 block">
                            ₹{(pack.price / pack.count).toFixed(0)}/doubt
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Amount-locked QR Code Card */}
                <div className="p-3.5 rounded-2xl bg-[#171727] border border-[#2b2b40] flex flex-col items-center text-center gap-2.5 shadow-inner">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-gray-300">Scan via Any UPI App</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                      <span>🔒</span>
                      <span>Amount Locked: ₹{selectedPack.price}.00</span>
                    </span>
                  </div>

                  {/* QR Image */}
                  <div className="w-36 h-36 bg-white p-2 rounded-2xl shadow-xl flex items-center justify-center border-2 border-purple-500/40">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(
                        generateLockedUpiUri(selectedPack.price, selectedPack.count)
                      )}`}
                      alt={`UPI QR Locked ₹${selectedPack.price}`}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>

                  <p className="text-[10px] text-gray-400">
                    Payee: <b className="text-gray-200">Study Tracker Mentor</b> • Paytm, PhonePe, GPay, BHIM
                  </p>

                  {/* Open in UPI App Direct Button */}
                  <a
                    href={generateLockedUpiUri(selectedPack.price, selectedPack.count)}
                    className="w-full py-2.5 rounded-xl bg-[#262640] hover:bg-[#323255] border border-[#3e3e62] text-xs font-bold text-white flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
                  >
                    <span>📱</span>
                    <span>Open in UPI App to Pay ₹{selectedPack.price}</span>
                  </a>
                </div>

                {/* Continue to Step 2 */}
                <button
                  type="button"
                  onClick={() => {
                    setPayModalStep(2)
                    setUtrError('')
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}
                >
                  <span>I Have Paid ➔ Enter UTR (Next)</span>
                </button>
              </div>
            )}

            {/* STEP 2: Enter 12-Digit UTR */}
            {payModalStep === 2 && (
              <form onSubmit={handleVerifyPayment} className="flex flex-col gap-3.5 animate-fadeIn">
                {/* Pack Selection Recap */}
                <div className="p-3 rounded-2xl bg-[#171727] border border-[#2b2b40] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-gray-400 font-bold uppercase block">Selected Pack</span>
                    <span className="text-xs font-extrabold text-white">
                      {selectedPack.label} ({selectedPack.count} Doubts) • <b className="text-emerald-400 font-mono">₹{selectedPack.price}</b>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPayModalStep(1)}
                    className="px-2 py-1 rounded-lg bg-[#252538] hover:bg-[#303046] text-purple-300 text-[10px] font-bold transition-colors cursor-pointer"
                  >
                    Change Pack
                  </button>
                </div>

                {/* UTR Input Section */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>12-Digit UTR / UPI Ref ID:</span>
                    </label>
                    <span
                      className={`text-[10px] font-mono font-bold ${
                        enteredUtr.length === 12 ? 'text-emerald-400' : 'text-gray-400'
                      }`}
                    >
                      {enteredUtr.length}/12 digits {enteredUtr.length === 12 && '✓'}
                    </span>
                  </div>

                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={enteredUtr}
                      onChange={(e) => {
                        setEnteredUtr(e.target.value.replace(/\D/g, '').slice(0, 12))
                        setUtrError('')
                      }}
                      placeholder="e.g. 428192839182"
                      maxLength={12}
                      autoFocus
                      className="w-full rounded-xl bg-[#0e0e18] border border-[#2e2e46] text-amber-300 font-mono text-sm pl-3.5 pr-20 py-2.5 outline-none focus:border-purple-500 transition-colors tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={handlePasteUtr}
                      className="absolute right-2 px-2.5 py-1 rounded-lg bg-[#222238] hover:bg-[#2c2c46] text-purple-300 text-[10px] font-bold border border-[#383854] transition-all cursor-pointer flex items-center gap-1"
                    >
                      <span>📋</span>
                      <span>Paste</span>
                    </button>
                  </div>

                  <p className="text-[10px] text-gray-400 leading-relaxed mt-0.5">
                    💡 PhonePe, GPay ya Paytm payment receipt me neeche <b>12-digit UPI Ref ID / UTR</b> likha hota hai.
                  </p>
                </div>

                {utrError && (
                  <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 text-xs">
                    {utrError}
                  </div>
                )}

                {/* Instant Activate Button */}
                <button
                  type="submit"
                  disabled={isVerifyingUtr || enteredUtr.length !== 12}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    opacity: isVerifyingUtr || enteredUtr.length !== 12 ? 0.5 : 1,
                    cursor: isVerifyingUtr || enteredUtr.length !== 12 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>⚡</span>
                  <span>
                    {isVerifyingUtr
                      ? 'Verifying with Records...'
                      : `Verify & Credit ${selectedPack.count} Token(s)`}
                  </span>
                </button>

                {/* Back to Step 1 */}
                <button
                  type="button"
                  onClick={() => setPayModalStep(1)}
                  className="text-center text-[11px] font-bold text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  ← Back to QR & Pay
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
      )}

      {/* ── MODAL: Image Zoom Preview ── */}
      {imagePreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn cursor-zoom-out"
          onClick={() => setImagePreviewModal(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex items-center justify-center">
            <img
              src={imagePreviewModal}
              alt="Zoomed"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl border border-white/20"
            />
            <button
              onClick={() => setImagePreviewModal(null)}
              className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-red-600 text-white font-bold flex items-center justify-center shadow-lg"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1c1c2e] border border-purple-500/50 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-bold animate-fadeIn flex items-center gap-2">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
