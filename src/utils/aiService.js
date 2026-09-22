/**
 * aiService.js
 * Account-Aware AI Study Coach & Time Table Generator using Google Gemini 1.5 Flash.
 *
 * Features:
 * - Direct Gemini API integration with smart prompt engineering
 * - Fallback intelligent algorithm generator when offline or no API key is provided
 * - Real-time account context injection (streak, weekly hours, subject breakdown, syllabus)
 * - Built-in daily rate limiting (10 queries/day) stored in localStorage
 */

import {
  getUserDoc,
  getUserSessions,
  getSyllabus,
  calculateStreaks,
  groupSessionsByDate,
  getUserSettings,
} from './firestoreHelpers.js'
import { todayString, formatHoursMinutes, formatDuration } from './formatTime.js'

const GEMINI_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-flash-latest',
]
const DAILY_LIMIT = 30
const STORAGE_LIMIT_KEY = 'stt_ai_daily_usage'
const STORAGE_API_KEY = 'stt_custom_gemini_api_key'

// Default project master key — works for every user out-of-the-box!
const _B64_KEY = 'QVEuQWI4Uk42SUp0cjg2dlAtcHhwRUlHYTRRZzJXNnN3aXFyMEM2M1o4QkNPNWlWbHF3dUE='
const DEFAULT_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  (typeof atob === 'function' ? atob(_B64_KEY) : '')

export function getGeminiApiKey() {
  if (typeof window === 'undefined') return DEFAULT_KEY
  return localStorage.getItem(STORAGE_API_KEY) || DEFAULT_KEY
}

export function getCustomGeminiApiKey() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(STORAGE_API_KEY) || ''
}

export function hasCustomGeminiApiKey() {
  const custom = getCustomGeminiApiKey()
  return Boolean(custom && custom.trim())
}

export function hasGeminiApiKey() {
  const key = getGeminiApiKey()
  return Boolean(key && key.trim())
}

export function setGeminiApiKey(key) {
  if (typeof window === 'undefined') return
  if (key && key.trim()) {
    localStorage.setItem(STORAGE_API_KEY, key.trim())
  } else {
    localStorage.removeItem(STORAGE_API_KEY)
  }
}

/**
 * Resilient multi-model Gemini API caller with automatic fallback
 */
async function callGeminiAPI(apiKey, payload) {
  let lastErr = null
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const msg = errJson?.error?.message || `HTTP ${res.status}`
        lastErr = new Error(msg)
        if (res.status === 503 || res.status === 404) {
          continue
        }
        throw lastErr
      }
      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts || []
      const text = parts.map((p) => p.text || '').filter(Boolean).join('\n').trim()
      if (text) return text
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Could not connect to Gemini AI.')
}

/**
 * Tests whether a Gemini API key is valid by making a minimal request
 */
export async function testGeminiApiKey(key) {
  if (!key || !key.trim()) {
    throw new Error('Please enter a valid Gemini API Key.')
  }
  await callGeminiAPI(key.trim(), {
    contents: [{ parts: [{ text: 'Respond with: OK' }] }],
  })
  return true
}

/**
 * Checks and increments daily AI query limit
 */
export function checkAndIncrementDailyLimit() {
  if (typeof window === 'undefined') return { allowed: true, remaining: DAILY_LIMIT }
  const today = todayString()
  try {
    const raw = localStorage.getItem(STORAGE_LIMIT_KEY)
    let state = raw ? JSON.parse(raw) : { date: today, count: 0 }
    if (state.date !== today) {
      state = { date: today, count: 0 }
    }
    if (state.count >= DAILY_LIMIT) {
      return { allowed: false, remaining: 0, count: state.count }
    }
    state.count += 1
    localStorage.setItem(STORAGE_LIMIT_KEY, JSON.stringify(state))
    return { allowed: true, remaining: DAILY_LIMIT - state.count, count: state.count }
  } catch {
    return { allowed: true, remaining: DAILY_LIMIT }
  }
}

export function getRemainingDailyQuota() {
  if (typeof window === 'undefined') return DAILY_LIMIT
  const today = todayString()
  try {
    const raw = localStorage.getItem(STORAGE_LIMIT_KEY)
    if (!raw) return DAILY_LIMIT
    const state = JSON.parse(raw)
    if (state.date !== today) return DAILY_LIMIT
    return Math.max(0, DAILY_LIMIT - (state.count || 0))
  } catch {
    return DAILY_LIMIT
  }
}

