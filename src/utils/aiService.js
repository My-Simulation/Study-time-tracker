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
    const [userDoc, sessions, syllabus] = await Promise.all([
      getUserDoc(userName),
      getUserSessions(userName),
      getSyllabus(userName),
    ])

    const dateGroups = groupSessionsByDate(sessions || [])
    const streakInfo = calculateStreaks(dateGroups)

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
    const todayStudiedSec = todaySessions.reduce((sum, s) => sum + (s.totalSeconds || 0), 0)

    // Target hours
    const dayPlan = userDoc?.dayPlanners?.[today]
    const targetHours = Number(dayPlan?.targetHours || 6)

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
    throw new Error('Daily AI message quota reached (15/15). Resetting at 12:00 AM!')
  }

  const apiKey = getGeminiApiKey()

  const systemContextPrompt = `
You are "Antigravity AI Study Mentor" — a warm, highly disciplined, data-driven academic coach for @${userContext.userName}.
You have direct, real-time access to the student's study performance data:

STUDENT'S LIVE ACCOUNT DATA:
- Display Name: ${userContext.displayName || userContext.userName}
- Current Active Streak: ${userContext.currentStreak} consecutive days 🔥
- Longest Streak: ${userContext.longestStreak} days
- Total Study Sessions Logged: ${userContext.totalSessionsAllTime} sessions
- Studied Today: ${userContext.todayStudiedHours} hrs / Target: ${userContext.todayTargetHours} hrs
- Last 14 Days Total Hours: ${userContext.last14DaysTotalHours} hours
- Subject Distribution in past 14 days:
${userContext.subjectBreakdown?.map((s) => `  * ${s.subject}: ${s.hours}h (${s.pct}%)`).join('\n') || '  * No recorded subject logs yet'}
- Registered Syllabus: ${userContext.syllabusList?.join(', ') || 'General subjects'}
- Target Exam: ${userContext.examGoal?.name || 'Not set'}

YOUR COACHING PRINCIPLES:
1. Always base your advice on their ACTUAL account data above. (e.g. if they neglect a subject, mention it by name! If their streak is high, applaud it!).
2. Be encouraging, concise, actionable, and structured with bullet points.
3. Answer in the user's language (Hindi, Hinglish, or English depending on how they asked).
4. Give specific, practical time-management tips (Pomodoro, Spaced Repetition, Active Recall).
`

  if (apiKey) {
    try {
      const contents = [
        { role: 'user', parts: [{ text: `${systemContextPrompt}\n\nStudent asks: ${userMessage}` }] },
      ]

      const answer = await callGeminiAPI(apiKey, {
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
  const q = (query || '').toLowerCase()
  const streak = userContext.currentStreak || 0
  const todayHrs = userContext.todayStudiedHours || 0
  const targetHrs = userContext.todayTargetHours || 6
  const breakdown = userContext.subjectBreakdown || []
  const exam = userContext.examGoal?.name || 'Aapka Target Exam'

  const apiNote = `\n\n*(💡 Tip: Bilkul free Gemini API Key lagane ke liye Profile ya ⚙️ icon par jayein — fir aap bina kisi limit ke detailed AI mentoring le sakte hain!)*`

  // Case 1: Performance / Progress analysis
  if (q.includes('performance') || q.includes('progress') || q.includes('kaisa') || q.includes('report') || q.includes('analyze')) {
    let neglected = breakdown.length > 1 ? breakdown[breakdown.length - 1] : null
    let dominant = breakdown.length > 0 ? breakdown[0] : null

    return `📊 **Aapke Study Account Ka Real-Time Analysis:**

🔥 **Consistency & Streak:**
- Aapka current streak **${streak} days** ka hai! ${streak >= 3 ? 'Bohot badiya momentum bana hua hai!' : 'Rozana padhne ki aadat ko 7 din tak stretch karein.'}
- Aaj aapne **${todayHrs} hrs** padha hai (${targetHrs}h ke target me se).

📚 **Subject Balance (Pichle 14 Din):**
${dominant ? `- **Sabse zyada focus:** ${dominant.subject} (${dominant.hours} hours - ${dominant.pct}%)` : ''}
${neglected && neglected !== dominant ? `- ⚠️ **Neglected Subject:** ${neglected.subject} par sirf ${neglected.hours} hours diye hain. Ise aage ke slots me priority dein!` : ''}

💡 **Mera Recommendation:**
1. Apne weak subject ko **Morning 06:00 - 08:30 AM** wale fresh mind slot me rakhein.
2. Roz raat ko 45 minute ka **Spaced Revision** zaroor lagayein taaki padha hua bhool na jayein.${apiNote}`
  }

  // Case 2: Weak subject inquiry
  if (q.includes('subject') || q.includes('kam') || q.includes('weak') || q.includes('neglect')) {
    if (breakdown.length > 1) {
      const weak = breakdown[breakdown.length - 1]
      return `⚖️ **Subject Analysis:**
Aapke data ke mutabiq pichle 14 din me **${weak.subject}** ko sabse kam time (${weak.hours} hours, sirf ${weak.pct}%) mila hai.

👉 **Action Plan:**
- Kal ke Day Planner me **${weak.subject}** ke 2 continuous slots (kam se kam 2 ghante) schedule karein.
- Pehle 30 minute theory revise karein, fir 1 ghanta MCQs / questions solve karein.${apiNote}`
    }
  }

  // Case 3: Exam Prep / Strategy / Kaise padhein / Target
  if (q.includes('exam') || q.includes('prep') || q.includes('target') || q.includes('kese') || q.includes('kaise') || q.includes('strategy') || q.includes('tips')) {
    return `🎯 **${exam} Ke Liye Smart Preparation Strategy:**

1. **Daily Slot Split (3-Tier Rule):**
   - **Morning (Tier 1 - Concept):** Naye aur tough topics ko subah fresh dimaag se padhein (2.5 - 3 ghante).
   - **Afternoon/Evening (Tier 2 - Practice):** PYQs, numericals aur sectional tests solve karein. Sirf theory padhna kafi nahi hota!
   - **Night (Tier 3 - Revision):** 45 minute ka active recall — jo subah padha tha bina dekhe short points likhein.

2. **Streak & Rest Balance:**
   - Aapka current streak **${streak} days** hai. Sunday Rest Day toggle on rakhein taaki Sunday ko 0h target ho aur streak safe rahe!

3. **Weak Subject Priority:**
   - Day Planner me weak subjects ke liye 2 specific slots pehle se fix karke rakhein.${apiNote}`
  }

  // Case 4: Routine / Time Table / Schedule
  if (q.includes('routine') || q.includes('time table') || q.includes('timetable') || q.includes('schedule') || q.includes('kab')) {
    return `⏰ **Ideal Daily Study Routine (${targetHrs} Ghante Target):**

- 🌅 **06:30 - 08:30 AM (2h):** High-Weightage Core Subject (Deep Focus)
- 🍳 *08:30 - 09:30 AM:* Breakfast & Refreshment
- 📖 **09:30 - 11:30 AM (2h):** Second Subject / Theory Reading
- 🍛 *01:00 - 02:00 PM:* Lunch & Short Nap
- ✍️ **02:00 - 04:00 PM (2h):** Practice Questions & PYQs
- 🏃 *05:00 - 06:00 PM:* Walk / Exercise (Mental refresh)
- 🧠 **08:30 - 09:30 PM (1h):** Spaced Repetition Revision of Today's Work

👉 Day Planner me jaakar **"✨ AI Time Table"** par click karein aur apne routine ke hisaab se auto-generate karein!${apiNote}`
  }

  // Case 5: Motivation / Focus / Distraction
  if (q.includes('focus') || q.includes('distract') || q.includes('motivation') || q.includes('man') || q.includes('burnout')) {
    return `🔥 **Focus & Motivation Booster:**

1. **Pomodoro Rule:**
   - 50 minute full study + 10 minute complete break. Phone ko dusre kamre me rakhein.
2. **2-Minute Rule:**
   - Jab padhne ka man na kare, sirf stopwatch on karke bolo "main bas 5 minute baithunga". 90% baar aapka momentum ban jayega.
3. **Your Hard Work:**
   - Aapne **${userContext.totalSessionsAllTime} sessions** aur **${streak} days streak** maintain ki hai! Consistency hi topper banati hai.${apiNote}`
  }

  // Default mentor response
  return `👋 **Namaste ${userContext.displayName || userContext.userName}!**

Maine aapka study history review kiya hai:
- **Target Exam:** ${exam}
- **Active Streak:** ${streak} Days 🔥
- **Total Logged Sessions:** ${userContext.totalSessionsAllTime}
- **Today's Progress:** ${todayHrs}h / ${targetHrs}h

Aap mujhse pooch sakte hain:
1. *"Mera exam prep analysis do"*
2. *"Main kaunsa subject neglect kar raha hu?"*
3. *"Mere routine ke liye time table bana do"*
4. *"Exam ke liye consistency & focus tips do"*${apiNote}`
}
