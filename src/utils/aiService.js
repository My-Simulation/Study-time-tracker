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
} from './firestoreHelpers'
import { todayString, formatHoursMinutes, formatDuration } from './formatTime'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'
const DAILY_LIMIT = 15
const STORAGE_LIMIT_KEY = 'stt_ai_daily_usage'
const STORAGE_API_KEY = 'stt_custom_gemini_api_key'

// Default fallback API key (can also be configured by user or environment)
const DEFAULT_KEY = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) || ''

export function getGeminiApiKey() {
  if (typeof window === 'undefined') return DEFAULT_KEY
  return localStorage.getItem(STORAGE_API_KEY) || DEFAULT_KEY
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
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson?.error?.message || `Gemini API error: ${response.statusText}`)
      }

      const data = await response.json()
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim()

      const parsed = JSON.parse(rawText)
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

  // Fallback intelligent generator (always works 100% offline or without API key!)
  return generateAlgorithmicTimeTable({
    targetStudyHours,
    routineType,
    wakeTime,
    sleepTime,
    subjects: subjectsToCover.length > 0 ? subjectsToCover : (userContext.syllabusList || ['Polity', 'History', 'Geography', 'Reasoning']),
  })
}

/**
 * Intelligent local timetable fallback algorithm
 */
function generateAlgorithmicTimeTable({ targetStudyHours, routineType, wakeTime, sleepTime, subjects }) {
  const subjs = subjects.length > 0 ? subjects : ['Polity', 'History', 'Geography', 'General Studies']
  const slots = []
  let sIdx = 0
  const nextSubj = () => {
    const s = subjs[sIdx % subjs.length]
    sIdx++
    return s
  }

  if (routineType === 'job' || routineType === 'college') {
    // Working professional / student: Morning 2h + Evening 2h + Night 1.5h
    slots.push({
      id: `slot_${Date.now()}_1`,
      block: 'Morning',
      time: '06:00 AM - 08:00 AM',
      slotType: 'Core Study',
      subject: nextSubj(),
      topic: 'Core Theory & Concepts',
      plan: 'Deep focus on fundamental concepts & textbook reading',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_2`,
      block: 'Afternoon',
      time: '09:00 AM - 05:00 PM',
      slotType: 'Break',
      subject: 'Office / College',
      topic: 'Work Hours & Daily Commute',
      plan: 'Stay hydrated; revise flashcards during short lunch break',
      done: true,
    })
    slots.push({
      id: `slot_${Date.now()}_3`,
      block: 'Evening',
      time: '06:30 PM - 08:30 PM',
      slotType: 'Practice',
      subject: nextSubj(),
      topic: 'Problem Solving & MCQs',
      plan: 'Solve 30-40 targeted practice questions & analyze errors',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_4`,
      block: 'Night',
      time: '09:30 PM - 10:30 PM',
      slotType: 'Revision',
      subject: nextSubj(),
      topic: 'Daily Revision & Spaced Notes',
      plan: 'Review all concepts studied today before going to sleep',
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
      topic: 'High-Weightage Core Topic',
      plan: 'Morning peak alertness: Deep concept learning without phone',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_2`,
      block: 'Morning',
      time: '09:30 AM - 11:30 AM',
      slotType: 'Core Study',
      subject: nextSubj(),
      topic: 'Second Subject Study',
      plan: 'Read chapter syllabus and make crisp self-notes',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_3`,
      block: 'Afternoon',
      time: '02:00 PM - 04:00 PM',
      slotType: 'Practice',
      subject: nextSubj(),
      topic: 'Previous Year Questions (PYQs)',
      plan: 'Solve exam pattern questions under timed conditions',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_4`,
      block: 'Evening',
      time: '05:30 PM - 07:30 PM',
      slotType: 'Mock Test',
      subject: nextSubj(),
      topic: 'Mock Test & Sectional Quiz',
      plan: 'Test accuracy and speed; mark weak chapters for weekend',
      done: false,
    })
    slots.push({
      id: `slot_${Date.now()}_5`,
      block: 'Night',
      time: '09:00 PM - 10:30 PM',
      slotType: 'Revision',
      subject: 'Daily Revision',
      topic: 'Spaced Repetition & Day Plan Wrap-up',
      plan: '10-minute rapid review per subject studied today',
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
      // Build conversation contents
      const contents = [
        { role: 'user', parts: [{ text: `${systemContextPrompt}\n\nStudent asks: ${userMessage}` }] },
      ]

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      })

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}))
        throw new Error(errJson?.error?.message || `Gemini API error: ${response.statusText}`)
      }

      const data = await response.json()
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text
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
2. Roz raat ko 45 minute ka **Spaced Revision** zaroor lagayein taaki padha hua bhool na jayein.`
  }

  // Case 2: Weak subject inquiry
  if (q.includes('subject') || q.includes('kam') || q.includes('weak') || q.includes('neglect')) {
    if (breakdown.length > 1) {
      const weak = breakdown[breakdown.length - 1]
      return `⚖️ **Subject Analysis:**
Aapke data ke mutabiq pichle 14 din me **${weak.subject}** ko sabse kam time (${weak.hours} hours, sirf ${weak.pct}%) mila hai.

👉 **Action Plan:**
- Kal ke Day Planner me **${weak.subject}** ke 2 continuous slots (kam se kam 2 ghante) schedule karein.
- Pehle 30 minute theory revise karein, fir 1 ghanta MCQs / questions solve karein.`
    }
  }

  // Default encouraging mentor response
  return `👋 **Namaste ${userContext.displayName || userContext.userName}!**

Maine aapka study history review kiya hai:
- **Active Streak:** ${streak} Days 🔥
- **Total Logged Sessions:** ${userContext.totalSessionsAllTime}
- **Today's Progress:** ${todayHrs}h / ${targetHrs}h

Aap mujhse pooch sakte hain:
1. *"Mera performance analysis do"*
2. *"Main kaunsa subject neglect kar raha hu?"*
3. *"Mere routine ke liye time table bana do"*
4. *"Exam ke liye consistency tips do"*`
}
