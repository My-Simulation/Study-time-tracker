/**
 * blogData.js
 * High-value starter articles for JeetPrep blog.
 * Topics: Study strategies, exam preparation tips, memory techniques, and time management.
 */

export const BLOG_CATEGORIES = [
  'All',
  'Study Strategy',
  'Exam Tips',
  'Memory & Revision',
  'Time Management',
]

export const BLOG_POSTS = [
  {
    id: 'study-10-hours-without-burnout',
    title: 'How to Study 8–10 Hours Consistently Without Burning Out (The Active Block System)',
    slug: 'study-10-hours-without-burnout',
    excerpt: 'Studying long hours is not about willpower—it is about biological rhythm, strategic break blocks, and measuring deep focus instead of chair time.',
    category: 'Study Strategy',
    readTime: '5 min read',
    date: 'Oct 6, 2026',
    author: 'JeetPrep Strategy Team',
    authorRole: 'Competitive Exam Mentors',
    featured: true,
    coverEmoji: '⚡',
    gradient: 'from-purple-600/30 via-indigo-600/20 to-transparent',
    tags: ['Focus', 'Consistency', 'Pomodoro', 'Productivity'],
    content: `
### The Myth of "Sitting for 12 Hours"
Most aspirants believe that rankers sit at their desk for 14 hours straight without looking away. In reality, **passive sitting creates the illusion of hard work** while actual brain retention drops by 60% after 90 minutes.

If your mind is drifting, checking WhatsApp notifications, or staring blankly at the same page for 20 minutes, that is not a 10-hour study day—it is a 3-hour study day stretched over 10 exhausting hours.

---

### The Active Block Framework (3×3 System)
Instead of one never-ending marathon, divide your day into **3 Core Blocks**:

#### 1. Morning Deep Work (7:00 AM – 10:30 AM)
* **Goal:** High cognitive load subjects (Math problem sets, Economics, Tough Polity concepts).
* **Rule:** Zero phone, zero social media. 3 back-to-back 50-minute sessions with 10-minute breaks.
* **Why it works:** Your brain's prefrontal cortex has maximum willpower right after sleep.

#### 2. Afternoon Tactical Session (1:30 PM – 4:30 PM)
* **Goal:** Active learning (Previous Year Questions, Mock tests, Note-making).
* **Rule:** Don't watch passive 2-hour lecture videos here—solve questions with pencil and paper.
* **Why it works:** Post-lunch sluggishness disappears when your hands and pen are moving actively.

#### 3. Evening Consolidation (6:30 PM – 9:30 PM)
* **Goal:** Flashcard revision, doubt resolution, current affairs, and planning tomorrow's syllabus slots.
* **Rule:** Review whatever you learned in the morning. Retention spikes when reviewed within 12 hours.

---

### 3 Rules to Maintain Consistency for Months

1. **Track Pure Stopwatch Time, Not Wall Clock Time:**
   Pause your stopwatch whenever you drink water, talk to family, or open another browser tab. Seeing **6 pure hours** on your JeetPrep timer feels ten times more motivating than a false 10 hours.

2. **The 5-Minute Kickstart Rule:**
   On days when you feel zero motivation, tell yourself: *"I will just start the JeetPrep timer for 5 minutes."* Once the timer starts ticking, friction vanishes and 5 minutes turns into 50 minutes.

3. **1 Weekly Rest Half-Day:**
   Give your brain an evening off every Sunday to decompress. Brain consolidation occurs during rest!
    `,
  },
  {
    id: 'top-mistakes-ssc-upsc-aspirants',
    title: '5 Costly Mistakes Aspirants Make in Self-Study (And How to Fix Them)',
    slug: 'top-mistakes-ssc-upsc-aspirants',
    excerpt: 'Why do hardworking students who study 8 hours daily fail cut-offs? Here are the 5 critical strategy blindspots that cost aspirants years.',
    category: 'Exam Tips',
    readTime: '6 min read',
    date: 'Oct 5, 2026',
    author: 'JeetPrep Academic Mentors',
    authorRole: 'Ex-Aspirants & Educators',
    featured: false,
    coverEmoji: '🎯',
    gradient: 'from-amber-600/30 via-orange-600/20 to-transparent',
    tags: ['SSC CGL', 'UPSC', 'Exam Strategy', 'PYQ'],
    content: `
### Why Hard Work Alone Doesn't Guarantee Selection
Every year, over 25 lakh students appear for competitive exams like SSC CGL, UPSC CSE, Banking, and State PCS. Over 90% of students work hard, but only a tiny fraction clear the cutoff. The difference is rarely intelligence—it is almost always **error in methodology**.

Here are the 5 fatal traps and their exact fixes:

---

### Mistake 1: Hoarding PDF Material & Books
* **The Trap:** Downloading 50 Telegram channels, 20 coaching PDFs, and buying 4 different books for the same subject (e.g., 3 different books for Modern Indian History).
* **The Fix:** **One resource per subject, revised 5 times.** Selection comes from knowing one good book thoroughly, not glancing through 5 books once.

---

### Mistake 2: Delaying Previous Year Questions (PYQs)
* **The Trap:** *"I will complete the entire syllabus first, then I will look at PYQs."*
* **The Fix:** Start with PYQs on **Day 1**. Before reading a chapter on *Fundamental Rights* or *Percentage & Profit*, inspect the last 5 years' questions. You must know what examiners actually test before you start reading.
* *Tip: Use the JeetPrep Exam Hub to instantly access authentic PYQ trends.*

---

### Mistake 3: Passive Video Watching
* **The Trap:** Watching 4 hours of YouTube marathon videos while lying on bed and thinking you have studied.
* **The Fix:** Video lectures are only the first step. You must write summaries, solve unassisted questions, and verify your logic. If your pen isn't moving, you are consuming entertainment, not studying.

---

### Mistake 4: Sweeping Doubts Under the Rug
* **The Trap:** When stuck on a tricky reasoning or maths problem, looking at the answer key, thinking *"ah I get it"*, and skipping.
* **The Fix:** When stuck, test your concept thoroughly. If still stuck, write down your doubt or ask a mentor for step-by-step handwritten guidance. A single recurring doubt can cost you 2–4 marks in the actual exam!

---

### Mistake 5: No Daily Task Blueprint
* **The Trap:** Waking up in the morning and thinking: *"What should I study today?"*
* **The Fix:** Plan tomorrow's 4 core targets tonight before sleeping in your **Day Planner**. When morning comes, you sit and execute immediately without decision fatigue.
    `,
  },
  {
    id: '3-pass-revision-formula',
    title: 'The 3-Pass Revision Formula: How to Retain Facts for 6+ Months',
    slug: '3-pass-revision-formula',
    excerpt: 'The forgetting curve wipes out 70% of what you read within 48 hours unless you use systematic active recall passes.',
    category: 'Memory & Revision',
    readTime: '4 min read',
    date: 'Oct 4, 2026',
    author: 'JeetPrep Strategy Team',
    authorRole: 'Cognitive Science in Prep',
    featured: false,
    coverEmoji: '🧠',
    gradient: 'from-emerald-600/30 via-teal-600/20 to-transparent',
    tags: ['Active Recall', 'Spaced Repetition', 'Memory', 'Revision'],
    content: `
### Herman Ebbinghaus and The Forgetting Curve
Science proves that without revision, your brain deletes:
* **50%** of new material within 24 hours.
* **70%** within 48 hours.
* **90%** after 1 month.

Rereading notes with a yellow highlighter is passive and creates an illusion of competence. The only way to lock facts into long-term memory is **Active Retrieval**.

---

### The 3-Pass Formula Explained

#### Pass 1: The First 24-Hour Blurting Pass
Within 24 hours of studying a chapter:
1. Close the book completely.
2. Take a blank sheet of paper.
3. Write down every formula, date, case law, or concept you can remember from scratch.
4. Open the book and check what you missed in red ink. This triggers hyper-correction in your synapses!

#### Pass 2: The Day-7 Question Pass
After 7 days:
* Do **not** read your notes again.
* Directly solve 20 mixed practice questions or PYQs from that topic.
* If you score above 80%, your memory is solid. If below 80%, review only the specific weak sub-topics.

#### Pass 3: The Day-30 Concept Teaching Pass
After 30 days:
* Use the **Feynman Technique**. Explain the topic out loud to an imaginary 10-year-old in simple words.
* If you can explain *Inflation*, *Euler's Formula*, or *Constitutional Amendments* in plain language without jargon, you will never forget it in the exam hall.
    `,
  },
  {
    id: 'daily-timetable-blueprint-rankers',
    title: 'The Ideal Daily Routine for Competitive Exam Self-Study (Hour-by-Hour)',
    slug: 'daily-timetable-blueprint-rankers',
    excerpt: 'A realistic, sustainable, and high-yield daily routine designed for full-time aspirants to hit 8+ quality study hours without mental fatigue.',
    category: 'Time Management',
    readTime: '5 min read',
    date: 'Oct 3, 2026',
    author: 'JeetPrep Editorial',
    authorRole: 'Daily Productivity Blueprint',
    featured: false,
    coverEmoji: '🗓️',
    gradient: 'from-blue-600/30 via-cyan-600/20 to-transparent',
    tags: ['Timetable', 'Routine', 'Discipline', 'Daily Habits'],
    content: `
### Why Most Timetables Fail Within 3 Days
Most aspirants make unrealistic timetables: *"Wake up at 4:00 AM, study 16 hours, sleep 4 hours"*. By Day 3, sleep deprivation causes a crash, followed by guilt and abandoned goals.

A successful routine has **buffer space**, **adequate 7-hour sleep**, and **clear cognitive slots**.

---

### The Sustainable 8.5-Hour Daily Master Blueprint

* **6:30 AM – 7:00 AM:** Wake up, glass of water, light stretching, zero phone screen time.
* **7:00 AM – 9:30 AM (Slot 1 — 2.5 hrs):** **Toughest Subject Slot**. When brain energy is at 100%. (Maths formulas / Economy / Complex theory).
* **9:30 AM – 10:30 AM:** Healthy breakfast, shower, fresh air.
* **10:30 AM – 1:00 PM (Slot 2 — 2.5 hrs):** **Problem Solving & Practice**. PYQ papers, sectional timed quizzes.
* **1:00 PM – 2:30 PM:** Lunch + power nap (20-30 mins max).
* **2:30 PM – 4:30 PM (Slot 3 — 2 hrs):** **General Studies / Static GK / Vocabulary**.
* **4:30 PM – 5:30 PM:** Walk, tea break, talk to friends, physical movement.
* **5:30 PM – 7:00 PM (Slot 4 — 1.5 hrs):** **Current Affairs & Daily Editorials**.
* **7:00 PM – 8:30 PM:** Free time, dinner, light workout.
* **8:30 PM – 9:30 PM (Consolidation):** Review the day's mistakes, check off completed tasks in JeetPrep Day Planner, set tomorrow's 4 targets.
* **10:30 PM:** Sleep. (Non-negotiable 7–8 hours of recovery).

---

### Final Thought
Consistency is an algorithm. Stick to this schedule for just **21 days**, and watch your confidence and mock scores surge!
    `,
  },
]
