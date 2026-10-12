/**
 * examAiSearch.js
 * AI-powered exam detail fetcher using Gemini.
 * When a user searches for any exam not in the local database,
 * this module calls Gemini to generate structured exam info
 * (syllabus, pattern, eligibility, PYQ links) on the fly.
 *
 * Results are cached in localStorage/sessionStorage to avoid repeat API calls.
 */

import { getGeminiApiKey } from './aiService.js'

const CACHE_PREFIX = 'stt_exam_ai_cache_'
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
]

/**
 * Calls Gemini API with a prompt, returns raw JSON string
 */
async function callGemini(prompt) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) throw new Error('No Gemini API key available.')

  let lastErr = null
  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            maxOutputTokens: 8192,
          },
        }),
      })
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        lastErr = new Error(errJson?.error?.message || `HTTP ${res.status}`)
        if (res.status === 503 || res.status === 404) continue
        throw lastErr
      }
      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts || []
      const textPart = parts.find((p) => p.text)
      if (textPart?.text) return textPart.text.trim()
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('Could not connect to Gemini AI.')
}

/**
 * Builds the Gemini prompt to get structured JSON about any exam
 */
function buildExamPrompt(examName) {
  return `You are an expert on Indian competitive, central, and state government exams (UPSC, SSC, Banking, Railways, State PSCs, Teaching TET/REET, Police, Engineering, Medical, Defence, Law, CUET, etc.).
A student is searching for details of: "${examName}"

Generate authentic, official, and comprehensive details for this exam.
Return a valid JSON object matching this exact structure:

{
  "id": "slug_id_lowercase_snake_case",
  "name": "Short recognized exam name (e.g. UP Police Constable, REET, BPSC CCE)",
  "fullName": "Full official title of the examination",
  "conductingBody": "Conducting commission or board name with short form (e.g. UPPRPB, BPSC, NTA)",
  "category": "Category like: State Govt / Police, Central Govt, Teaching / TET, Engineering, Medical, Defence, Banking",
  "aiGenerated": true,
  "overview": {
    "eligibility": "Clear educational qualification and age limit criteria with relevant relaxations",
    "mode": "Mode of exam (e.g. Computer Based Test CBT / Offline OMR / Pen & Paper)",
    "stages": "Comma-separated examination stages (e.g. Prelims, Mains, Interview or Written, Physical, Medical)",
    "negativeMarking": "Exact negative marking details (e.g. 0.25 marks / 1/3rd deduction / No negative marking)",
    "duration": "Total time allowed for the main test (e.g. 2 Hours (120 Minutes))"
  },
  "syllabus": [
    {
      "id": "sub_1",
      "name": "Subject Name (e.g. General Knowledge & Current Affairs, Quantitative Aptitude, etc.)",
      "topics": [
        { "id": "t_1_1", "name": "Topic 1", "status": "not_started" },
        { "id": "t_1_2", "name": "Topic 2", "status": "not_started" },
        { "id": "t_1_3", "name": "Topic 3", "status": "not_started" },
        { "id": "t_1_4", "name": "Topic 4", "status": "not_started" },
        { "id": "t_1_5", "name": "Topic 5", "status": "not_started" },
        { "id": "t_1_6", "name": "Topic 6", "status": "not_started" }
      ]
    }
  ],
  "pattern": [
    {
      "stage": "Stage Name (e.g. Tier 1 / Written Test / Preliminary Exam)",
      "subjects": [
        { "name": "Subject 1", "questions": 30, "marks": 60 },
        { "name": "Subject 2", "questions": 30, "marks": 60 }
      ],
      "totalQuestions": 100,
      "totalMarks": 200,
      "time": "2 Hours"
    }
  ],
  "pyqs": [
    {
      "year": "2024",
      "title": "Recent Official Question Paper & Answer Key",
      "shift": "Shift 1 / Official Paper",
      "hasAnswerKey": true,
      "link": "https://google.com/search?q=${encodeURIComponent(examName + ' previous year question paper pdf')}"
    },
    {
      "year": "2023",
      "title": "Previous Year Solved Question Paper",
      "shift": "Shift 2 / Official Paper",
      "hasAnswerKey": true,
      "link": "https://google.com/search?q=${encodeURIComponent(examName + ' question paper answer key pdf')}"
    }
  ]
}

Ensure:
- 3 to 5 subjects in syllabus, each with 5 to 8 concrete topics/chapters.
- Accurate marking scheme and pattern for "${examName}".
- All IDs are unique lowercase strings.
- Pure JSON output matching the format.`
}

/**
 * Parses the AI JSON response safely
 */
function parseExamJson(raw) {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/i, '').replace(/```$/i, '').trim()
  }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON found in AI response')
  return JSON.parse(cleaned.slice(start, end + 1))
}

/**
 * Main function: fetch exam details for any exam name using AI.
 * Returns a structured exam object (same shape as EXAM_DATABASE entries).
 */
export async function fetchExamByAI(examName) {
  if (!examName || !examName.trim()) throw new Error('Exam name is required.')

  const normalizedKey = examName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
  const cacheKey = CACHE_PREFIX + normalizedKey

  // 1. Check localStorage / sessionStorage
  try {
    const cached = localStorage.getItem(cacheKey) || sessionStorage.getItem(cacheKey)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < CACHE_DURATION_MS && data && data.syllabus) {
        return data
      }
    }
  } catch {
    // ignore cache read error
  }

  // 2. Fetch from Gemini
  const prompt = buildExamPrompt(examName.trim())
  const rawText = await callGemini(prompt)
  const parsed = parseExamJson(rawText)

  // 3. Normalize structure & ensure defaults
  if (!parsed.name) parsed.name = examName.trim()
  if (!parsed.id) parsed.id = 'ai_' + normalizedKey
  parsed.aiGenerated = true
  if (!parsed.syllabus || !Array.isArray(parsed.syllabus)) parsed.syllabus = []
  if (!parsed.pattern || !Array.isArray(parsed.pattern)) parsed.pattern = []
  if (!parsed.pyqs || !Array.isArray(parsed.pyqs)) parsed.pyqs = []
  if (!parsed.overview) {
    parsed.overview = {
      eligibility: 'Refer to official recruitment notification.',
      mode: 'Offline / Online Test',
      stages: 'Stage 1, Stage 2',
      negativeMarking: 'As per official notification',
      duration: '2 Hours',
    }
  }

  // Ensure topics have ids & status
  parsed.syllabus.forEach((sub, sIdx) => {
    if (!sub.id) sub.id = `sub_${sIdx + 1}`
    if (Array.isArray(sub.topics)) {
      sub.topics.forEach((top, tIdx) => {
        if (!top.id) top.id = `top_${sIdx + 1}_${tIdx + 1}`
        if (!top.status) top.status = 'not_started'
      })
    } else {
      sub.topics = []
    }
  })

  // 4. Save to cache
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ data: parsed, ts: Date.now() }))
  } catch {
    // ignore quota error
  }

  return parsed
}

/**
 * Returns all saved/cached AI exams
 */
export function getSavedAiExams() {
  const exams = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(CACHE_PREFIX)) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const { data } = JSON.parse(raw)
          if (data && data.id && data.name) {
            exams.push(data)
          }
        }
      }
    }
  } catch {}
  return exams
}