/**
 * Aggregates complete account knowledge for AI context
 */
export async function buildUserAIContext(userName) {
  if (!userName) return null

  try {
    const uKey = userName.toLowerCase()

    // Local cached fallbacks for instant & offline reliability
    let localSessions = []
    let localSettings = { sundayRestDay: false, effectiveFrom: null }
    let localUserDoc = null
    try {
      const rawS = localStorage.getItem(`stt_user_sessions_${uKey}`)
      if (rawS) localSessions = JSON.parse(rawS)
      const rawSet = localStorage.getItem(`stt_settings_${uKey}`)
      if (rawSet) localSettings = JSON.parse(rawSet)
      const rawDoc = localStorage.getItem(`stt_user_doc_${uKey}`)
      if (rawDoc) localUserDoc = JSON.parse(rawDoc)
    } catch {}

    const [userDocRemote, sessionsRemote, syllabusRemote, settingsRemote] = await Promise.all([
      getUserDoc(userName).catch(() => null),
      getUserSessions(userName).catch(() => []),
      getSyllabus(userName).catch(() => []),
      getUserSettings(userName).catch(() => null),
    ])

    const userDoc = userDocRemote || localUserDoc || {}
    const sessions = (sessionsRemote && sessionsRemote.length > 0) ? sessionsRemote : localSessions
    const settings = settingsRemote || localSettings || userDoc?.settings || { sundayRestDay: false }
    const syllabus = syllabusRemote || []

    const dateGroups = groupSessionsByDate(sessions || [])
    const streakInfo = calculateStreaks(dateGroups, settings)

    // Calculate subject distribution for the last 14 days
    const subjectMap = {}
    let totalPast14DaysSec = 0
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 14)
    const cutoffStr = cutoffDate.toISOString().slice(0, 10)

    for (const s of (sessions || [])) {
      if (s.date && s.date >= cutoffStr) {
        const subj = s.subject || 'General Study'
        subjectMap[subj] = (subjectMap[subj] || 0) + (s.totalSeconds || 0)
        totalPast14DaysSec += s.totalSeconds || 0
      }
    }

    const subjectBreakdown = Object.entries(subjectMap).map(([subject, sec]) => ({
      subject,
      hours: Number((sec / 3600).toFixed(1)),
      pct: totalPast14DaysSec > 0 ? Math.round((sec / totalPast14DaysSec) * 100) : 0,
    }))

    // Check today's study
    const today = todayString()
    const todaySessions = (sessions || []).filter((s) => s.date === today)
    let todayStudiedSec = todaySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

    try {
      const rawPlan = localStorage.getItem(`stt_day_plan_${uKey}_${today}`)
      if (rawPlan) {
        const p = JSON.parse(rawPlan)
        if (p?.actualSeconds && p.actualSeconds > todayStudiedSec) {
          todayStudiedSec = p.actualSeconds
        }
      }
    } catch {}

    // Target hours
    let targetHours = 6
    try {
      const rawPlan = localStorage.getItem(`stt_day_plan_${uKey}_${today}`)
      if (rawPlan) {
        const p = JSON.parse(rawPlan)
        if (p?.targetHours !== undefined) targetHours = Number(p.targetHours)
      } else if (userDoc?.dayPlanners?.[today]?.targetHours) {
        targetHours = Number(userDoc.dayPlanners[today].targetHours)
      }
    } catch {}

    return {
      userName,
      displayName: userDoc?.displayName || userName,
      examGoal: userDoc?.examGoal || null,
      currentStreak: streakInfo.currentStreak || 0,
      longestStreak: streakInfo.longestStreak || 0,
      totalSessionsAllTime: sessions?.length || 0,
      todayStudiedHours: Number((todayStudiedSec / 3600).toFixed(1)),
      todayTargetHours: targetHours,
      last14DaysTotalHours: Number((totalPast14DaysSec / 3600).toFixed(1)),
      subjectBreakdown,
      syllabusList: Array.isArray(syllabus) ? syllabus.map((s) => s.name || s.title || s) : [],
    }
  } catch (err) {
    console.warn('Could not build AI context:', err)
    return { userName }
  }
}

/**
 * Generates an intelligent Time Table based on user routine and goals.
 * Returns an array of structured slots:
 * [{ time: "06:00 AM - 08:00 AM", slotType: "Core Study", subject: "Polity", topic: "Fundamental Rights", plan: "Revise Articles 12-35", block: "Morning" }]
 */
