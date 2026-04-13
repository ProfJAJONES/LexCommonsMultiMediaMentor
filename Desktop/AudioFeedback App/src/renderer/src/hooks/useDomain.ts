import { useState, useCallback } from 'react'
import type { FeedbackComment } from '../types'
import type { CommentTemplate } from './useCommentTemplates'
import type { KnowledgeItem } from './useAIKnowledgeBase'

export type Domain = 'law' | 'theater' | 'music' | 'public_speaking' | 'debate' | 'teaching'

type Tag = FeedbackComment['tag']
type TemplateBase = Omit<CommentTemplate, 'id' | 'createdAt'>
type KBBase = Omit<KnowledgeItem, 'id' | 'createdAt'>

export interface DomainConfig {
  label: string
  icon: string
  color: string
  coachTitle: string
  /** Display label overrides for each tag key */
  tagLabels: Record<Tag, string>
  aiPersona: string
  quickPrompts: { professor: string[]; student: string[] }
  defaultTemplates: TemplateBase[]
  defaultKnowledge: KBBase[]
}

// ─── Domain configurations ────────────────────────────────────────────────────

export const DOMAIN_CONFIG: Record<Domain, DomainConfig> = {

  // ── Law & Court ──────────────────────────────────────────────────────────────
  law: {
    label: 'Law & Court',
    icon: '⚖️',
    color: '#818cf8',
    coachTitle: 'Oral Advocacy Coach',
    tagLabels: {
      pacing: 'Pacing', clarity: 'Clarity', volume: 'Volume',
      posture: 'Posture', eye_contact: 'Eye Contact', argument: 'Argument', general: 'General'
    },
    aiPersona: `You are an experienced oral advocacy coach and former appellate attorney. You help law students and attorneys improve their courtroom performance. Focus on argument structure, record mastery, responsiveness to bench questions, vocal delivery, and professional presence. Reference moot court standards and real-world appellate practice. Be direct, specific, and rigorous.`,
    quickPrompts: {
      professor: [
        'Analyze the vocal performance in this session',
        'What areas need the most work?',
        'Draft written feedback I can share with the student',
        'How would this performance fare before a real appellate bench?',
        'Suggest targeted drills to address the weak points'
      ],
      student: [
        'How did I do overall?',
        'What should I focus on before my next round?',
        'How can I handle hot bench questions better?',
        'My argument felt scattered — how do I tighten it?',
        'Tips for projecting more confidence at the podium'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'Slow down — you\'re speaking too quickly for the bench to absorb the argument.' },
      { tag: 'pacing', text: 'Good pacing overall. Consider a deliberate pause before your central proposition.' },
      { tag: 'pacing', text: 'You\'re rushing through the rebuttal. Take a breath — each point needs to land.' },
      { tag: 'pacing', text: 'Try to vary your tempo. Slowing down on key points signals their importance to the court.' },
      { tag: 'clarity', text: 'Excellent articulation throughout the argument.' },
      { tag: 'clarity', text: 'Some words are being swallowed at the end of sentences — project through to the last syllable.' },
      { tag: 'clarity', text: 'Your argument structure is clear and well-organized.' },
      { tag: 'clarity', text: 'Define your key terms before using them — the bench may not share your shorthand.' },
      { tag: 'volume', text: 'Project more — your volume drops noticeably in the second half of the argument.' },
      { tag: 'volume', text: 'Good vocal projection throughout.' },
      { tag: 'volume', text: 'Vary your volume to emphasize key points. Monotone volume undermines even strong arguments.' },
      { tag: 'volume', text: 'You trail off at the end of sentences. Finish each sentence at full volume.' },
      { tag: 'argument', text: 'Lead with your strongest argument — don\'t save the best for last.' },
      { tag: 'argument', text: 'The rebuttal was concise and well-targeted. Good work staying on the key issue.' },
      { tag: 'argument', text: 'Know your record citations cold — they should come out seamlessly without hesitation.' },
      { tag: 'argument', text: 'Be more direct when answering the court\'s questions before pivoting back to your argument.' },
      { tag: 'argument', text: 'Don\'t concede points you don\'t need to concede. Think carefully before answering hypotheticals.' },
      { tag: 'posture', text: 'Stand tall — confident posture projects authority and credibility.' },
      { tag: 'posture', text: 'Avoid gripping the podium. Keep your hands relaxed, or use open gestures for emphasis.' },
      { tag: 'posture', text: 'Try not to sway or rock — plant your feet and own the space.' },
      { tag: 'eye_contact', text: 'Maintain eye contact with the judges rather than reading from your notes.' },
      { tag: 'eye_contact', text: 'Good panel engagement throughout — you made each judge feel addressed.' },
      { tag: 'eye_contact', text: 'Spread your eye contact across the full panel, not just the presiding judge.' },
      { tag: 'general', text: 'Strong performance overall — well prepared and well delivered.' },
      { tag: 'general', text: 'Review the record more carefully before the next practice round.' },
      { tag: 'general', text: 'Great improvement from your last session. Keep building on this foundation.' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Moot Court Oral Argument Rubric', body: `Knowledge of Record (20 pts): Cites specific record pages, knows facts cold, no hesitation.\nArgument Structure (20 pts): Clear roadmap, logical progression, addresses strongest counter-arguments.\nResponsiveness to Questions (20 pts): Directly answers before pivoting, concedes appropriately, never dodges.\nVocal Delivery (20 pts): Appropriate pace, clear articulation, varied tone, confident projection.\nProfessionalism (20 pts): Composure under pressure, respectful tone, proper court etiquette.` },
      { category: 'guideline', title: 'Court Etiquette & Format', body: `Address the court as "Your Honor" or "The Court." Never interrupt a judge.\nCite the record as "Record at [page number]."\nBegin: "May it please the Court." Reserve rebuttal time at the outset.\nEach side typically has 15 minutes. Appellants may reserve up to 3 minutes for rebuttal.` },
    ]
  },

  // ── Theater ──────────────────────────────────────────────────────────────────
  theater: {
    label: 'Theater',
    icon: '🎭',
    color: '#f472b6',
    coachTitle: 'Theater Coach',
    tagLabels: {
      pacing: 'Timing', clarity: 'Diction', volume: 'Projection',
      posture: 'Blocking', eye_contact: 'Stage Presence', argument: 'Characterization', general: 'General'
    },
    aiPersona: `You are an experienced theater director and acting coach with a background in classical and contemporary performance. Help performers improve vocal technique (projection, diction, resonance, breath support), physical presence (blocking, stillness, gesture), character work (motivation, emotional truth, commitment, subtext), and timing. Reference Stanislavski, Meisner, Laban, or other methodologies where relevant. Be specific — name the moment, describe what you see, offer a concrete exercise or adjustment.`,
    quickPrompts: {
      professor: [
        'Analyze the vocal performance in this session',
        'What moments showed the strongest character commitment?',
        'Where did the scene lose energy and why?',
        'Draft rehearsal notes I can share with the cast',
        'Suggest exercises to address the technical issues you noticed'
      ],
      student: [
        'How was my overall performance?',
        'How can I make my character feel more truthful?',
        'My diction feels forced — how do I fix that?',
        'How do I stay present in a long scene without losing energy?',
        'Tips for handling stage fright before a performance'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'Let the moment breathe — you\'re rushing through before the emotion has registered.' },
      { tag: 'pacing', text: 'Good rhythm in the scene. The pauses are doing real work.' },
      { tag: 'pacing', text: 'The second act feels rushed. Find the beats and honor them.' },
      { tag: 'pacing', text: 'Slow your tempo in the emotional climax — speed undermines the impact.' },
      { tag: 'clarity', text: 'Work on your consonants — they\'re getting lost in the back half of lines.' },
      { tag: 'clarity', text: 'Excellent diction — every word is landing clearly throughout the house.' },
      { tag: 'clarity', text: 'Open your vowels more — the space is large and needs your full resonance.' },
      { tag: 'clarity', text: 'Be careful not to swallow your final words — the button of each line matters.' },
      { tag: 'volume', text: 'Project to the back of the house — your voice is dropping in the second half.' },
      { tag: 'volume', text: 'Excellent projection throughout. Good breath support is showing.' },
      { tag: 'volume', text: 'Use your diaphragm — your projection is coming from your throat, not your center.' },
      { tag: 'volume', text: 'Vary your volume for dramatic effect. The whole scene at the same level feels flat.' },
      { tag: 'argument', text: 'Strong character commitment — you stayed in it even when nothing was happening.' },
      { tag: 'argument', text: 'Find the through-line — what does your character want in every single moment?' },
      { tag: 'argument', text: 'Play the action, not the emotion. What are you doing to the other person?' },
      { tag: 'argument', text: 'The subtext isn\'t coming through. What are you really saying under the words?' },
      { tag: 'argument', text: 'Good use of objectives and obstacles. The tension feels real.' },
      { tag: 'posture', text: 'Own your space — your blocking looks tentative. Commit to where you are.' },
      { tag: 'posture', text: 'Good use of the stage. You\'re giving the audience variety and visual interest.' },
      { tag: 'posture', text: 'Avoid upstaging yourself — open up to the audience more.' },
      { tag: 'posture', text: 'Find stillness in the listening moments. Movement when you shouldn\'t be moving draws focus.' },
      { tag: 'eye_contact', text: 'Your stage presence is strong — you command attention when you\'re still.' },
      { tag: 'eye_contact', text: 'Stay focused — you broke the fourth wall too early and the audience felt it.' },
      { tag: 'eye_contact', text: 'Really listen to your scene partner — the best moments come from genuine response.' },
      { tag: 'general', text: 'Strong work overall. You\'re finding the truth in the scene.' },
      { tag: 'general', text: 'Work on memorization before next rehearsal — going up on lines is breaking the flow.' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Performance Evaluation Rubric', body: `Vocal Technique (25 pts): Projection, diction, breath support, resonance, vocal variety.\nPhysical Presence (25 pts): Blocking, stillness, gesture, use of space, energy.\nCharacter Work (25 pts): Motivation, emotional truth, commitment, subtext, listening.\nTiming & Rhythm (25 pts): Pacing, pauses, picking up cues, scene build.` },
      { category: 'guideline', title: 'Rehearsal Expectations', body: `Lines must be memorized by end of week 2. Scripts are a crutch after that point.\nListen to your scene partners — the best acting happens in response.\nBe on time, warmed up, and ready to work. No phones in rehearsal.\nTake risks — a wrong choice discovered in rehearsal is better than a safe choice on stage.` },
    ]
  },

  // ── Music ────────────────────────────────────────────────────────────────────
  music: {
    label: 'Music',
    icon: '🎵',
    color: '#34d399',
    coachTitle: 'Music Coach',
    tagLabels: {
      pacing: 'Tempo & Rhythm', clarity: 'Intonation', volume: 'Dynamics',
      posture: 'Technique & Posture', eye_contact: 'Expression', argument: 'Musicianship', general: 'General'
    },
    aiPersona: `You are an experienced music teacher and performance coach with expertise across vocal and instrumental performance. Help musicians improve intonation, dynamics, tone quality, rhythm, technical execution, breath support, and musical expression. Balance technical precision with artistic interpretation. Reference specific music theory concepts, practice techniques, and performance strategies. Be specific about where in the performance an issue occurred and offer concrete, actionable exercises.`,
    quickPrompts: {
      professor: [
        'Analyze the performance from a technical standpoint',
        'Where were the intonation challenges and what caused them?',
        'Draft lesson notes I can share with the student',
        'What practice strategies would address the issues in this session?',
        'How is this student\'s musicianship developing overall?'
      ],
      student: [
        'How was my overall performance?',
        'My intonation feels off — what should I practice?',
        'How do I add more expression without overdoing it?',
        'I\'m rushing in fast passages — what exercises help?',
        'How do I build stamina for longer performances?'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'You\'re rushing the sixteenth-note passages — practice with a metronome at 60% tempo.' },
      { tag: 'pacing', text: 'Good rhythmic steadiness throughout. The pulse was reliable and grounding.' },
      { tag: 'pacing', text: 'Slow down in the lyrical sections — give the phrases room to breathe.' },
      { tag: 'pacing', text: 'The accelerando in the development was too abrupt. Build it more gradually.' },
      { tag: 'clarity', text: 'Watch your intonation in the upper register — you\'re consistently sharp.' },
      { tag: 'clarity', text: 'Beautiful intonation throughout, especially in the difficult modulations.' },
      { tag: 'clarity', text: 'Tune your open strings/reference pitches before each passage.' },
      { tag: 'clarity', text: 'The third of the chord is flat — sing it before you play it to internalize the pitch.' },
      { tag: 'volume', text: 'Your pianissimo is too timid — softer doesn\'t mean less supported.' },
      { tag: 'volume', text: 'Excellent dynamic range — the contrast between pp and ff was dramatic and effective.' },
      { tag: 'volume', text: 'The crescendo built too quickly. Plan your dynamic arc across the whole phrase.' },
      { tag: 'volume', text: 'More contrast needed — the piece is calling for a wider dynamic range.' },
      { tag: 'argument', text: 'Strong musicianship — you\'re thinking in phrases, not just notes.' },
      { tag: 'argument', text: 'Find the emotional core of this piece. What is it saying, and why does it matter?' },
      { tag: 'argument', text: 'Your technical execution is solid. Now focus on communicating the character of the music.' },
      { tag: 'argument', text: 'Analyze the harmonic structure — understanding the tension and release will inform your interpretation.' },
      { tag: 'posture', text: 'Check your hand/embouchure position — tension is creeping in and it\'s affecting your tone.' },
      { tag: 'posture', text: 'Good posture and relaxed technique — your tone is free and resonant as a result.' },
      { tag: 'posture', text: 'Tension in your shoulders is restricting your breath support. Do a body scan before you play.' },
      { tag: 'eye_contact', text: 'Your expression is communicating the piece beautifully — the audience can feel it.' },
      { tag: 'eye_contact', text: 'Look up from the music more — connect with the audience.' },
      { tag: 'eye_contact', text: 'The musical character feels inconsistent. Commit to the affect of each section.' },
      { tag: 'general', text: 'Strong practice clearly showing — this is a well-prepared performance.' },
      { tag: 'general', text: 'Record yourself practicing this week and listen back critically.' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Performance Jury Rubric', body: `Tone Quality (20 pts): Resonance, control, consistency across register.\nIntonation (20 pts): Pitch accuracy, ability to adjust, awareness of ensemble tuning.\nTechnique (20 pts): Command of instrument/voice, scales, articulation, facility.\nMusical Expression (20 pts): Phrasing, dynamics, character, communication of style.\nPreparation (20 pts): Memorization, tempo stability, accuracy of notes and rhythms.` },
      { category: 'guideline', title: 'Practice Expectations', body: `Practice in short focused sessions (25–45 min) rather than marathon sessions.\nAlways warm up before technical work.\nUse a metronome for all technical passages until secure.\nRecord yourself weekly and evaluate the recording critically.\nLearn the harmonic structure of every piece you perform.` },
    ]
  },

  // ── Public Speaking ──────────────────────────────────────────────────────────
  public_speaking: {
    label: 'Public Speaking',
    icon: '🎤',
    color: '#38bdf8',
    coachTitle: 'Speaking Coach',
    tagLabels: {
      pacing: 'Pacing', clarity: 'Clarity', volume: 'Vocal Variety',
      posture: 'Body Language', eye_contact: 'Audience Connection', argument: 'Content & Structure', general: 'General'
    },
    aiPersona: `You are an expert public speaking coach and communication consultant. Help speakers improve their structure, vocal variety, body language, audience engagement, use of pauses, storytelling, and overall impact. Reference rhetorical techniques (ethos, pathos, logos), presentation frameworks (STAR, problem-solution-benefit), and evidence-based speaking strategies. Be practical and specific — name what worked, what didn't, and exactly how to fix it.`,
    quickPrompts: {
      professor: [
        'Analyze the vocal delivery in this session',
        'Where did the speaker lose the audience and why?',
        'Draft written feedback I can share with the student',
        'How effective was the overall message structure?',
        'What one thing would most improve this person\'s impact?'
      ],
      student: [
        'How did I do overall?',
        'How can I be less nervous when speaking?',
        'My speech felt disorganized — how do I structure it better?',
        'How do I make better eye contact with a large audience?',
        'Tips for handling unexpected questions from the audience'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'You\'re speaking too fast — the audience can\'t process your points before the next one arrives.' },
      { tag: 'pacing', text: 'Excellent pacing. You used pauses strategically and gave key points room to land.' },
      { tag: 'pacing', text: 'Use the pause as a tool. Silence after a key point amplifies its impact.' },
      { tag: 'pacing', text: 'You rushed the conclusion — the audience needs time to absorb your call to action.' },
      { tag: 'clarity', text: 'Excellent clarity — your message was organized and easy to follow throughout.' },
      { tag: 'clarity', text: 'Signpost your transitions — tell the audience where you\'re going before you go there.' },
      { tag: 'clarity', text: 'Your opening hook is strong but your main point isn\'t clear until too late. Lead with it.' },
      { tag: 'clarity', text: 'Eliminate filler words (um, uh, like, you know) — they erode credibility.' },
      { tag: 'volume', text: 'Vary your pitch and pace — speaking at the same level throughout loses the audience.' },
      { tag: 'volume', text: 'Good vocal variety — you used inflection and volume to keep the content engaging.' },
      { tag: 'volume', text: 'Drop your voice to a near-whisper on the most important point — contrast creates impact.' },
      { tag: 'volume', text: 'Project more — the back of the room needs to hear you without straining.' },
      { tag: 'argument', text: 'Strong structure — clear problem, solution, and call to action.' },
      { tag: 'argument', text: 'Your opening was compelling but the conclusion was weak. Mirror your opening.' },
      { tag: 'argument', text: 'Use more concrete examples and stories — abstractions don\'t stick with audiences.' },
      { tag: 'argument', text: 'The argument is logical but needs more emotional resonance to be truly persuasive.' },
      { tag: 'posture', text: 'Stand grounded — feet shoulder-width apart, weight even. Nervous energy becomes power.' },
      { tag: 'posture', text: 'Good use of gestures — they were natural and reinforced your words.' },
      { tag: 'posture', text: 'Avoid crossing your arms or touching your face — these read as defensive or uncertain.' },
      { tag: 'eye_contact', text: 'Excellent audience connection — you made individuals in the room feel seen.' },
      { tag: 'eye_contact', text: 'Read from your notes less — you lose the audience\'s trust every time you look down.' },
      { tag: 'eye_contact', text: 'Scan the whole room — don\'t only address one section of the audience.' },
      { tag: 'general', text: 'Strong overall delivery — confident, clear, and well-prepared.' },
      { tag: 'general', text: 'Practice this speech once more in front of a mirror or record yourself.' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Public Speaking Evaluation Rubric', body: `Content & Structure (25 pts): Clear thesis, logical organization, supporting evidence, memorable conclusion.\nVocal Delivery (25 pts): Volume, variety, pace, clarity, absence of filler words.\nBody Language (25 pts): Eye contact, posture, gestures, movement, presence.\nAudience Engagement (25 pts): Rapport, responsiveness, storytelling, connection.` },
      { category: 'guideline', title: 'Speech Preparation Checklist', body: `Know your opening line cold — nerves are highest at the start.\nPrepare for 3 likely audience questions before you speak.\nPractice out loud at least 5 times — not in your head, out loud.\nRecord a practice run and watch it back critically.\nArrive early to walk the space and check the setup.` },
    ]
  },

  // ── Debate ───────────────────────────────────────────────────────────────────
  debate: {
    label: 'Debate',
    icon: '🗣️',
    color: '#fbbf24',
    coachTitle: 'Debate Coach',
    tagLabels: {
      pacing: 'Pacing', clarity: 'Clarity & Impact', volume: 'Vocal Delivery',
      posture: 'Presence', eye_contact: 'Engagement', argument: 'Argumentation', general: 'General'
    },
    aiPersona: `You are an experienced competitive debate coach with expertise in policy, LD, parliamentary, and public forum formats. Help debaters sharpen argumentation, evidence use, rebuttal strategy, cross-examination technique, and delivery. Reference debate theory (Toulmin model, flow concepts, impact calculus, extinction impacts) where relevant. Be direct and analytical — debate coaches don't soften criticism, they build winners.`,
    quickPrompts: {
      professor: [
        'Analyze the round performance',
        'How effective was the case construction?',
        'Where did they lose the argument and why?',
        'What are the top 3 things to drill before the tournament?',
        'Draft round feedback I can share with the team'
      ],
      student: [
        'How did I do in this round?',
        'How do I handle a case I haven\'t prepared for?',
        'My cross-ex felt weak — how do I make it sharper?',
        'I keep dropping arguments — how do I manage the flow better?',
        'Tips for staying calm when the other team is aggressive'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'You\'re spreading — slow down enough that the judge can flow your arguments.' },
      { tag: 'pacing', text: 'Good rate for the format. You fit all your arguments and were still comprehensible.' },
      { tag: 'pacing', text: 'Slow down on your impacts — the judge needs to hear and feel the weight of your best arguments.' },
      { tag: 'pacing', text: 'Your cross-ex pace is good but rebuttal is too fast. Prioritize clarity over quantity.' },
      { tag: 'clarity', text: 'Your impacts aren\'t extended — tell me why winning this argument matters to the round.' },
      { tag: 'clarity', text: 'Strong impact calculus. You explained probability, magnitude, and timeframe clearly.' },
      { tag: 'clarity', text: 'Label your arguments clearly — the judge needs to know what they\'re flowing.' },
      { tag: 'clarity', text: 'More signposting needed. Say "off their first contention" before you respond to it.' },
      { tag: 'volume', text: 'Project more — the judge at the back of the room needs to hear your arguments.' },
      { tag: 'volume', text: 'Good vocal confidence — you sound like you believe your arguments.' },
      { tag: 'volume', text: 'Slow down and lower your pitch for your most important arguments. Emphasis matters.' },
      { tag: 'argument', text: 'Your evidence is good but you\'re not explaining why it proves your claim. Bridge the gap.' },
      { tag: 'argument', text: 'Strong rebuttal — you engaged directly with their best argument and turned it.' },
      { tag: 'argument', text: 'You dropped their second contention. Even a quick "no impact here" keeps the flow clean.' },
      { tag: 'argument', text: 'Your case construction is solid but you\'re not winning the framework debate.' },
      { tag: 'argument', text: 'More time on the line-by-line, less on new development in your summary/final focus.' },
      { tag: 'posture', text: 'Stand confidently — you look uncertain and it\'s affecting your credibility with the judge.' },
      { tag: 'posture', text: 'Good presence — you commanded the room and the judge noticed.' },
      { tag: 'eye_contact', text: 'Address the judge, not your opponent — you\'re trying to persuade the judge, not win a fight.' },
      { tag: 'eye_contact', text: 'Good judge engagement — you read the room and adjusted when needed.' },
      { tag: 'eye_contact', text: 'During cross-ex, stay focused and don\'t look at your flow when answering.' },
      { tag: 'general', text: 'Strong round overall — good preparation is showing.' },
      { tag: 'general', text: 'Flow practice needed — you\'re losing track of where arguments are in the round.' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Round Evaluation Criteria', body: `Argumentation (30 pts): Case construction, evidence quality, logical structure, impact calculus.\nRebuttal (30 pts): Engagement with opposing case, extensions, dropped argument tracking.\nCross-Examination (20 pts): Strategic questioning, composure, use of admissions.\nDelivery (20 pts): Clarity, speed control, judge engagement, confidence.` },
      { category: 'guideline', title: 'Round Strategy', body: `Go for 2–3 winning arguments in summary, not 10 mediocre ones.\nExtend your best offense and their best dropped argument every speech.\nCross-ex admissions must make it back into speeches to matter.\nAlways weigh and compare — don\'t assume the judge knows who wins.` },
    ]
  },

  // ── Teaching ─────────────────────────────────────────────────────────────────
  teaching: {
    label: 'Teaching',
    icon: '📖',
    color: '#fb923c',
    coachTitle: 'Instructional Coach',
    tagLabels: {
      pacing: 'Pacing', clarity: 'Explanation', volume: 'Voice & Projection',
      posture: 'Presence', eye_contact: 'Student Engagement', argument: 'Pedagogy', general: 'General'
    },
    aiPersona: `You are an experienced instructional coach and educational consultant with expertise in K-12 and higher education pedagogy. Help educators improve the clarity of their explanations, questioning techniques, student engagement, pacing, differentiation, and learning objective alignment. Reference evidence-based teaching practices (Bloom's taxonomy, formative assessment, cold calling, think-pair-share, Socratic questioning). Be constructive and specific — describe what you observed, what impact it had on learning, and exactly how to adjust.`,
    quickPrompts: {
      professor: [
        'Analyze the instructional delivery in this session',
        'How effective were the questioning techniques?',
        'Draft observation notes I can share with the teacher',
        'What evidence of student learning did you observe?',
        'What\'s the highest-leverage change to make for next lesson?'
      ],
      student: [
        'How was my overall lesson delivery?',
        'How do I explain this concept more clearly?',
        'My students seem disengaged — what can I do?',
        'How do I manage the pacing better?',
        'Tips for handling students who don\'t participate'
      ]
    },
    defaultTemplates: [
      { tag: 'pacing', text: 'You moved on before students had time to process — check for understanding more frequently.' },
      { tag: 'pacing', text: 'Good pacing — you read the room and adjusted when students showed confusion.' },
      { tag: 'pacing', text: 'The explanation was rushed. Break it into smaller steps and check comprehension at each one.' },
      { tag: 'pacing', text: 'Excellent wait time after questions — that silence is productive thinking time.' },
      { tag: 'clarity', text: 'The explanation was clear and logically sequenced. Students could follow every step.' },
      { tag: 'clarity', text: 'Break this concept into smaller, discrete steps. You\'re jumping ahead too quickly.' },
      { tag: 'clarity', text: 'Use a concrete analogy or example — the abstract explanation alone isn\'t sticking.' },
      { tag: 'clarity', text: 'Check your language — some of the vocabulary is above where the students are right now.' },
      { tag: 'volume', text: 'Project more — students at the back are straining to hear.' },
      { tag: 'volume', text: 'Good vocal variety — you used tone and pace to signal importance and maintain attention.' },
      { tag: 'volume', text: 'Lower your volume when the room is settled — it actually increases attention.' },
      { tag: 'argument', text: 'Strong questioning — you pushed students to think, not just recall.' },
      { tag: 'argument', text: 'Use more open-ended questions. "What do you notice?" opens richer thinking than "What is X?"' },
      { tag: 'argument', text: 'Good use of student responses to build the lesson. You honored what they brought.' },
      { tag: 'argument', text: 'Your lesson objective wasn\'t clear to students. State it explicitly at the start.' },
      { tag: 'argument', text: 'Cold-call more broadly — the same 3 students are driving all the discussion.' },
      { tag: 'posture', text: 'Good classroom presence — you commanded attention without being intimidating.' },
      { tag: 'posture', text: 'Move around the room more — proximity management keeps students focused.' },
      { tag: 'posture', text: 'Avoid staying behind the desk — get among the students.' },
      { tag: 'eye_contact', text: 'Excellent student engagement — you read the room and responded to individual needs.' },
      { tag: 'eye_contact', text: 'Make eye contact with all students, not just those who volunteer.' },
      { tag: 'eye_contact', text: 'Watch for students who are disengaged — they\'re telling you something about the lesson.' },
      { tag: 'general', text: 'Strong lesson overall — clear purpose, good engagement, solid content knowledge.' },
      { tag: 'general', text: 'Reflect on your exit data — did students actually learn the objective today?' },
    ],
    defaultKnowledge: [
      { category: 'rubric', title: 'Instructional Observation Rubric', body: `Learning Objectives (20 pts): Clear, measurable, communicated to students, aligned to assessment.\nInstruction & Explanation (30 pts): Clarity, scaffolding, use of examples, checks for understanding.\nStudent Engagement (25 pts): Active participation, questioning quality, responsiveness to confusion.\nClassroom Climate (25 pts): Rapport, management, inclusivity, pacing.` },
      { category: 'guideline', title: 'Evidence-Based Practices to Look For', body: `Cold calling (equitable distribution of questioning)\nThink-pair-share and other active learning structures\nFormative checks (exit tickets, thumbs, whiteboards, pair reads)\nBloom's taxonomy — are questions at analysis/evaluation level?\nWait time of at least 3-5 seconds after posing a question` },
    ]
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'mm_domain'

export function useDomain() {
  const [domain, setDomainState] = useState<Domain>(
    () => (localStorage.getItem(STORAGE_KEY) as Domain) ?? 'law'
  )

  const setDomain = useCallback((d: Domain) => {
    setDomainState(d)
    localStorage.setItem(STORAGE_KEY, d)
  }, [])

  return { domain, setDomain, config: DOMAIN_CONFIG[domain] }
}
