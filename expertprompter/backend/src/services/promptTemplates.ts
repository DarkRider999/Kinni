// Task templates: category-specific blueprints that PromptGenerationService
// fills in. Each category has one or more specific templates (matched by
// regex against the task) and a `default` template used when none match.
// The same catalog seeds the `Template` table (see prisma/seed.ts).

import type { Category } from '../types';

export type PromptMode = 'text' | 'image' | 'video' | 'music';

export interface Section {
  /** Short label, used in the one-paragraph summary ("notice period"). */
  label: string;
  /** Longer instruction, used in the structured "What to include" list. */
  detail: string;
}

export interface TaskTemplate {
  key: string;
  name: string;
  category: Category;
  mode: PromptMode;
  /** Matched against the lower-cased task. Omitted on default templates. */
  match?: RegExp;
  role: string;
  /** Verb used when the user typed a noun phrase ("business plan for ..."). */
  defaultVerb: string;
  defaultTone: string[];
  sections: Section[];
  defaultFormat: string;
  qualityChecks: string[];
  /** Media templates: default aspect ratio / duration hints. */
  aspectRatio?: string;
  /** Flat graphics (logos) skip scene lighting/composition descriptors. */
  flatGraphic?: boolean;
}

const s = (label: string, detail: string): Section => ({ label, detail });

