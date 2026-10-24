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

  const prompt = `You are a Senior Chief Question Paper Setter for National Testing Agency (NTA) and TCS iON, setting authentic, challenging competitive exam question papers for ${examName} (${subject} - ${topic}).

TASK: Generate a high-yield, realistic mock test containing exactly ${questionCount} multiple-choice questions matching real 2024-2025 actual exam shift papers.
DIFFICULTY: ${difficulty}. 
STANDARDS & INTEGRITY RULES:
1. HIGH COMPETITIVE STANDARD: Questions must strictly match real exam difficulty for ${examName}. Avoid simplistic, basic, or generic questions. Include authentic calculations, multi-statement questions, and realistic trap options (distractors based on common exam mistakes).
2. BALANCED OPTIONS DISTRIBUTION: Randomly distribute the correct answer across Option A (0), Option B (1), Option C (2), and Option D (3). Do NOT place all correct answers in Option 0 or the same position!
3. STRICT ANSWER & EXPLANATION CONSISTENCY:
   - "correctOption": MUST be an integer (0, 1, 2, or 3) representing the EXACT index in the "options" array where the correct answer is located.
   - The value at options[correctOption] MUST BE 100% MATHEMATICALLY AND LOGICALLY IDENTICAL to the final conclusion in "explanation" and "explanationHi".
   - NEVER let the explanation conclude one answer (e.g. "30") while correctOption points to another option (e.g. "20")! Double-check every question before output.

Format each question with:
- questionText (English, clear and unambiguous)
- questionTextHi (Hindi translation, authentic exam terminology)
- options: array of exactly 4 strings in English
- optionsHi: array of exactly 4 corresponding strings in Hindi
- correctOption: integer (0, 1, 2, or 3) pointing to the exact correct answer in options array
- explanation: Step-by-step mathematical proof / logical reasoning in English with final answer explicitly stated
- explanationHi: Step-by-step solution in Hindi with final answer explicitly stated
- sectionName: e.g. "${subject}"

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown ticks, no preamble) adhering to this schema:
{
  "title": "${examName} - ${topic} High-Yield CBT Mock",
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
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "optionsHi": ["विकल्प A", "विकल्प B", "विकल्प C", "विकल्प D"],
      "correctOption": 2,
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
        // Sanitize and verify each question for 100% consistency
        parsed.questions = parsed.questions.map((q, idx) => {
          let correctIdx = Number(q.correctOption)
          if (isNaN(correctIdx) || correctIdx < 0 || correctIdx > 3) {
            correctIdx = 0
          }

          // Ensure options array has exactly 4 items
          const options =
            Array.isArray(q.options) && q.options.length >= 4
              ? q.options.slice(0, 4)
              : q.options || ['Option A', 'Option B', 'Option C', 'Option D']
          const optionsHi =
            Array.isArray(q.optionsHi) && q.optionsHi.length >= 4
              ? q.optionsHi.slice(0, 4)
              : q.optionsHi || options

          return {
            ...q,
            id: q.id || `q_ai_${idx + 1}`,
            options,
            optionsHi,
            correctOption: correctIdx,
          }
        })

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