export async function generateAITimeTable(userContext, {
  examTarget = '',
  routineType = 'dedicated', // 'dedicated' | 'job' | 'college' | 'coaching'
  occupiedHours = '', // e.g. "09:00 AM - 05:00 PM (Job)"
  targetStudyHours = 6,
  wakeTime = '06:00 AM',
  sleepTime = '11:00 PM',
  subjectsToCover = [],
  notes = '',
}) {
  const quota = checkAndIncrementDailyLimit()
  if (!quota.allowed) {
    throw new Error('Daily AI limit reached (15/15 requests). Quota resets tomorrow at 12:00 AM!')
  }

  const apiKey = getGeminiApiKey()

  const prompt = `
You are an expert academic time-management coach and mentor for students and competitive exam aspirants.
Create a highly practical, realistic, and productive DAILY STUDY TIME TABLE for the student.

STUDENT PROFILE:
- Name: ${userContext.displayName || userContext.userName}
- Target Exam: ${examTarget || userContext.examGoal?.name || 'Competitive / Academic Exam'}
- Target Study Hours Today: ${targetStudyHours} hours
- Daily Routine: ${routineType} (${occupiedHours ? `Busy during: ${occupiedHours}` : 'Full time study'})
- Wake Up Time: ${wakeTime}, Sleep Time: ${sleepTime}
- Subjects & Syllabus: ${subjectsToCover.length > 0 ? subjectsToCover.join(', ') : (userContext.syllabusList?.join(', ') || 'Polity, History, Geography, Reasoning, Science')}
- User Notes / Preferences: ${notes || 'Include short breaks and a night revision slot.'}
- Recent Study Context: Current Streak: ${userContext.currentStreak} days, Past 14 Days Studied: ${userContext.last14DaysTotalHours} hours.

REQUIREMENTS:
1. Break down the day into distinct time-of-day blocks:
   - "Morning" (e.g. 06:00 AM - 09:00 AM)
   - "Afternoon" (e.g. 10:00 AM - 04:00 PM)
   - "Evening" (e.g. 05:00 PM - 08:00 PM)
   - "Night" (e.g. 09:00 PM - 11:00 PM)
2. Total study time across study slots MUST closely equal ${targetStudyHours} hours.
3. Assign an appropriate "slotType" for each row from strictly:
   ["Core Study", "Revision", "Mock Test", "Practice", "Break"]
4. Include at least one dedicated Revision slot (Spaced Repetition) and short breaks.
5. Return ONLY a valid JSON array matching this exact schema:
[
  {
    "id": "slot_1",
    "block": "Morning",
    "time": "06:00 AM - 08:00 AM",
    "slotType": "Core Study",
    "subject": "Subject Name",
    "topic": "Specific Topic",
    "plan": "Actionable task for this slot",
    "done": false
  }
]
IMPORTANT: Return strictly RAW JSON with no markdown formatting, backticks, or other text outside the JSON array.
`

  if (apiKey) {
    try {
      const rawText = await callGeminiAPI(apiKey, {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      })

      let cleaned = rawText.trim()
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        cleaned = jsonMatch[0]
      } else {
        cleaned = cleaned.replace(/```json/gi, '').replace(/```/g, '').trim()
      }

      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          id: item.id || `slot_ai_${Date.now()}_${idx}`,
          block: item.block || 'Morning',
          time: item.time || '08:00 AM - 10:00 AM',
          slotType: item.slotType || 'Core Study',
          subject: item.subject || 'General Study',
          topic: item.topic || '',
          plan: item.plan || '',
          done: false,
        }))
      }
    } catch (err) {
      console.warn('Gemini API call failed, using high-quality local algorithmic scheduler:', err)
    }
  }

  // Fallback intelligent generator (works 100% offline or without API key)
  const actualSubjects = subjectsToCover.length > 0
    ? subjectsToCover
    : (Array.isArray(userContext.syllabusList) && userContext.syllabusList.length > 0
        ? userContext.syllabusList
        : (Array.isArray(userContext.subjectBreakdown) && userContext.subjectBreakdown.length > 0
            ? userContext.subjectBreakdown.map((s) => s.subject)
            : ['Core Study', 'Practice & MCQs', 'Revision']))

  return generateAlgorithmicTimeTable({
    targetStudyHours,
    routineType,
    wakeTime,
    sleepTime,
    subjects: actualSubjects,
    examTarget: examTarget || userContext.examGoal?.name || '',
    notes,
  })
}

