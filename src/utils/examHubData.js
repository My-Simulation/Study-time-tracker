/**
 * examHubData.js
 * Verified, comprehensive database of major Government and Competitive Entrance Exams.
 * Clean, structured data with authentic syllabus chapters, PYQ links, and exam patterns.
 */

export const EXAM_DATABASE = [
  // ── SSC CGL ─────────────────────────────────────────────────────────────
  {
    id: 'ssc_cgl',
    name: 'SSC CGL',
    fullName: 'Staff Selection Commission - Combined Graduate Level',
    conductingBody: 'SSC (Staff Selection Commission)',
    category: 'Govt Job / Central Govt',
    keywords: ['ssc', 'cgl', 'staff selection', 'inspector', 'aso', 'income tax', 'cgl 2025', 'cgl 2026', 'tier 1', 'tier 2'],
    overview: {
      eligibility: 'Bachelor Degree (Graduation) in any stream from a recognized university. Age 18-32 years.',
      mode: 'Computer Based Test (CBT Online)',
      stages: 'Tier 1 (Qualifying) & Tier 2 (Merit Ranking)',
      negativeMarking: 'Tier 1: 0.50 marks per wrong answer | Tier 2: 1 mark per wrong answer',
      duration: 'Tier 1: 60 Minutes (100 Questions, 200 Marks)',
    },
    pattern: [
      {
        stage: 'Tier 1 (Screening)',
        subjects: [
          { name: 'General Intelligence & Reasoning', questions: 25, marks: 50 },
          { name: 'General Awareness (GS / GK)', questions: 25, marks: 50 },
          { name: 'Quantitative Aptitude (Maths)', questions: 25, marks: 50 },
          { name: 'English Comprehension', questions: 25, marks: 50 },
        ],
        totalQuestions: 100,
        totalMarks: 200,
        time: '60 Minutes',
      },
      {
        stage: 'Tier 2 (Selection Merit)',
        subjects: [
          { name: 'Section 1: Math (30 Qs) + Reasoning (30 Qs)', questions: 60, marks: 180 },
          { name: 'Section 2: English (45 Qs) + General Awareness (25 Qs)', questions: 70, marks: 210 },
          { name: 'Section 3: Computer Knowledge (Qualifying)', questions: 20, marks: 60 },
          { name: 'Data Entry Speed Test (DEST typing qualifying)', questions: 1, marks: 'Qualifying' },
        ],
        totalQuestions: 150,
        totalMarks: 390,
        time: '2 Hours 15 Minutes',
      },
    ],
    syllabus: [
      {
        id: 'cgl_maths',
        name: 'Quantitative Aptitude (Maths)',
        topics: [
          { id: 'cm_1', name: 'Number System, HCF & LCM', status: 'not_started' },
          { id: 'cm_2', name: 'Percentages & Profit/Loss', status: 'not_started' },
          { id: 'cm_3', name: 'Ratio, Proportion & Mixture', status: 'not_started' },
          { id: 'cm_4', name: 'Time, Work & Pipes/Cisterns', status: 'not_started' },
          { id: 'cm_5', name: 'Time, Speed, Distance & Trains', status: 'not_started' },
          { id: 'cm_6', name: 'Simple & Compound Interest', status: 'not_started' },
          { id: 'cm_7', name: 'Algebra & Linear Equations', status: 'not_started' },
          { id: 'cm_8', name: 'Geometry & Coordinate Geometry', status: 'not_started' },
          { id: 'cm_9', name: 'Mensuration (2D & 3D)', status: 'not_started' },
          { id: 'cm_10', name: 'Trigonometry & Heights/Distances', status: 'not_started' },
          { id: 'cm_11', name: 'Data Interpretation (DI)', status: 'not_started' },
        ],
      },
      {
        id: 'cgl_reasoning',
        name: 'General Intelligence & Reasoning',
        topics: [
          { id: 'cr_1', name: 'Analogies & Semantic Classification', status: 'not_started' },
          { id: 'cr_2', name: 'Coding-Decoding & Letter Series', status: 'not_started' },
          { id: 'cr_3', name: 'Number Series & Missing Figures', status: 'not_started' },
          { id: 'cr_4', name: 'Syllogism & Logical Venn Diagrams', status: 'not_started' },
          { id: 'cr_5', name: 'Blood Relations & Direction Sense', status: 'not_started' },
          { id: 'cr_6', name: 'Non-Verbal Reasoning (Paper folding, Mirror images)', status: 'not_started' },
          { id: 'cr_7', name: 'Seating Arrangement & Puzzles', status: 'not_started' },
        ],
      },
      {
        id: 'cgl_english',
        name: 'English Language & Comprehension',
        topics: [
          { id: 'ce_1', name: 'Grammar Rules (Tenses, Articles, Subject-Verb)', status: 'not_started' },
          { id: 'ce_2', name: 'Error Spotting & Sentence Improvement', status: 'not_started' },
          { id: 'ce_3', name: 'Vocabulary (Synonyms, Antonyms, One-word Substitution)', status: 'not_started' },
          { id: 'ce_4', name: 'Idioms & Phrases', status: 'not_started' },
          { id: 'ce_5', name: 'Active & Passive Voice', status: 'not_started' },
          { id: 'ce_6', name: 'Direct & Indirect Speech', status: 'not_started' },
          { id: 'ce_7', name: 'Cloze Test & Reading Comprehension', status: 'not_started' },
        ],
      },
      {
        id: 'cgl_gs',
        name: 'General Awareness & Current Affairs',
        topics: [
          { id: 'cg_1', name: 'Indian Polity & Constitution', status: 'not_started' },
          { id: 'cg_2', name: 'Modern & Ancient Indian History', status: 'not_started' },
          { id: 'cg_3', name: 'Geography (Indian & World)', status: 'not_started' },
          { id: 'cg_4', name: 'General Science (Physics, Chem, Biology)', status: 'not_started' },
          { id: 'cg_5', name: 'Indian Economy & Budget Concepts', status: 'not_started' },
          { id: 'cg_6', name: 'Static GK (Dance, Festivals, National Parks)', status: 'not_started' },
          { id: 'cg_7', name: 'Last 12 Months Current Affairs', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'All Shifts Compilation', title: 'SSC CGL 2024 Tier 1 Official Questions', link: 'https://ssc.gov.in', hasAnswerKey: true },
      { year: '2023', shift: 'Tier 1 Official Paper', title: 'SSC CGL 2023 Tier 1 Solved Question Paper', link: 'https://ssc.gov.in', hasAnswerKey: true },
      { year: '2023', shift: 'Tier 2 Mains', title: 'SSC CGL 2023 Tier 2 Official Question Paper with Solution Key', link: 'https://ssc.gov.in', hasAnswerKey: true },
      { year: '2022', shift: 'Tier 1 & Tier 2', title: 'SSC CGL 2022 Official Papers with Answer Keys', link: 'https://ssc.gov.in', hasAnswerKey: true },
      { year: '2021', shift: 'Tier 1', title: 'SSC CGL 2021 Complete Question Bank', link: 'https://ssc.gov.in', hasAnswerKey: true },
    ],
  },

  // ── UPSC CIVIL SERVICES (IAS / IPS) ──────────────────────────────────────
  {
    id: 'upsc_cse',
    name: 'UPSC CSE',
    fullName: 'Union Public Service Commission - Civil Services Examination',
    conductingBody: 'UPSC (Union Public Service Commission)',
    category: 'Govt Job / All India Services (IAS/IPS/IFS)',
    keywords: ['upsc', 'cse', 'ias', 'ips', 'civil services', 'prelims', 'mains', 'csat', 'upsc 2025', 'upsc 2026'],
    overview: {
      eligibility: 'Graduate in any discipline. Age 21-32 years (General). Attempts: 6 for General, 9 for OBC, Unlimited for SC/ST.',
      mode: 'Offline Pen & Paper (OMR for Prelims, Descriptive for Mains)',
      stages: 'Prelims (GS + CSAT) ➔ Mains (9 Written Papers) ➔ Personality Test (Interview)',
      negativeMarking: 'Prelims: 1/3rd (0.66 marks for Paper 1, 0.83 marks for CSAT)',
      duration: 'Prelims: 2 hours each paper | Mains: 3 hours per paper',
    },
    pattern: [
      {
        stage: 'Stage 1: Preliminary Exam (Objective Qualifying)',
        subjects: [
          { name: 'General Studies Paper 1 (Cutoff decides Mains entry)', questions: 100, marks: 200 },
          { name: 'CSAT Paper 2 (Qualifying: Minimum 33% required)', questions: 80, marks: 200 },
        ],
        totalQuestions: 180,
        totalMarks: 400,
        time: '4 Hours (2 Hours each)',
      },
      {
        stage: 'Stage 2: Mains Written Examination (Descriptive)',
        subjects: [
          { name: 'Essay Paper', questions: 2, marks: 250 },
          { name: 'GS 1: History, Heritage, Geography & Society', questions: 20, marks: 250 },
          { name: 'GS 2: Governance, Constitution, Polity & IR', questions: 20, marks: 250 },
          { name: 'GS 3: Technology, Economy, Biodiversity & Security', questions: 20, marks: 250 },
          { name: 'GS 4: Ethics, Integrity & Aptitude', questions: 12, marks: 250 },
          { name: 'Optional Paper 1 & 2 (250 Marks each)', questions: 'Subject specific', marks: 500 },
        ],
        totalQuestions: '9 Papers',
        totalMarks: 1750,
        time: '3 Hours per paper',
      },
      {
        stage: 'Stage 3: Personality Test (Interview)',
        subjects: [{ name: 'Interview / Personality Board', questions: 'Viva', marks: 275 }],
        totalQuestions: '-',
        totalMarks: 275,
        time: '30-45 Minutes',
      },
    ],
    syllabus: [
      {
        id: 'upsc_polity',
        name: 'Indian Polity, Governance & Constitution',
        topics: [
          { id: 'up_1', name: 'Historical Underpinnings & Preamble', status: 'not_started' },
          { id: 'up_2', name: 'Fundamental Rights & Directive Principles (DPSP)', status: 'not_started' },
          { id: 'up_3', name: 'Union Executive, President & Prime Minister', status: 'not_started' },
          { id: 'up_4', name: 'Parliament & State Legislatures', status: 'not_started' },
          { id: 'up_5', name: 'Judiciary (Supreme Court, High Courts & Judicial Review)', status: 'not_started' },
          { id: 'up_6', name: 'Constitutional & Non-Constitutional Bodies (Election Comm, UPSC, CAG)', status: 'not_started' },
          { id: 'up_7', name: 'Panchayati Raj & Local Governance', status: 'not_started' },
        ],
      },
      {
        id: 'upsc_history',
        name: 'History of India & National Movement',
        topics: [
          { id: 'uh_1', name: 'Ancient India (Indus Valley, Vedic, Mauryas, Guptas)', status: 'not_started' },
          { id: 'uh_2', name: 'Medieval India (Delhi Sultanate, Mughals, Bhakti Movement)', status: 'not_started' },
          { id: 'uh_3', name: 'Indian Art, Culture, Architecture & Classical Dances', status: 'not_started' },
          { id: 'uh_4', name: 'British Expansion & Socio-Religious Reform Movements', status: 'not_started' },
          { id: 'uh_5', name: 'Freedom Struggle (1857 to 1947) & Gandhian Era', status: 'not_started' },
          { id: 'uh_6', name: 'Post-Independence Consolidation', status: 'not_started' },
        ],
      },
      {
        id: 'upsc_geo_env',
        name: 'Geography, Environment & Ecology',
        topics: [
          { id: 'ug_1', name: 'Physical Geography (Geomorphology, Climatology, Oceanography)', status: 'not_started' },
          { id: 'ug_2', name: 'Indian Physical, River Systems & Climate Geography', status: 'not_started' },
          { id: 'ug_3', name: 'Biodiversity, Ecosystems & Wildlife Sanctuaries in India', status: 'not_started' },
          { id: 'ug_4', name: 'Climate Change, Pollution & Environmental Conventions (COP)', status: 'not_started' },
        ],
      },
      {
        id: 'upsc_economy',
        name: 'Indian Economy & Development',
        topics: [
          { id: 'ue_1', name: 'National Income, GDP & Inflation Metrics', status: 'not_started' },
          { id: 'ue_2', name: 'Monetary Policy (RBI) & Banking Sector Reforms', status: 'not_started' },
          { id: 'ue_3', name: 'Fiscal Policy, Taxation & Union Budget', status: 'not_started' },
          { id: 'ue_4', name: 'Agriculture, Subsidies & Food Security (PDS)', status: 'not_started' },
          { id: 'ue_5', name: 'External Sector (BOP, Forex, Trade Agreements)', status: 'not_started' },
        ],
      },
      {
        id: 'upsc_csat',
        name: 'CSAT (Paper 2 Qualifying)',
        topics: [
          { id: 'uc_1', name: 'Reading Comprehension Passages', status: 'not_started' },
          { id: 'uc_2', name: 'Basic Numeracy, Percentages & Ratios', status: 'not_started' },
          { id: 'uc_3', name: 'Permutations, Combinations & Probability', status: 'not_started' },
          { id: 'uc_4', name: 'Logical Reasoning & Analytical Ability', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'Prelims GS 1 & CSAT', title: 'UPSC Prelims 2024 Official Question Paper & Answer Key', link: 'https://upsc.gov.in', hasAnswerKey: true },
      { year: '2024', shift: 'Mains GS 1 to 4', title: 'UPSC Mains 2024 Question Papers All Papers', link: 'https://upsc.gov.in', hasAnswerKey: false },
      { year: '2023', shift: 'Prelims GS 1 & CSAT', title: 'UPSC Prelims 2023 Official Paper with Keys', link: 'https://upsc.gov.in', hasAnswerKey: true },
      { year: '2022', shift: 'Prelims & Mains', title: 'UPSC CSE 2022 Solved Question Papers', link: 'https://upsc.gov.in', hasAnswerKey: true },
      { year: '2021', shift: 'Prelims', title: 'UPSC CSE 2021 Question Paper', link: 'https://upsc.gov.in', hasAnswerKey: true },
    ],
  },

  // ── JEE MAIN (IIT / NIT) ────────────────────────────────────────────────
  {
    id: 'jee_main',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination (Main)',
    conductingBody: 'NTA (National Testing Agency)',
    category: 'Engineering Entrance / B.Tech (NIT, IIIT, CFTI)',
    keywords: ['jee', 'jee main', 'iit', 'nit', 'engineering', 'pcm', 'nta', 'jee 2025', 'jee 2026'],
    overview: {
      eligibility: '10+2 (Class 12) with Physics, Chemistry & Mathematics. Minimum 75% aggregate (or top 20 percentile) for NIT/IIT admission.',
      mode: 'Computer Based Test (CBT Online)',
      stages: 'Session 1 (January) & Session 2 (April) - Best score considered',
      negativeMarking: '+4 for correct, -1 for incorrect (both MCQs and numerical questions)',
      duration: '3 Hours (180 Minutes)',
    },
    pattern: [
      {
        stage: 'Paper 1 (B.E. / B.Tech)',
        subjects: [
          { name: 'Physics: 20 MCQs + 5 Numerical', questions: 25, marks: 100 },
          { name: 'Chemistry: 20 MCQs + 5 Numerical', questions: 25, marks: 100 },
          { name: 'Mathematics: 20 MCQs + 5 Numerical', questions: 25, marks: 100 },
        ],
        totalQuestions: 75,
        totalMarks: 300,
        time: '3 Hours',
      },
    ],
    syllabus: [
      {
        id: 'jee_physics',
        name: 'Physics (JEE Main)',
        topics: [
          { id: 'jp_1', name: 'Units, Dimensions & Errors', status: 'not_started' },
          { id: 'jp_2', name: 'Kinematics (1D & 2D Motion)', status: 'not_started' },
          { id: 'jp_3', name: 'Laws of Motion & Friction', status: 'not_started' },
          { id: 'jp_4', name: 'Work, Power & Energy', status: 'not_started' },
          { id: 'jp_5', name: 'Rotational Motion & Centre of Mass', status: 'not_started' },
          { id: 'jp_6', name: 'Gravitation & Planetary Motion', status: 'not_started' },
          { id: 'jp_7', name: 'Thermodynamics & Kinetic Theory of Gases', status: 'not_started' },
          { id: 'jp_8', name: 'Oscillations (SHM) & Waves', status: 'not_started' },
          { id: 'jp_9', name: 'Electrostatics & Electric Potential', status: 'not_started' },
          { id: 'jp_10', name: 'Current Electricity & Circuits', status: 'not_started' },
          { id: 'jp_11', name: 'Magnetic Effects of Current & Magnetism', status: 'not_started' },
          { id: 'jp_12', name: 'Electromagnetic Induction & Alternating Current', status: 'not_started' },
          { id: 'jp_13', name: 'Ray Optics & Wave Optics', status: 'not_started' },
          { id: 'jp_14', name: 'Modern Physics (Dual Nature, Atoms, Nuclei)', status: 'not_started' },
          { id: 'jp_15', name: 'Semiconductors & Electronic Devices', status: 'not_started' },
        ],
      },
      {
        id: 'jee_chem',
        name: 'Chemistry (JEE Main)',
        topics: [
          { id: 'jc_1', name: 'Some Basic Concepts of Chemistry (Mole Concept)', status: 'not_started' },
          { id: 'jc_2', name: 'Atomic Structure & Quantum Numbers', status: 'not_started' },
          { id: 'jc_3', name: 'Chemical Bonding & Molecular Structure', status: 'not_started' },
          { id: 'jc_4', name: 'Chemical Thermodynamics & Enthalpy', status: 'not_started' },
          { id: 'jc_5', name: 'Chemical & Ionic Equilibrium', status: 'not_started' },
          { id: 'jc_6', name: 'Redox Reactions & Electrochemistry', status: 'not_started' },
          { id: 'jc_7', name: 'Chemical Kinetics', status: 'not_started' },
          { id: 'jc_8', name: 'Solutions & Colligative Properties', status: 'not_started' },
          { id: 'jc_9', name: 'Periodic Table & Periodicity in Properties', status: 'not_started' },
          { id: 'jc_10', name: 'p-Block, d & f-Block Elements', status: 'not_started' },
          { id: 'jc_11', name: 'Coordination Compounds', status: 'not_started' },
          { id: 'jc_12', name: 'General Organic Chemistry (GOC) & Isomerism', status: 'not_started' },
          { id: 'jc_13', name: 'Hydrocarbons (Alkanes, Alkenes, Alkynes, Aromatic)', status: 'not_started' },
          { id: 'jc_14', name: 'Haloalkanes, Alcohols, Phenols & Ethers', status: 'not_started' },
          { id: 'jc_15', name: 'Aldehydes, Ketones & Carboxylic Acids', status: 'not_started' },
          { id: 'jc_16', name: 'Amines & Biomolecules', status: 'not_started' },
        ],
      },
      {
        id: 'jee_maths',
        name: 'Mathematics (JEE Main)',
        topics: [
          { id: 'jm_1', name: 'Sets, Relations & Functions', status: 'not_started' },
          { id: 'jm_2', name: 'Complex Numbers & Quadratic Equations', status: 'not_started' },
          { id: 'jm_3', name: 'Matrices & Determinants', status: 'not_started' },
          { id: 'jm_4', name: 'Permutations & Combinations (P&C)', status: 'not_started' },
          { id: 'jm_5', name: 'Binomial Theorem & Simple Applications', status: 'not_started' },
          { id: 'jm_6', name: 'Sequences & Series (AP, GP)', status: 'not_started' },
          { id: 'jm_7', name: 'Limits, Continuity & Differentiability', status: 'not_started' },
          { id: 'jm_8', name: 'Integral Calculus (Definite & Indefinite)', status: 'not_started' },
          { id: 'jm_9', name: 'Differential Equations', status: 'not_started' },
          { id: 'jm_10', name: 'Coordinate Geometry (Straight Lines, Circles, Conics)', status: 'not_started' },
          { id: 'jm_11', name: 'Three Dimensional Geometry (3D) & Vectors', status: 'not_started' },
          { id: 'jm_12', name: 'Probability & Statistics', status: 'not_started' },
          { id: 'jm_13', name: 'Trigonometry & Trigonometric Equations', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'Session 1 & 2', title: 'JEE Main 2024 All Shift Official Papers with Detailed Solutions', link: 'https://jeemain.nta.nic.in', hasAnswerKey: true },
      { year: '2023', shift: 'Jan & April', title: 'JEE Main 2023 Official Question Papers Chapterwise', link: 'https://jeemain.nta.nic.in', hasAnswerKey: true },
      { year: '2022', shift: 'All Shifts', title: 'JEE Main 2022 Official Question Papers with NTA Final Answer Key', link: 'https://jeemain.nta.nic.in', hasAnswerKey: true },
      { year: '2021', shift: 'Feb, March, July, Aug', title: 'JEE Main 2021 Question Bank All Sessions', link: 'https://jeemain.nta.nic.in', hasAnswerKey: true },
    ],
  },

  // ── NEET UG (Medical / MBBS) ─────────────────────────────────────────────
  {
    id: 'neet_ug',
    name: 'NEET UG',
    fullName: 'National Eligibility cum Entrance Test (Undergraduate)',
    conductingBody: 'NTA (National Testing Agency)',
    category: 'Medical Entrance / MBBS & BDS',
    keywords: ['neet', 'neet ug', 'mbbs', 'bds', 'medical', 'biology', 'nta', 'doctor', 'neet 2025', 'neet 2026'],
    overview: {
      eligibility: '10+2 with Physics, Chemistry, Biology/Biotechnology & English. Minimum 50% marks in PCB. Minimum age 17 years.',
      mode: 'Pen and Paper Test (Offline OMR Sheet)',
      stages: 'Single National Level Examination',
      negativeMarking: '+4 for correct, -1 for incorrect, 0 for unattempted',
      duration: '3 Hours 20 Minutes (200 Minutes)',
    },
    pattern: [
      {
        stage: 'NEET Question Paper Pattern',
        subjects: [
          { name: 'Physics: Section A (35 Qs) + Section B (10 of 15 Qs)', questions: 45, marks: 180 },
          { name: 'Chemistry: Section A (35 Qs) + Section B (10 of 15 Qs)', questions: 45, marks: 180 },
          { name: 'Botany: Section A (35 Qs) + Section B (10 of 15 Qs)', questions: 45, marks: 180 },
          { name: 'Zoology: Section A (35 Qs) + Section B (10 of 15 Qs)', questions: 45, marks: 180 },
        ],
        totalQuestions: 180,
        totalMarks: 720,
        time: '3 Hours 20 Minutes',
      },
    ],
    syllabus: [
      {
        id: 'neet_bio',
        name: 'Biology (Botany & Zoology)',
        topics: [
          { id: 'nb_1', name: 'Diversity in the Living World & Plant/Animal Classification', status: 'not_started' },
          { id: 'nb_2', name: 'Structural Organisation in Animals & Plants (Anatomy & Morphology)', status: 'not_started' },
          { id: 'nb_3', name: 'Cell Structure and Function (Cell Cycle, Mitosis, Meiosis)', status: 'not_started' },
          { id: 'nb_4', name: 'Plant Physiology (Photosynthesis, Respiration in Plants)', status: 'not_started' },
          { id: 'nb_5', name: 'Human Physiology (Circulation, Excretion, Neural Control, Endocrine)', status: 'not_started' },
          { id: 'nb_6', name: 'Reproduction in Flowering Plants & Human Reproduction', status: 'not_started' },
          { id: 'nb_7', name: 'Genetics and Evolution (Mendelism, DNA/RNA, Molecular Basis)', status: 'not_started' },
          { id: 'nb_8', name: 'Biology and Human Welfare (Human Health & Disease, Microbes)', status: 'not_started' },
          { id: 'nb_9', name: 'Biotechnology: Principles and Processes & Applications', status: 'not_started' },
          { id: 'nb_10', name: 'Ecology and Environment (Population, Ecosystem, Biodiversity)', status: 'not_started' },
        ],
      },
      {
        id: 'neet_physics',
        name: 'Physics (NEET)',
        topics: [
          { id: 'np_1', name: 'Kinematics & Laws of Motion', status: 'not_started' },
          { id: 'np_2', name: 'Work, Energy and Power & System of Particles', status: 'not_started' },
          { id: 'np_3', name: 'Gravitation & Mechanical Properties of Solids/Fluids', status: 'not_started' },
          { id: 'np_4', name: 'Thermodynamics & Kinetic Theory', status: 'not_started' },
          { id: 'np_5', name: 'Oscillations & Waves', status: 'not_started' },
          { id: 'np_6', name: 'Electrostatics & Current Electricity', status: 'not_started' },
          { id: 'np_7', name: 'Magnetic Effects of Current & Magnetism', status: 'not_started' },
          { id: 'np_8', name: 'Electromagnetic Induction & Alternating Currents', status: 'not_started' },
          { id: 'np_9', name: 'Optics (Ray Optics and Optical Instruments, Wave Optics)', status: 'not_started' },
          { id: 'np_10', name: 'Dual Nature of Matter and Radiation & Atoms/Nuclei', status: 'not_started' },
          { id: 'np_11', name: 'Electronic Devices (Semiconductor Diodes)', status: 'not_started' },
        ],
      },
      {
        id: 'neet_chem',
        name: 'Chemistry (NEET)',
        topics: [
          { id: 'nc_1', name: 'Structure of Atom & Periodic Classification', status: 'not_started' },
          { id: 'nc_2', name: 'Chemical Bonding and Molecular Structure', status: 'not_started' },
          { id: 'nc_3', name: 'Chemical Thermodynamics & Equilibrium', status: 'not_started' },
          { id: 'nc_4', name: 'Solutions & Electrochemistry', status: 'not_started' },
          { id: 'nc_5', name: 'Chemical Kinetics & Redox Reactions', status: 'not_started' },
          { id: 'nc_6', name: 'd and f Block Elements & Coordination Compounds', status: 'not_started' },
          { id: 'nc_7', name: 'Purification and Characterisation of Organic Compounds', status: 'not_started' },
          { id: 'nc_8', name: 'Hydrocarbons & Organic Compounds Containing Halogens', status: 'not_started' },
          { id: 'nc_9', name: 'Organic Compounds Containing Oxygen (Alcohols, Aldehydes, Acids)', status: 'not_started' },
          { id: 'nc_10', name: 'Organic Compounds Containing Nitrogen (Amines) & Biomolecules', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'All Codes', title: 'NEET UG 2024 Official Question Paper with Master Answer Key', link: 'https://neet.nta.nic.in', hasAnswerKey: true },
      { year: '2023', shift: 'All Sets', title: 'NEET UG 2023 Official Paper with Solutions', link: 'https://neet.nta.nic.in', hasAnswerKey: true },
      { year: '2022', shift: 'All Sets', title: 'NEET UG 2022 Official Question Paper & Key', link: 'https://neet.nta.nic.in', hasAnswerKey: true },
      { year: '2021', shift: 'All Sets', title: 'NEET UG 2021 Question Bank', link: 'https://neet.nta.nic.in', hasAnswerKey: true },
    ],
  },

  // ── NDA (National Defence Academy) ──────────────────────────────────────
  {
    id: 'upsc_nda',
    name: 'UPSC NDA',
    fullName: 'National Defence Academy & Naval Academy Examination',
    conductingBody: 'UPSC (Union Public Service Commission)',
    category: 'Defence Officer / Army, Navy, Air Force',
    keywords: ['nda', 'defence', 'army', 'navy', 'air force', 'upsc nda', 'ssb interview', 'nda 2025', 'nda 2026'],
    overview: {
      eligibility: '12th Class pass (PCM required for Air Force & Navy wings). Unmarried male/female candidates. Age 16.5 to 19.5 years.',
      mode: 'Offline Pen & Paper (OMR)',
      stages: 'Written Examination (900 Marks) ➔ 5-Day SSB Interview (900 Marks)',
      negativeMarking: 'Maths: 0.83 marks deduction | GAT: 1.33 marks deduction',
      duration: 'Paper 1 (Maths): 2.5 Hours | Paper 2 (GAT): 2.5 Hours',
    },
    pattern: [
      {
        stage: 'Written Examination',
        subjects: [
          { name: 'Mathematics (11th & 12th standard)', questions: 120, marks: 300 },
          { name: 'General Ability Test (GAT) - English (200 M) + GK/Science (400 M)', questions: 150, marks: 600 },
        ],
        totalQuestions: 270,
        totalMarks: 900,
        time: '5 Hours (2.5 Hours each)',
      },
      {
        stage: 'SSB Interview & Medicals',
        subjects: [{ name: '5-Day SSB (Psychology, GTO Tasks, Personal Interview)', questions: '-', marks: 900 }],
        totalQuestions: '-',
        totalMarks: 900,
        time: '5 Days',
      },
    ],
    syllabus: [
      {
        id: 'nda_maths',
        name: 'Mathematics (NDA)',
        topics: [
          { id: 'nm_1', name: 'Algebra (Sets, Venn diagrams, Quadratic Equations, Logarithms)', status: 'not_started' },
          { id: 'nm_2', name: 'Matrices and Determinants', status: 'not_started' },
          { id: 'nm_3', name: 'Trigonometry (Angles, Heights and Distances)', status: 'not_started' },
          { id: 'nm_4', name: 'Analytical Geometry (2D and 3D)', status: 'not_started' },
          { id: 'nm_5', name: 'Differential Calculus & Applications of Derivatives', status: 'not_started' },
          { id: 'nm_6', name: 'Integral Calculus and Differential Equations', status: 'not_started' },
          { id: 'nm_7', name: 'Vector Algebra', status: 'not_started' },
          { id: 'nm_8', name: 'Statistics and Probability', status: 'not_started' },
        ],
      },
      {
        id: 'nda_gat',
        name: 'General Ability Test (GAT)',
        topics: [
          { id: 'ng_1', name: 'English (Vocabulary, Grammar, Comprehension, Spotting Errors)', status: 'not_started' },
          { id: 'ng_2', name: 'Physics (Mechanics, Heat, Optics, Electricity)', status: 'not_started' },
          { id: 'ng_3', name: 'Chemistry (Physical & Chemical changes, Elements, Acids & Bases)', status: 'not_started' },
          { id: 'ng_4', name: 'General Science (Basis of life, Cells, Human diseases)', status: 'not_started' },
          { id: 'ng_5', name: 'History, Freedom Movement & Indian Constitution', status: 'not_started' },
          { id: 'ng_6', name: 'Geography (Earth, Ocean currents, Indian Physical features)', status: 'not_started' },
          { id: 'ng_7', name: 'Current Affairs & Defence Exercises', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'NDA 1 & 2', title: 'UPSC NDA 2024 Official Maths & GAT Question Papers with Solutions', link: 'https://upsc.gov.in', hasAnswerKey: true },
      { year: '2023', shift: 'NDA 1 & 2', title: 'UPSC NDA 2023 Question Papers with Official Answer Key', link: 'https://upsc.gov.in', hasAnswerKey: true },
      { year: '2022', shift: 'NDA 1 & 2', title: 'UPSC NDA 2022 Papers', link: 'https://upsc.gov.in', hasAnswerKey: true },
    ],
  },

  // ── BANKING (IBPS / SBI PO) ──────────────────────────────────────────────
  {
    id: 'sbi_ibps_po',
    name: 'Banking (SBI / IBPS PO)',
    fullName: 'State Bank of India & IBPS Probationary Officer',
    conductingBody: 'SBI / IBPS (Institute of Banking Personnel Selection)',
    category: 'Banking / Bank Officer',
    keywords: ['banking', 'bank', 'sbi po', 'ibps po', 'sbi clerk', 'ibps clerk', 'bank exam', 'banking 2025'],
    overview: {
      eligibility: 'Graduation in any discipline. Age 20 to 30 years.',
      mode: 'Computer Based Test (CBT Online)',
      stages: 'Prelims (Online) ➔ Mains (Objective + Descriptive) ➔ Interview / Group Discussion',
      negativeMarking: '0.25 marks penalty per wrong answer',
      duration: 'Prelims: 60 Minutes (Sectional timing: 20 mins each)',
    },
    pattern: [
      {
        stage: 'Prelims Exam (Screening)',
        subjects: [
          { name: 'English Language (20 mins)', questions: 30, marks: 30 },
          { name: 'Quantitative Aptitude (20 mins)', questions: 35, marks: 35 },
          { name: 'Reasoning Ability (20 mins)', questions: 35, marks: 35 },
        ],
        totalQuestions: 100,
        totalMarks: 100,
        time: '60 Minutes',
      },
      {
        stage: 'Mains Exam',
        subjects: [
          { name: 'Reasoning & Computer Aptitude (45 Qs)', questions: 45, marks: 60 },
          { name: 'Data Analysis & Interpretation (35 Qs)', questions: 35, marks: 60 },
          { name: 'General / Economy / Banking Awareness (40 Qs)', questions: 40, marks: 40 },
          { name: 'English Language (35 Qs)', questions: 35, marks: 40 },
          { name: 'Descriptive Test: Letter & Essay Writing', questions: 2, marks: 25 },
        ],
        totalQuestions: 157,
        totalMarks: 225,
        time: '3.5 Hours',
      },
    ],
    syllabus: [
      {
        id: 'bank_quant',
        name: 'Quantitative Aptitude & Data Analysis',
        topics: [
          { id: 'bq_1', name: 'Data Interpretation (Bar, Line, Pie, Caselet, Radar)', status: 'not_started' },
          { id: 'bq_2', name: 'Approximation, Simplification & Number Series (Missing/Wrong)', status: 'not_started' },
          { id: 'bq_3', name: 'Quadratic Equations & Inequalities', status: 'not_started' },
          { id: 'bq_4', name: 'Arithmetic: Percentages, Profit & Loss, SI/CI', status: 'not_started' },
          { id: 'bq_5', name: 'Time & Work, Pipes & Cisterns', status: 'not_started' },
          { id: 'bq_6', name: 'Speed, Time, Distance, Trains & Boats/Streams', status: 'not_started' },
          { id: 'bq_7', name: 'Permutations, Combinations & Probability', status: 'not_started' },
        ],
      },
      {
        id: 'bank_reasoning',
        name: 'Reasoning Ability & High-Level Puzzles',
        topics: [
          { id: 'br_1', name: 'Seating Arrangements (Circular, Square, Linear, Parallel Rows)', status: 'not_started' },
          { id: 'br_2', name: 'Puzzles (Floor, Box, Month-Date, Scheduling, Matrix)', status: 'not_started' },
          { id: 'br_3', name: 'Syllogism (Only A Few, Reverse Syllogism)', status: 'not_started' },
          { id: 'br_4', name: 'Inequalities (Coded & Direct)', status: 'not_started' },
          { id: 'br_5', name: 'Input-Output Machine Reasoning', status: 'not_started' },
          { id: 'br_6', name: 'Blood Relations & Direction Sense', status: 'not_started' },
          { id: 'br_7', name: 'Critical / Logical Reasoning (Statement-Assumption, Cause-Effect)', status: 'not_started' },
        ],
      },
      {
        id: 'bank_ga',
        name: 'Banking & Financial Awareness',
        topics: [
          { id: 'ba_1', name: 'RBI Functions, Monetary Policy & Repo Rates', status: 'not_started' },
          { id: 'ba_2', name: 'Banking Terms (NPA, CRR, SLR, CASA, NEFT/RTGS)', status: 'not_started' },
          { id: 'ba_3', name: 'Current Financial Affairs & Union Budget', status: 'not_started' },
          { id: 'ba_4', name: 'Government Schemes & Financial Inclusion (PMJDY)', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2024', shift: 'Prelims & Mains', title: 'SBI PO 2024 Memory Based Question Paper with Solutions', link: 'https://sbi.co.in', hasAnswerKey: true },
      { year: '2023', shift: 'Prelims & Mains', title: 'IBPS PO 2023 Complete Question Paper with Explanations', link: 'https://ibps.in', hasAnswerKey: true },
      { year: '2022', shift: 'All Shifts', title: 'SBI / IBPS PO Previous Year Solved Papers', link: 'https://ibps.in', hasAnswerKey: true },
    ],
  },

  // ── RAILWAYS (RRB NTPC) ──────────────────────────────────────────────────
  {
    id: 'rrb_ntpc',
    name: 'RRB NTPC',
    fullName: 'Railway Recruitment Board - Non-Technical Popular Categories',
    conductingBody: 'RRB (Ministry of Railways)',
    category: 'Govt Job / Indian Railways',
    keywords: ['railway', 'rrb', 'ntpc', 'station master', 'goods guard', 'clerk', 'railway 2025', 'railway 2026', 'rrb ntpc'],
    overview: {
      eligibility: '12th Pass or Graduate (depending on post: Station Master, Goods Guard, Senior Clerk). Age 18-33/36 years.',
      mode: 'Computer Based Test (CBT Online)',
      stages: 'CBT 1 (Screening) ➔ CBT 2 (Merit Selection) ➔ Typing/CBAT Test ➔ Document Verification',
      negativeMarking: '1/3rd mark deducted per wrong answer',
      duration: '90 Minutes (100 Questions in CBT 1, 120 Questions in CBT 2)',
    },
    pattern: [
      {
        stage: 'CBT 1 (Screening)',
        subjects: [
          { name: 'General Awareness', questions: 40, marks: 40 },
          { name: 'Mathematics', questions: 30, marks: 30 },
          { name: 'General Intelligence and Reasoning', questions: 30, marks: 30 },
        ],
        totalQuestions: 100,
        totalMarks: 100,
        time: '90 Minutes',
      },
      {
        stage: 'CBT 2 (Final Merit)',
        subjects: [
          { name: 'General Awareness', questions: 50, marks: 50 },
          { name: 'Mathematics', questions: 35, marks: 35 },
          { name: 'General Intelligence and Reasoning', questions: 35, marks: 35 },
        ],
        totalQuestions: 120,
        totalMarks: 120,
        time: '90 Minutes',
      },
    ],
    syllabus: [
      {
        id: 'rrb_maths',
        name: 'Mathematics (RRB NTPC)',
        topics: [
          { id: 'rm_1', name: 'Number System, Decimals & Fractions', status: 'not_started' },
          { id: 'rm_2', name: 'LCM & HCF', status: 'not_started' },
          { id: 'rm_3', name: 'Ratio & Proportions, Percentage', status: 'not_started' },
          { id: 'rm_4', name: 'Mensuration (Area, Perimeter, Volume)', status: 'not_started' },
          { id: 'rm_5', name: 'Time and Work, Time and Distance', status: 'not_started' },
          { id: 'rm_6', name: 'Simple and Compound Interest, Profit & Loss', status: 'not_started' },
          { id: 'rm_7', name: 'Elementary Algebra, Geometry and Trigonometry', status: 'not_started' },
          { id: 'rm_8', name: 'Elementary Statistics (Mean, Median, Mode)', status: 'not_started' },
        ],
      },
      {
        id: 'rrb_ga',
        name: 'General Awareness & Science (RRB NTPC)',
        topics: [
          { id: 'rg_1', name: 'General Science (Physics, Chemistry & Biology up to 10th CBSE)', status: 'not_started' },
          { id: 'rg_2', name: 'Current Events of National and International Importance', status: 'not_started' },
          { id: 'rg_3', name: 'History of India and Freedom Struggle', status: 'not_started' },
          { id: 'rg_4', name: 'Indian Polity and Governance - Constitution and Political System', status: 'not_started' },
          { id: 'rg_5', name: 'Indian and World Geography', status: 'not_started' },
          { id: 'rg_6', name: 'Basic Computer Applications and Terminologies', status: 'not_started' },
          { id: 'rg_7', name: 'Indian Railways Facts, History & Static GK', status: 'not_started' },
        ],
      },
    ],
    pyqs: [
      { year: '2022', shift: 'CBT 2 All Levels', title: 'RRB NTPC CBT 2 Official Question Papers with Final Answer Keys', link: 'https://rrbcdg.gov.in', hasAnswerKey: true },
      { year: '2021', shift: 'CBT 1 All 7 Phases', title: 'RRB NTPC CBT 1 Official Master Papers with Solutions', link: 'https://rrbcdg.gov.in', hasAnswerKey: true },
    ],
  },
]

/**
 * Searches the exam database with query string.
 * Supports partial matching on name, full name, conducting body, and keywords.
 */
export function searchExams(queryStr = '') {
  const q = (queryStr || '').trim().toLowerCase()
  if (!q) return EXAM_DATABASE

  return EXAM_DATABASE.filter((exam) => {
    if (exam.name.toLowerCase().includes(q)) return true
    if (exam.fullName.toLowerCase().includes(q)) return true
    if (exam.category.toLowerCase().includes(q)) return true
    if (exam.conductingBody.toLowerCase().includes(q)) return true
    if (exam.keywords.some((k) => k.toLowerCase().includes(q))) return true

    // Check subjects & topics
    const matchesSubject = exam.syllabus.some((sub) =>
      sub.name.toLowerCase().includes(q) ||
      sub.topics.some((top) => top.name.toLowerCase().includes(q))
    )
    return matchesSubject
  })
}
