/**
 * mockAiGenerator.js
 * Generates authentic, exam-standard CBT mock tests using Google Gemini API.
 * Produces structured bilingual questions (Hindi + English) with explanations, sections, and marking criteria.
 */

import { getGeminiApiKey } from './aiService.js'

const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
]

export function getExamMarkingScheme(examName = '') {
  const norm = examName.toLowerCase()
  if (norm.includes('jee') || norm.includes('neet')) {
    return { marksPerCorrect: 4, negativeMarks: 1 }
  }
  if (norm.includes('ctet') || norm.includes('tet') || norm.includes('prt') || norm.includes('teaching')) {
    return { marksPerCorrect: 1, negativeMarks: 0 }
  }
  if (norm.includes('clerk') || norm.includes('po') || norm.includes('banking') || norm.includes('rrb clerk') || norm.includes('rrb po') || norm.includes('sbi')) {
    return { marksPerCorrect: 1, negativeMarks: 0.25 }
  }
  if (norm.includes('nda')) {
    return { marksPerCorrect: 3, negativeMarks: 1 }
  }
  // Default: SSC, State Police, Railway, State Exams
  return { marksPerCorrect: 2, negativeMarks: 0.5 }
}

/**
 * Generate a complete custom mock test via Gemini AI
 */
export async function generateAiMockTest({
  examName = 'SSC CGL',
  subject = 'Quantitative Aptitude',
  topic = 'Arithmetic & Speed Maths',
  questionCount = 15,
  durationMinutes = 20,
  difficulty = 'Exam Standard (Moderate to Calculative)',
}) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('Gemini API key is required to generate AI Mock Tests.')
  }

  const { marksPerCorrect, negativeMarks } = getExamMarkingScheme(examName)
  const totalMarks = questionCount * marksPerCorrect

  const prompt = `You are a Senior Question Paper Setter for TCS iON and National Testing Agency (NTA), preparing real competitive exam mock tests for ${examName} (${subject} - ${topic}).

TASK: Generate a high-yield, realistic mock test containing exactly ${questionCount} multiple-choice questions matching real 2024-2025 exam patterns.
DIFFICULTY: ${difficulty}. Include realistic calculations, exam-level trap options, and authentic syllabus topics.

Format each question with:
- questionText (English)
- questionTextHi (Hindi translation, authentic Hindi terminology)
- options: array of exactly 4 strings in English (Option 0 MUST be the correct option, frontend will shuffle them)
- optionsHi: array of exactly 4 corresponding strings in Hindi
- explanation (Step-by-step solution with short-tricks in English)
- explanationHi (Step-by-step solution in Hindi)
- sectionName: e.g. "${subject}"

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown ticks, no preamble) adhering to this schema:
{
  "title": "${examName} - ${topic} AI Special Mock",
  "examName": "${examName}",
  "category": "${subject}",
  "durationMinutes": ${durationMinutes},
  "totalMarks": ${totalMarks},
  "marksPerCorrect": ${marksPerCorrect},
  "negativeMarks": ${negativeMarks},
  "sections": [
    { "id": "sec_ai_1", "name": "${subject}", "questionCount": ${questionCount}, "timeLimitMinutes": ${durationMinutes} }
  ],
  "questions": [
    {
      "id": "q_ai_1",
      "sectionId": "sec_ai_1",
      "questionText": "...",
      "questionTextHi": "...",
      "options": ["Correct Option", "Wrong 1", "Wrong 2", "Wrong 3"],
      "optionsHi": ["सही विकल्प", "गलत 1", "गलत 2", "गलत 3"],
      "correctOption": 0,
      "explanation": "...",
      "explanationHi": "..."
    }
  ]
}`

  let lastError = null

  for (const model of GEMINI_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 6000,
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
      }

      const json = await response.json()
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''

      // Clean markdown code blocks if any
      const cleaned = rawText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)

      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        // Assign unique id
        parsed.id = `ai_mock_${Date.now()}`
        parsed.isAiGenerated = true
        parsed.bannerColor = 'from-purple-600 to-pink-600'
        return parsed
      }
    } catch (err) {
      console.warn(`Model ${model} failed in generateAiMockTest:`, err)
      lastError = err
    }
  }

  throw lastError || new Error('Failed to generate AI Mock Test. Please check your internet or try again.')
}