/**
 * Intelligent local timetable fallback algorithm — dynamically uses actual subjects & exam target
 */
function generateAlgorithmicTimeTable({ targetStudyHours, routineType, wakeTime, sleepTime, subjects, examTarget, notes }) {
  const subjs = subjects.length > 0 ? subjects : ['Core Theory', 'Problem Solving', 'Revision']
  const slots = []
  let sIdx = 0
  const nextSubj = () => {
    const s = subjs[sIdx % subjs.length]
    sIdx++
    return s
  }

  const examPrefix = examTarget ? `${examTarget}` : 'Target Exam'

  if (routineType === 'job' || routineType === 'college') {
    slots.push({
      id: `slot_${Date.now()}_1`,
      block: 'Morning',
      time: '06:00 AM - 08:00 AM',
      slotType: 'Core Study',
      subject: nextSubj(),
      topic: `${examPrefix} - High Weightage Theory`,
      plan: 'Morning fresh mind: Concept notes reading & formula derivation',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_2`,
      block: 'Afternoon',
      time: '09:00 AM - 05:00 PM',
      slotType: 'Break',
      subject: 'Office / College',
      topic: 'Daily Work Hours',
      plan: 'Stay hydrated; quick 10-min formula flashcards review during break',
      done: true,
    })
    slots.push({
      id: `slot_${Date.now()}_3`,
      block: 'Evening',
      time: '06:30 PM - 08:30 PM',
      slotType: 'Practice',
      subject: nextSubj(),
      topic: `${examPrefix} - PYQ & Problem Solving`,
      plan: 'Solve 30-40 targeted questions with stopwatch & analyze errors',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_4`,
      block: 'Night',
      time: '09:30 PM - 10:30 PM',
      slotType: 'Revision',
      subject: nextSubj(),
      topic: 'Daily Spaced Repetition Wrap-up',
      plan: 'Review all concepts studied today before sleep',
      done: false,
    })
  } else {
    // Full-time dedicated student
    slots.push({
      id: `slot_${Date.now()}_1`,
      block: 'Morning',
      time: '06:30 AM - 08:30 AM',
      slotType: 'Core Study',
      subject: nextSubj(),
      topic: `${examPrefix} - Core Concept Mastery`,
      plan: 'Peak alertness: Deep theory reading without distractions',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_2`,
      block: 'Morning',
      time: '09:30 AM - 11:30 AM',
      slotType: 'Core Study',
      subject: nextSubj(),
      topic: `${examPrefix} - Sectional Syllabus Deep-Dive`,
      plan: 'Structured textbook reading and concise self-summary notes',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_3`,
      block: 'Afternoon',
      time: '02:00 PM - 04:00 PM',
      slotType: 'Practice',
      subject: nextSubj(),
      topic: 'Previous Year Exam Questions (PYQs)',
      plan: 'Exam-like timed conditions: speed & accuracy drill',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_4`,
      block: 'Evening',
      time: '05:30 PM - 07:30 PM',
      slotType: 'Mock Test',
      subject: nextSubj(),
      topic: 'Sectional Mock & Mistake Analysis',
      plan: 'Full sectional test; log every mistake in error notebook',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_5`,
      block: 'Night',
      time: '09:00 PM - 10:30 PM',
      slotType: 'Revision',
      subject: 'Daily Revision',
      topic: 'Active Recall & Tomorrow Prep',
      plan: '10-minute quick spaced review per subject studied today',
      done: false,
    })
  }

  return slots
}

/**
 * Account-Aware AI Study Coach Chat
 */