export const TEMPLATES: TaskTemplate[] = [
  // ---------------------------------------------------------------- WRITING
  {
    key: 'writing.resignation-letter', name: 'Resignation Letter', category: 'WRITING', mode: 'text',
    match: /resignation|resign\b|quit(ting)? (my|the) job/,
    role: 'an experienced HR communications specialist who writes gracious, professional workplace correspondence',
    defaultVerb: 'Write', defaultTone: ['appreciative', 'concise'],
    sections: [
      s('notice period', 'State the resignation clearly in the first paragraph, with the last working day and notice period.'),
      s('gratitude for opportunities', 'Thank the manager and team, naming one or two specific growth opportunities or experiences.'),
      s('willingness to support transition', 'Offer concrete help with the handover: documenting processes, training a replacement, finishing key tasks.'),
      s('a positive closing', 'Close warmly, keep the door open for the future, and include a professional sign-off with name and contact details.'),
    ],
    defaultFormat: 'formal business letter',
    qualityChecks: ['No complaints, negativity or reasons that could burn bridges.', 'Fits on one page (under ~300 words).', 'Includes placeholders like [Manager Name] and [Last Working Day] where details are unknown.'],
  },
  {
    key: 'writing.cover-letter', name: 'Cover Letter', category: 'WRITING', mode: 'text',
    match: /cover letter|job application|apply(ing)? for/,
    role: 'a senior career coach and professional resume writer',
    defaultVerb: 'Write', defaultTone: ['confident', 'warm'],
    sections: [
      s('a strong opening hook', 'Open with the role applied for and a compelling reason for the fit.'),
      s('two or three quantified achievements', 'Map the candidate\'s top achievements to the job requirements, with numbers where possible.'),
      s('company-specific motivation', 'Show genuine knowledge of the company and why the candidate wants to work there.'),
      s('a clear call to action', 'Close by requesting an interview and thanking the reader.'),
    ],
    defaultFormat: 'one-page business letter',
    qualityChecks: ['Avoid clichés like "I am a hard-working team player".', 'Under 400 words.', 'Use [placeholders] for unknown names and details.'],
  },
  {
    key: 'writing.email', name: 'Email', category: 'WRITING', mode: 'text',
    match: /\be-?mail\b/,
    role: 'an expert business communicator',
    defaultVerb: 'Write', defaultTone: ['clear', 'courteous'],
    sections: [
      s('a specific subject line', 'Provide a short, specific subject line.'),
      s('the purpose up front', 'State the purpose of the email in the first two sentences.'),
      s('supporting details', 'Give the necessary context and details in short paragraphs or bullets.'),
      s('a clear next step', 'End with one clear request or next step and a polite sign-off.'),
    ],
    defaultFormat: 'email with subject line',
    qualityChecks: ['Readable in under a minute.', 'One main ask only.'],
  },
  {
    key: 'writing.ebook', name: 'eBook / Book Chapter', category: 'WRITING', mode: 'text',
    match: /\be-?book\b|\bchapter\b|\bkdp\b|\bnovel\b|non-?fiction book/,
    role: 'a bestselling author and developmental editor who has published successful books on Amazon KDP',
    defaultVerb: 'Write', defaultTone: ['engaging', 'authoritative'],
    sections: [
      s('a reader promise', 'Open with the transformation or payoff the reader will get.'),
      s('a clear chapter structure', 'Organise the content into logical chapters/sub-sections with descriptive headings.'),
      s('stories and examples', 'Use relatable stories, case studies and concrete examples to illustrate each key point.'),
      s('actionable takeaways', 'End each chapter with a short summary and 3–5 actionable takeaways or exercises.'),
    ],
    defaultFormat: 'manuscript in Markdown with chapter headings',
    qualityChecks: ['Original wording (no copied text).', 'Consistent voice and terminology throughout.', 'Short paragraphs suited to e-readers.'],
  },
  {
    key: 'writing.blog-post', name: 'Blog Post / Article', category: 'WRITING', mode: 'text',
    match: /blog|article|\bpost about\b/,
    role: 'an experienced content writer and editor',
    defaultVerb: 'Write', defaultTone: ['engaging', 'informative'],
    sections: [
      s('a compelling headline', 'Suggest a compelling headline plus two alternatives.'),
      s('a hook introduction', 'Open with a hook that states the reader\'s problem and what they will learn.'),
      s('scannable body sections', 'Use H2/H3 subheadings, short paragraphs, examples and bullet lists.'),
      s('a conclusion with a call to action', 'Summarise the key points and end with a clear call to action.'),
    ],
    defaultFormat: 'Markdown article with headings',
    qualityChecks: ['Every section delivers a concrete, useful point.', 'Include a 150-character meta description at the end.'],
  },
  {
    key: 'writing.story', name: 'Story', category: 'WRITING', mode: 'text',
    match: /\bstory\b|fiction|fairy ?tale|poem/,
    role: 'an award-winning fiction writer',
    defaultVerb: 'Write', defaultTone: ['vivid', 'immersive'],
    sections: [
      s('memorable characters', 'Introduce characters with clear desires and a distinct voice.'),
      s('a clear conflict', 'Establish the central conflict early and raise the stakes.'),
      s('sensory detail', 'Show, don\'t tell — use concrete sensory details and dialogue.'),
      s('a satisfying ending', 'Resolve the arc with an ending that feels earned (twist optional).'),
    ],
    defaultFormat: 'prose with a title',
    qualityChecks: ['Consistent point of view and tense.', 'Avoid clichéd openings ("Once upon a time") unless requested.'],
  },
  {
    key: 'writing.default', name: 'General Writing', category: 'WRITING', mode: 'text',
    role: 'a skilled professional writer and editor',
    defaultVerb: 'Write', defaultTone: ['clear', 'engaging'],
    sections: [
      s('a clear purpose', 'Make the main purpose obvious in the opening lines.'),
      s('logical structure', 'Organise ideas into a logical flow with smooth transitions.'),
      s('specific details and examples', 'Support each point with specific details or examples.'),
      s('a strong conclusion', 'End with a memorable conclusion or next step.'),
    ],
    defaultFormat: 'well-structured text with headings where helpful',
    qualityChecks: ['No filler or repetition.', 'Grammatically flawless.'],
  },

  // --------------------------------------------------------------- BUSINESS
  {
    key: 'business.business-plan', name: 'Business Plan', category: 'BUSINESS', mode: 'text',
    match: /business plan|startup plan|plan for (a|an|my) .*(business|startup|company|restaurant|kitchen|shop|store|agency|cafe)/,
    role: 'a seasoned startup consultant and former venture-capital analyst who has written investor-ready business plans',
    defaultVerb: 'Create', defaultTone: ['data-driven', 'persuasive'],
    sections: [
      s('an executive summary', 'Executive summary: the concept, the opportunity, and the funding ask in under 200 words.'),
      s('market analysis', 'Market analysis: market size (TAM/SAM/SOM), trends, target customer segments and demand drivers.'),
      s('competitive landscape', 'Competitive landscape: key competitors, a comparison table, and the unique value proposition.'),
      s('business and revenue model', 'Business model: revenue streams, pricing strategy and unit economics (e.g. average order value, margins).'),
      s('operations plan', 'Operations: location, suppliers, staffing, technology, and licences/regulatory requirements.'),
      s('marketing and sales strategy', 'Go-to-market: customer acquisition channels, launch plan and retention tactics.'),
      s('financial projections', 'Financials: start-up costs, 3-year revenue/expense projections, break-even analysis (in tables).'),
      s('risks and mitigation', 'Risks: the top 5 risks with a mitigation plan for each.'),
      s('a 12-month roadmap', 'Milestones: a 12-month roadmap with measurable KPIs.'),
    ],
    defaultFormat: 'structured report with headings, bullet points and tables',
    qualityChecks: ['State every assumption behind numbers explicitly.', 'Use realistic, locally relevant figures and label estimates as estimates.', 'Investor-ready: specific, not generic.'],
  },
  {
    key: 'business.pitch-deck', name: 'Pitch Deck', category: 'BUSINESS', mode: 'text',
    match: /pitch deck|investor deck|slides? for investors/,
    role: 'a startup pitch coach who has helped founders raise seed and Series A rounds',
    defaultVerb: 'Create', defaultTone: ['compelling', 'concise'],
    sections: [
      s('problem and solution', 'Slides 1–3: title, problem, solution.'),
      s('market and traction', 'Slides 4–6: market size, product, traction/validation.'),
      s('business model and competition', 'Slides 7–9: business model, competition, go-to-market.'),
      s('team, financials and the ask', 'Slides 10–12: team, financial highlights, the ask and use of funds.'),
    ],
    defaultFormat: 'slide-by-slide outline with a headline, 3 bullets and speaker notes per slide',
    qualityChecks: ['One key message per slide.', '10–12 slides total.'],
  },
  {
    key: 'business.swot', name: 'SWOT Analysis', category: 'BUSINESS', mode: 'text',
    match: /swot/,
    role: 'a strategy consultant',
    defaultVerb: 'Create', defaultTone: ['objective', 'analytical'],
    sections: [
      s('strengths', 'Strengths: internal advantages with evidence.'),
      s('weaknesses', 'Weaknesses: internal limitations, stated honestly.'),
      s('opportunities', 'Opportunities: external trends to exploit.'),
      s('threats', 'Threats: external risks, plus strategic recommendations that link the four quadrants.'),
    ],
    defaultFormat: '2x2 table followed by prioritised recommendations',
    qualityChecks: ['At least 4 specific points per quadrant.', 'Recommendations are actionable.'],
  },
  {
    key: 'business.default', name: 'Business Strategy', category: 'BUSINESS', mode: 'text',
    role: 'a senior management consultant',
    defaultVerb: 'Create', defaultTone: ['pragmatic', 'data-driven'],
    sections: [
      s('situation summary', 'Summarise the current situation and the core objective.'),
      s('key analysis', 'Analyse the relevant market, customer and financial factors.'),
      s('options and recommendation', 'Compare 2–3 options and recommend one with reasoning.'),
      s('an action plan', 'Give a step-by-step action plan with owners, timelines and KPIs.'),
    ],
    defaultFormat: 'structured memo with headings, bullets and a summary table',
    qualityChecks: ['Recommendations are specific and measurable.', 'Assumptions are stated.'],
  },

  // ----------------------------------------------------------------- CODING
  {
    key: 'coding.debug', name: 'Debug / Fix Bug', category: 'CODING', mode: 'text',
    match: /\bbug|debug|fix|error|exception|not working|crash|broken|stack ?trace/,
    role: 'a senior software engineer who is methodical about debugging and root-cause analysis',
    defaultVerb: 'Debug', defaultTone: ['precise', 'methodical'],
    sections: [
      s('root-cause analysis', 'Identify the most likely root cause(s) and explain why the bug occurs.'),
      s('a corrected implementation', 'Provide the corrected code, changing only what is necessary.'),
      s('an explanation of the fix', 'Explain what changed and why it resolves the issue.'),
      s('tests to prevent regression', 'Add or describe tests that reproduce the bug and prove the fix.'),
    ],
    defaultFormat: 'explanation followed by code blocks with language tags',
    qualityChecks: ['Ask for the exact error message, code and environment if they are missing.', 'Do not introduce unrelated changes.'],
  },
  {
    key: 'coding.api', name: 'API / Backend', category: 'CODING', mode: 'text',
    match: /\bapi\b|endpoint|backend|server|database|rest\b|graphql/,
    role: 'a senior backend engineer experienced in secure, production-grade API design',
    defaultVerb: 'Build', defaultTone: ['precise', 'pragmatic'],
    sections: [
      s('data model and endpoints', 'Define the data model and list each endpoint with method, path, request and response shapes.'),
      s('complete implementation', 'Provide complete, runnable code (no pseudo-code or "..." placeholders).'),
      s('validation, auth and error handling', 'Include input validation, authentication/authorisation and consistent error responses.'),
      s('tests and run instructions', 'Include unit/integration tests and instructions to install, configure and run.'),
    ],
    defaultFormat: 'file-by-file code blocks with brief explanations',
    qualityChecks: ['Follow security best practices (no secrets in code, parameterised queries).', 'Explain any trade-offs.'],
  },
  {
    key: 'coding.review', name: 'Code Review', category: 'CODING', mode: 'text',
    match: /review (my|this|the) code|code review|refactor|optimi[sz]e|clean ?up/,
    role: 'a staff engineer performing a thorough code review',
    defaultVerb: 'Review', defaultTone: ['constructive', 'specific'],
    sections: [
      s('correctness issues', 'List bugs and edge cases, ordered by severity.'),
      s('readability and design', 'Point out naming, structure and design improvements.'),
      s('performance and security', 'Flag performance bottlenecks and security risks.'),
      s('an improved version', 'Provide the refactored code with comments on key changes.'),
    ],
    defaultFormat: 'severity-ordered findings list followed by the improved code',
    qualityChecks: ['Every finding cites the specific line or construct.', 'Behaviour is preserved unless a bug is being fixed.'],
  },
  {
    key: 'coding.default', name: 'Feature Implementation', category: 'CODING', mode: 'text',
    role: 'a senior software engineer who writes clean, well-tested, production-ready code',
    defaultVerb: 'Implement', defaultTone: ['precise', 'clear'],
    sections: [
      s('clarified requirements', 'Restate the requirements and any assumptions (language, version, framework).'),
      s('the approach', 'Briefly explain the approach and why it was chosen.'),
      s('complete, working code', 'Provide complete, runnable code with meaningful names and comments on non-obvious parts.'),
      s('usage example and tests', 'Show example usage and unit tests covering edge cases.'),
    ],
    defaultFormat: 'short explanation followed by code blocks with language tags',
    qualityChecks: ['Handles edge cases and errors.', 'No placeholder code.'],
  },

  // ------------------------------------------------------------------ IMAGE
  {
    key: 'image.logo', name: 'Logo', category: 'IMAGE', mode: 'image',
    match: /logo|brand mark|emblem|icon/,
    role: 'a brand identity designer', defaultVerb: 'Design', defaultTone: ['modern', 'memorable'],
    sections: [
      s('simple scalable mark', 'minimalist vector logo, simple geometric shapes, scalable, works at small sizes'),
      s('limited palette', 'limited 2–3 colour palette, flat design'),
      s('clean background', 'centered on a plain white background, no mockup'),
    ],
    defaultFormat: 'square image', aspectRatio: '1:1', flatGraphic: true,
    qualityChecks: ['No gradients or tiny details that fail at small sizes.', 'Readable text if a brand name is included.'],
  },
  {
    key: 'image.thumbnail', name: 'YouTube Thumbnail', category: 'IMAGE', mode: 'image',
    match: /thumbnail/,
    role: 'a YouTube thumbnail designer', defaultVerb: 'Design', defaultTone: ['bold', 'high-energy'],
    sections: [
      s('strong focal subject', 'one strong focal subject with an expressive face or object, close-up'),
      s('high contrast', 'high contrast, saturated colours, strong rim light'),
      s('space for text', 'clear negative space on one side for 2–4 words of bold title text'),
    ],
    defaultFormat: 'landscape image', aspectRatio: '16:9',
    qualityChecks: ['Readable when shrunk to mobile size.'],
  },
  {
    key: 'image.default', name: 'Image Generation', category: 'IMAGE', mode: 'image',
    role: 'a professional art director', defaultVerb: 'Create', defaultTone: ['vivid', 'atmospheric'],
    // Media "sections" are literal descriptors appended to the image prompt.
    sections: [
      s('sharp subject', 'sharp focus on the main subject'),
      s('depth', 'layered foreground and background for depth'),
      s('colour', 'rich, harmonious colour grading'),
    ],
    defaultFormat: 'landscape image', aspectRatio: '3:2',
    qualityChecks: ['Subject is unambiguous.', 'Style is consistent.'],
  },

  // ------------------------------------------------------------------ VIDEO
  {
    key: 'video.youtube-script', name: 'YouTube Video Script', category: 'VIDEO', mode: 'text',
    match: /script|youtube video|youtube channel|explainer|faceless|narration|episode/,
    role: 'a YouTube scriptwriter and retention strategist who has scripted videos with millions of views',
    defaultVerb: 'Write', defaultTone: ['engaging', 'conversational'],
    sections: [
      s('a 15-second hook', 'Hook (0:00–0:15): a pattern-interrupt opening that promises the payoff.'),
      s('a retention-driven structure', 'Body: 3–5 segments, each ending with an open loop that leads into the next.'),
      s('visual and B-roll cues', 'Include [VISUAL] / [B-ROLL] cues and on-screen text suggestions next to the narration.'),
      s('a call to action', 'Outro: a natural subscribe/comment CTA and a teaser for the next video.'),
      s('title, description and tags', 'Finish with 5 title options, an SEO description and 15 tags.'),
    ],
    defaultFormat: 'two-column style script (NARRATION | VISUALS) with timestamps',
    qualityChecks: ['Spoken-word style: short sentences, no jargon.', 'Timestamps add up to the target duration.'],
  },
  {
    key: 'video.default', name: 'AI Video Clip', category: 'VIDEO', mode: 'video',
    role: 'a cinematographer', defaultVerb: 'Create', defaultTone: ['cinematic', 'dramatic'],
    sections: [
      s('subject and action', 'one clear subject performing one continuous action'),
      s('realistic physics', 'realistic physics and motion blur'),
      s('consistent look', 'consistent character and colour throughout'),
    ],
    defaultFormat: '5–10 second clip', aspectRatio: '16:9',
    qualityChecks: ['One continuous shot per prompt.', 'Physically plausible motion.'],
  },

  // ------------------------------------------------------------------ MUSIC
  {
    key: 'music.default', name: 'Song', category: 'MUSIC', mode: 'music',
    role: 'a hit songwriter and music producer', defaultVerb: 'Create', defaultTone: ['uplifting', 'catchy'],
    sections: [
      s('hook-driven chorus', 'a memorable, repeatable chorus hook'),
      s('verse storytelling', 'verses with concrete imagery that build to the chorus'),
      s('song structure', '[Intro] [Verse 1] [Pre-Chorus] [Chorus] [Verse 2] [Chorus] [Bridge] [Final Chorus] [Outro]'),
    ],
    defaultFormat: 'style prompt + structured lyrics',
    qualityChecks: ['Syllable counts are consistent between matching lines.', 'Chorus is singable and under 30 words.'],
  },

  // -------------------------------------------------------------- MARKETING
  {
    key: 'marketing.ad-copy', name: 'Ad Copy', category: 'MARKETING', mode: 'text',
    match: /\bads?\b|advert|ad copy|campaign|google ads|facebook ads/,
    role: 'a performance-marketing copywriter',
    defaultVerb: 'Write', defaultTone: ['punchy', 'persuasive'],
    sections: [
      s('headlines', '5 headline variations (under 40 characters).'),
      s('primary text', '3 primary-text variations using different angles (pain, gain, social proof).'),
      s('calls to action', 'Clear call-to-action options.'),
      s('targeting suggestions', 'Audience targeting and A/B test suggestions.'),
    ],
    defaultFormat: 'table of variations grouped by angle',
    qualityChecks: ['Each variation tests a distinct angle.', 'Complies with ad platform policies.'],
  },
  {
    key: 'marketing.social-post', name: 'Social Media Post', category: 'MARKETING', mode: 'text',
    match: /social media|instagram|linkedin|facebook|tiktok|tweet|twitter|\bx post\b|caption/,
    role: 'a social media strategist who grows engaged audiences',
    defaultVerb: 'Write', defaultTone: ['engaging', 'authentic'],
    sections: [
      s('a scroll-stopping first line', 'Open with a scroll-stopping first line.'),
      s('value-packed body', 'Deliver one clear idea or value in short lines with line breaks.'),
      s('a call to action', 'End with a call to action that invites comments or clicks.'),
      s('hashtags', 'Add 5–10 relevant hashtags (mix of broad and niche).'),
    ],
    defaultFormat: '3 post variations, each ready to copy-paste',
    qualityChecks: ['Respects the platform\'s length limits and conventions.', 'Emojis only where they help.'],
  },
  {
    key: 'marketing.product-listing', name: 'Product Description / Listing', category: 'MARKETING', mode: 'text',
    match: /description|listing|amazon|kdp|etsy|shopify|a\+ content/,
    role: 'a conversion copywriter specialising in e-commerce and Amazon listings',
    defaultVerb: 'Write', defaultTone: ['persuasive', 'benefit-focused'],
    sections: [
      s('an SEO-optimised title', 'An SEO-optimised title using the main keyword naturally.'),
      s('benefit-led bullet points', '5 bullet points that lead with benefits, then features.'),
      s('a persuasive description', 'A persuasive description that handles objections and paints the outcome.'),
      s('backend keywords', 'A list of 7 backend search keywords/phrases.'),
    ],
    defaultFormat: 'labelled sections ready to paste into the listing form',
    qualityChecks: ['Complies with marketplace policies (no unverifiable claims, no competitor names).', 'Keywords used naturally, not stuffed.'],
  },
  {
    key: 'marketing.default', name: 'Marketing Plan', category: 'MARKETING', mode: 'text',
    role: 'a growth marketing strategist',
    defaultVerb: 'Create', defaultTone: ['strategic', 'actionable'],
    sections: [
      s('target audience personas', 'Define 2–3 target audience personas with pains and goals.'),
      s('positioning and key messages', 'Positioning statement and 3 key messages.'),
      s('channel strategy', 'Channel mix with tactics, content ideas and budget split.'),
      s('KPIs and timeline', 'A 90-day timeline with KPIs and measurement plan.'),
    ],
    defaultFormat: 'structured plan with headings, bullets and a timeline table',
    qualityChecks: ['Tactics are specific to the audience and budget.', 'Every tactic has a measurable KPI.'],
  },

  // -------------------------------------------------------------- EDUCATION
  {
    key: 'education.lesson-plan', name: 'Lesson Plan', category: 'EDUCATION', mode: 'text',
    match: /lesson|class|curriculum|syllabus|course/,
    role: 'an experienced teacher and instructional designer',
    defaultVerb: 'Create', defaultTone: ['clear', 'encouraging'],
    sections: [
      s('learning objectives', 'SMART learning objectives.'),
      s('a timed lesson flow', 'Timed activities: warm-up, direct instruction, guided practice, independent practice, wrap-up.'),
      s('materials and differentiation', 'Materials needed and differentiation for struggling and advanced learners.'),
      s('assessment', 'A short formative assessment (e.g. exit ticket) with answers.'),
    ],
    defaultFormat: 'lesson plan with headings and a timing table',
    qualityChecks: ['Age-appropriate language and activities.', 'Activities align with the objectives.'],
  },
  {
    key: 'education.quiz', name: 'Quiz / Practice Questions', category: 'EDUCATION', mode: 'text',
    match: /quiz|exam|test questions|practice questions|flashcards|mcq/,
    role: 'an assessment designer',
    defaultVerb: 'Create', defaultTone: ['clear', 'fair'],
    sections: [
      s('a mix of difficulty levels', 'Questions spanning easy, medium and hard (Bloom\'s taxonomy levels).'),
      s('varied question types', 'Mix multiple-choice, short-answer and application questions.'),
      s('an answer key', 'A complete answer key.'),
      s('explanations', 'A one-line explanation for each answer.'),
    ],
    defaultFormat: 'numbered questions followed by an answer key',
    qualityChecks: ['Distractors are plausible.', 'No ambiguous questions.'],
  },
  {
    key: 'education.default', name: 'Concept Explanation', category: 'EDUCATION', mode: 'text',
    role: 'an expert teacher known for making complex topics simple',
    defaultVerb: 'Explain', defaultTone: ['clear', 'patient'],
    sections: [
      s('a simple definition', 'Start with a one-sentence plain-language definition.'),
      s('a real-world analogy', 'Give a relatable analogy or real-world example.'),
      s('a step-by-step breakdown', 'Break the concept down step by step, building from basics.'),
      s('a check for understanding', 'Finish with a summary and 3 quick questions to check understanding.'),
    ],
    defaultFormat: 'explanation with headings, examples and a summary',
    qualityChecks: ['Define jargon when first used.', 'Pitched at the stated audience level.'],
  },

  // ---------------------------------------------------------- DATA_ANALYSIS
  {
    key: 'data.default', name: 'Data Analysis', category: 'DATA_ANALYSIS', mode: 'text',
    role: 'a senior data analyst',
    defaultVerb: 'Analyze', defaultTone: ['objective', 'precise'],
    sections: [
      s('data understanding', 'Describe the data, check quality issues (missing values, outliers) and state assumptions.'),
      s('the analysis method', 'Choose and justify the analysis methods (descriptive stats, trends, segmentation, tests).'),
      s('key findings', 'Present the key findings with numbers and suggested charts.'),
      s('actionable recommendations', 'Translate findings into prioritised, actionable recommendations.'),
    ],
    defaultFormat: 'report with a summary, tables and chart descriptions (plus formulas or code where useful)',
    qualityChecks: ['Distinguish correlation from causation.', 'Show formulas/code so results are reproducible.'],
  },

  // --------------------------------------------------------------- RESEARCH
  {
    key: 'research.default', name: 'Research Summary', category: 'RESEARCH', mode: 'text',
    role: 'a meticulous research analyst',
    defaultVerb: 'Research', defaultTone: ['objective', 'balanced'],
    sections: [
      s('the research question', 'Restate the research question and scope.'),
      s('key findings with evidence', 'Summarise the key findings, each supported by evidence and sources.'),
      s('differing perspectives', 'Present competing viewpoints, limitations and open questions.'),
      s('a conclusion', 'Conclude with a synthesis and implications.'),
    ],
    defaultFormat: 'structured summary with headings and a sources list',
    qualityChecks: ['Cite sources; say clearly when something is uncertain.', 'Never invent citations.'],
  },

  // -------------------------------------------------------- GENERAL_WRITING
  {
    key: 'general.default', name: 'General Task', category: 'GENERAL_WRITING', mode: 'text',
    role: 'a knowledgeable, helpful expert assistant',
    defaultVerb: 'Help me with', defaultTone: ['clear', 'helpful'],
    sections: [
      s('a direct answer', 'Lead with a direct answer or deliverable.'),
      s('supporting details', 'Provide supporting details, steps or options.'),
      s('practical examples', 'Include practical examples.'),
      s('next steps', 'End with recommended next steps.'),
    ],
    defaultFormat: 'well-organised response with headings and bullet points',
    qualityChecks: ['Answer exactly what was asked.', 'State assumptions if the request is ambiguous.'],
  },
];

export function selectTemplate(category: Category, task: string): TaskTemplate {
  const lower = task.toLowerCase();
  const forCategory = TEMPLATES.filter((t) => t.category === category);
  return (
    forCategory.find((t) => t.match?.test(lower)) ??
    forCategory.find((t) => !t.match) ??
    TEMPLATES.find((t) => t.key === 'general.default')!
  );
}