export async function chatWithAIMentor(userContext, chatHistory, userMessage) {
  const quota = checkAndIncrementDailyLimit()
  if (!quota.allowed) {
    throw new Error('Daily AI message quota reached (30/30). Resetting at 12:00 AM!')
  }

  const apiKey = getGeminiApiKey()

  const systemContextPrompt = `You are Kit (Kit AI), a friendly, highly intelligent, versatile AI study coach and mentor on JeetPrep for @${userContext?.userName || 'student'}.

CORE CONVERSATIONAL BEHAVIOR:
1. TALK LIKE REAL KIT AI (NATURAL, SHARP & ADAPTIVE):
   - Be friendly, warm, and direct.
   - If the user sends a casual greeting or small talk ("hi", "hello", "kya haal hai", "hey", "sup"), reply briefly and warmly in 1-2 sentences. Example: "Hey ${userContext?.displayName || userContext?.userName || 'Dost'}! Main Kit hoon. Kaise ho? Aaj kis exam, topic ya study plan me help chahiye?"
   - NEVER give unsolicited lectures, study audits, or long action plans when the user just greets you.
2. ANSWER ANY QUESTION FREELY:
   - The user can ask you about ANYTHING:
     * Competitive exams: SSC CGL/CHSL, UPSC, Railways, State PSC, Banking, JEE, NEET (eligibility, age limit, syllabus, books, strategy, cutoffs).
     * Subject concepts, maths shortcuts, reasoning tricks, history dates, science topics, grammar, essay outlines.
     * General knowledge, daily motivation, productivity tips, or life advice.
   - Answer their specific question accurately, clearly, and concisely without forcing the topic back to their tracker logs.
3. BACKGROUND ACCOUNT DATA (USE ONLY WHEN RELEVANT):
   - You have background knowledge about their study profile (below).
   - ONLY reference their study hours, streak, or subjects when:
     a) They specifically ask about their performance, streak, progress, timetable, or study stats.
     b) Or when it directly helps answer their strategy question (e.g. they ask "mere liye schedule banao" and you know their target exam).
   - Never recite their raw metrics in a robotic way.
4. TONE & LANGUAGE:
   - Match the user's language (Hindi, Hinglish, or English).
   - Keep answers clean, structured with markdown bullets when appropriate, and proportional to what was asked.

STUDENT PROFILE (Background reference):
- Name: ${userContext?.displayName || userContext?.userName || 'Aspirant'}
- Target Exam: ${userContext?.examGoal?.name || 'Not set'}
- Current Active Streak: ${userContext?.currentStreak || 0} days
- Today Studied: ${userContext?.todayStudiedHours || 0}h (Target: ${userContext?.todayTargetHours || 6}h)
- Last 14 Days Logged: ${userContext?.last14DaysTotalHours || 0}h
- Recent Subjects: ${userContext?.subjectBreakdown?.map((s) => `${s.subject}: ${s.hours}h`).join(', ') || 'No logs yet'}
- Registered Syllabus: ${userContext?.syllabusList?.join(', ') || 'None'}
`

  if (apiKey) {
    try {
      // Build clean multi-turn history ensuring valid alternation and starting with user
      let sanitizedHistory = (chatHistory || [])
        .filter((m) => m && m.text && (m.role === 'user' || m.role === 'assistant') && m.id !== 'welcome')
        .slice(-8)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        }))

      while (sanitizedHistory.length > 0 && sanitizedHistory[0].role !== 'user') {
        sanitizedHistory.shift()
      }

      const alternated = []
      for (const item of sanitizedHistory) {
        if (alternated.length === 0 || alternated[alternated.length - 1].role !== item.role) {
          alternated.push(item)
        }
      }

      if (alternated.length > 0 && alternated[alternated.length - 1].role === 'user') {
        alternated.pop()
      }

      const contents = [
        ...alternated,
        { role: 'user', parts: [{ text: userMessage }] },
      ]

      const answer = await callGeminiAPI(apiKey, {
        systemInstruction: {
          parts: [{ text: systemContextPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.7,
        },
      })
      if (answer) return answer.trim()
    } catch (err) {
      console.warn('Gemini chat failed, generating local coaching insight:', err)
    }
  }

  // Fallback smart offline coaching response based on actual data
  return generateOfflineCoachResponse(userContext, userMessage)
}

/**
 * Generates local intelligent coaching analysis based on user account data
 */
function generateOfflineCoachResponse(userContext, query) {
  const q = (query || '').toLowerCase().trim()
  const streak = userContext.currentStreak || 0
  const todayHrs = userContext.todayStudiedHours || 0
  const targetHrs = userContext.todayTargetHours || 6
  const breakdown = userContext.subjectBreakdown || []
  const exam = userContext.examGoal?.name || 'Aapka Target Exam'
  const name = userContext.displayName || userContext.userName || 'Dost'

  // Greetings: hi, hello, hey, etc.
  if (/^(hi|hello|hey|hlo|namaste|hola|sup|good morning|good evening)\b/i.test(q)) {
    return `👋 **Hey ${name}! Main Kit hoon.** Kaise ho? Aaj kis exam, topic ya study plan me help chahiye? Kuch bhi pooch sakte ho!`
  }

  // SSC / General Exam inquiry
  if (q.includes('ssc')) {
    return `🎯 **SSC Exams Guide:**\n\n- **SSC CGL (Graduate Level):** Tier-1 & Tier-2 (Maths, Reasoning, English, General Awareness, Computer).\n- **SSC CHSL (10+2 Level):** LDC, DEO, JSA posts.\n- **Eligibility:** CGL ke liye graduation, CHSL ke liye 12th pass; age generally 18-27 ya 18-32 years.\n\nAapko specific syllabus ya subject booklist ke baare me poochhna hai?`
  }

  // Case 1: Performance / Progress analysis (only when explicitly asked)
  if (q.includes('performance') || q.includes('progress') || q.includes('kaisa chal raha') || q.includes('report') || q.includes('analyze') || q.includes('streak')) {
    let neglected = breakdown.length > 1 ? breakdown[breakdown.length - 1] : null
    let dominant = breakdown.length > 0 ? breakdown[0] : null

    return `📊 **Aapka Study Analysis (${name}):**\n\n🔥 **Streak & Consistency:**\n- Current Streak: **${streak} days** 🔥\n- Today's Study: **${todayHrs}h** / ${targetHrs}h target.\n\n📚 **Subjects:**\n${dominant ? `- Top Focus: ${dominant.subject} (${dominant.hours}h)\n` : ''}${neglected && neglected !== dominant ? `- Kam time: ${neglected.subject} (${neglected.hours}h) — ispar thoda dhyan dein.\n` : ''}\nKuch specific study plan ya tip chahiye toh batao!`
  }

  // Case 2: Weak subject inquiry
  if (q.includes('subject') || q.includes('kam') || q.includes('weak') || q.includes('neglect')) {
    if (breakdown.length > 1) {
      const weak = breakdown[breakdown.length - 1]
      return `⚖️ **Subject Analysis:**\nAapke data ke mutabiq pichle 14 din me **${weak.subject}** ko sabse kam time (${weak.hours} hours, ${weak.pct}%) mila hai.\n\n👉 **Tip:** Kal ke planner me **${weak.subject}** ke 2 continuous slots pehle se schedule karein.`
    }
  }

  // Case 3: Exam Prep / Strategy / Kaise padhein / Target
  if (q.includes('exam') || q.includes('prep') || q.includes('target') || q.includes('kese') || q.includes('kaise') || q.includes('strategy') || q.includes('tips')) {
    return `🎯 **${exam} Ke Liye Smart Strategy:**\n\n1. **Morning (Concepts):** Naye aur tough topics fresh dimaag se padhein.\n2. **Afternoon (Practice):** PYQs, numericals aur mock test questions solve karein.\n3. **Night (Revision):** 30-45 minute active recall revision karein.\n\nAapka current streak **${streak} days** hai — consistency maintain rakhein!`
  }

  // Case 4: Routine / Time Table / Schedule
  if (q.includes('routine') || q.includes('time table') || q.includes('timetable') || q.includes('schedule') || q.includes('kab')) {
    return `⏰ **Suggested Daily Study Routine (${targetHrs}h Target):**\n\n- 🌅 **06:30 - 08:30 AM (2h):** High-Weightage Core Subject\n- 📖 **09:30 - 11:30 AM (2h):** Second Subject / Theory\n- ✍️ **02:00 - 04:00 PM (2h):** Practice Questions & PYQs\n- 🧠 **08:30 - 09:30 PM (1h):** Spaced Repetition Revision\n\nDay Planner me jaakar **"✨ AI Generator"** par click karke customized time table auto-generate bhi kar sakte hain!`
  }

  // Case 5: Motivation / Focus / Distraction
  if (q.includes('focus') || q.includes('distract') || q.includes('motivation') || q.includes('man') || q.includes('burnout')) {
    return `🔥 **Focus & Motivation Tips:**\n\n1. **Pomodoro:** 50 min deep study + 10 min break. Phone ko dusre kamre me rakhein.\n2. **5-Minute Rule:** Jab padhne ka man na kare, sirf timer on karke bolo "main bas 5 minute baithunga". Flow apne aap ban jata hai.\n3. Aapne ab tak **${userContext.totalSessionsAllTime || 0} sessions** aur **${streak} days streak** banayi hai. Momentum tootne mat do!`
  }

  // Default friendly response
  return `👋 **Hey ${name}!**\n\nAap mujhse kisi bhi exam details (SSC, UPSC, JEE, etc.), doubts, syllabus, time table ya study tips ke baare me pooch sakte hain.\n\nAapko kis topic me help chahiye?`
}
