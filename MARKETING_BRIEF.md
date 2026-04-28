# Multimedia Mentor by LexCommons — Complete Product Brief
*Version 1.1.9 · macOS Desktop App (Electron) · For use in marketing copy, tutorials, and promotional materials*

---

## What It Is

**Multimedia Mentor by LexCommons** is a macOS desktop application that helps professors and instructors give richer, faster feedback on student oral performance. It combines real-time audio/video analysis, AI coaching, and a simulated practice environment in one tool — no internet required for the core analysis features.

It is built for disciplines where oral delivery matters: law, theater, music, public speaking, debate, and teaching. A professor can import a student's recorded video, analyze it with pitch and volume graphs, annotate directly on the video, write timestamped feedback, run an AI coaching session, and export a formatted PDF report — all in one workflow.

---

## Target Users

**Primary: Professors and instructors** in:
- Law schools (oral advocacy, moot court, clinical programs)
- Conservatories and music programs (jury exams, applied lessons, recitals)
- Theater and drama programs (acting, directing, voice and speech)
- Communication and public speaking programs
- Debate programs (policy, LD, public forum, parliamentary)
- Education programs (teacher training, instructional coaching)

**Secondary: Students** using the Live Practice feature independently to rehearse before class evaluations, competitions, or performances.

---

## The Six Disciplines (Domains)

The app adapts its language, rubrics, AI persona, feedback templates, and practice characters to the active domain. Professors switch domains in one click.

### 1. Law & Court
- **Coaching persona**: Experienced oral advocacy coach and former appellate attorney
- **Focus areas**: Pacing, Clarity, Volume, Posture, Eye Contact, Argument structure
- **Practice characters**: Trial Judge, Jury (12 named jurors), Appellate Panel (3 judges), Supreme Court (9 justices)
- **Default rubric**: Moot court scoring — Record Knowledge, Argument Structure, Responsiveness, Vocal Delivery, Professionalism (20 pts each)

### 2. Theater
- **Coaching persona**: Theater director and acting coach (Stanislavski, Meisner, Laban references)
- **Focus areas**: Timing, Diction, Projection, Blocking, Stage Presence, Characterization
- **Practice characters**: Faculty Performance Jury (3 professors: Acting, Voice & Speech, Directing)
- **Default rubric**: Vocal Technique, Physical Presence, Character Work, Timing & Rhythm (25 pts each)

### 3. Music
- **Coaching persona**: Music teacher and performance coach for vocal and instrumental performance
- **Focus areas**: Tempo & Rhythm, Intonation, Dynamics, Technique & Posture, Expression, Musicianship
- **Practice characters**: Faculty Jury (3 professors: Technique, Musicality & Interpretation, Performance Practice)
- **Default rubric**: Tone Quality, Intonation, Technique, Musical Expression, Preparation (20 pts each)

### 4. Public Speaking
- **Coaching persona**: Expert public speaking coach and communication consultant
- **Focus areas**: Pacing, Clarity, Vocal Variety, Body Language, Audience Connection, Content & Structure
- **Practice characters**: Evaluator Panel (3 evaluators: Corporate Trainer, Academic Rhetoric, Toastmasters Judge)
- **Default rubric**: Content & Structure, Vocal Delivery, Body Language, Audience Engagement (25 pts each)

### 5. Debate
- **Coaching persona**: Competitive debate coach (policy, LD, parliamentary, public forum)
- **Focus areas**: Pacing, Clarity & Impact, Vocal Delivery, Presence, Engagement, Argumentation
- **Practice characters**: Opposing Debater (Jordan Park — a skilled competitive opponent)
- **Default rubric**: Argumentation, Rebuttal, Cross-Examination, Delivery

### 6. Teaching
- **Coaching persona**: Instructional coach (Bloom's taxonomy, formative assessment, Socratic questioning)
- **Focus areas**: Pacing, Explanation, Voice & Projection, Presence, Student Engagement, Pedagogy
- **Practice characters**: Classroom of 20 Students (7 named students: Alex, Jordan, Sam, Morgan, Casey, Tyler, Priya — mixed engagement and ability)
- **Default rubric**: Learning Objectives, Instruction & Explanation, Student Engagement, Classroom Climate

---

## Core Features

### Real-Time Audio Analysis
- **Pitch graph**: Scrolling real-time plot of fundamental frequency (Hz), color-coded by range. Works with microphone, uploaded video/audio, or BlackHole system audio capture.
- **Note name + tuner**: Displays the detected musical note name and octave (e.g. "A4") with cents deviation from equal temperament — green ≤5¢, amber ≤15¢, red >15¢. Useful for singers and instrumentalists.
- **Piano keyboard**: Highlights the currently detected pitch on a visual piano keyboard.
- **Decibel/volume graph**: Real-time volume level in dBFS with scrolling history. Separate from pitch — shows dynamics, not just pitch.

### Body Movement Tracker
- Uses TensorFlow.js pose detection (MoveNet) to track the student's skeletal movement via webcam or uploaded video.
- Displays a skeleton overlay and scores movement in real time.
- Runs locally — no cloud processing.

### Video Tools
- **Import**: MP4, MOV, WebM, MKV, MP3, WAV, M4A
- **Webcam live session**: Start a live webcam + microphone session for real-time analysis and recording
- **Screen recording**: Record any application window on the Mac (student's Zoom call, presentation, etc.)
- **Video annotation**: Draw directly on the video frame. Tools: rectangle, circle, arrow, text. Full color palette. Annotations are timestamped and tied to video time.
- **Playback**: Scrub through uploaded video while pitch and volume graphs sync to playback position.
- **Resizable video area**: Drag handle between video and graphs to adjust layout.

### Sidebar Panels (6 tabs)

#### Feedback Tab
- Timestamped written comments, each tagged by category (Pacing, Clarity, Volume, Posture, Eye Contact, Argument/Characterization/Musicianship, General)
- Tag labels adapt to the active domain (e.g. "Pacing" becomes "Timing" in Theater, "Tempo & Rhythm" in Music)
- Author field (professor's name)
- One-click comment templates — a library of pre-written feedback phrases that professors can customize
- Edit and delete individual comments

#### Notes Tab
- Video annotation management — view, edit, and delete all drawn annotations with timestamps

#### AI Tab (AI Feedback)
- Sends the session data (pitch graphs, decibel graphs, feedback comments, video frame) to Claude or GPT
- Professor can ask questions or request generated feedback drafts
- AI has access to the professor's uploaded rubrics, course guidelines, and knowledge base
- Supports Claude (claude-opus-4, claude-sonnet-4) and GPT-4o, GPT-4-turbo
- Quick-prompt buttons adapt per domain (e.g. "How would this performance fare before a real appellate bench?" for Law; "Where did the scene lose energy and why?" for Theater)

#### Practice Tab (Live Practice)
- Choose a practice character (domain-specific simulated audience, panel, or opponent)
- AI responds in character in real time — student speaks, AI responds as the judge/jury/professor
- Voice input via Whisper (local speech-to-text, ~40MB model, runs entirely on-device)
- Text input mode for instrumentalists and users without microphones
- Live coach mode: AI analyzes each exchange and interjects brief, actionable coaching notes when it detects specific issues (rushing, weak structure, filler words, missed opportunities)
- WPM tracker: calculates words per minute from Whisper transcript duration
- Filler word counter: detects "um," "uh," "like," "you know," "basically," etc. — shows running count and breakdown
- Session stats bar: average WPM and top filler words shown live during session
- Side-by-side webcam preview (resizable)
- Save session transcript as HTML

#### Camera Tab
- Configure microphone and speaker/output device
- Select camera device for webcam sessions
- Permission status display
- BlackHole system audio capture setup (records Mac system audio)

#### Report Tab
- Full session summary: video info, duration, pitch/volume data, all feedback comments, all annotations, AI coaching conversation
- Export formats: PDF, DOCX, Markdown, plain text, JSON, CSV
- "Save Session" — packages everything (PDF report + video recording + session data) into a ZIP

### Metronome
- Compact, always-visible above the sidebar tabs
- BPM: 20–400, tap-tempo button
- Time signature: independent numerator (1–64 beats) and denominator (2, 4, 8, 16, 32 note values)
- Beat indicator: dot display for ≤20 beats, numeric counter for larger time signatures
- Mute button (sound off but visual beat continues)
- Web Audio API look-ahead scheduler for precise, jitter-free timing
- Persists BPM and time signature between sessions

### Countdown Timer
- Compact, always-visible above the sidebar tabs
- Presets for debate and speech formats: 1:00 through 30:00, plus specific labels (CX/Q&A 3:00, LD 1AR 4:00, Rebuttal 5:00, LD AC 6:00, LD NC 7:00, Policy 8:00)
- Custom MM:SS input
- Audible warning beep at 30 seconds, triple beep at time
- Pause/Resume/Reset

### Knowledge Base
- Professor uploads rubrics, grading criteria, course guidelines, or notes as PDF, DOCX, or typed text
- AI automatically references uploaded materials in its feedback and coaching
- Items can be tagged to specific practice characters/judges (e.g., a rubric only for the appellate panel judge)
- Items persist across sessions; editable and deletable

### Voice Synthesis (TTS)
- **ElevenLabs** (cloud): 6 free voices — Rachel (F), Adam (M), Antoni (M), Josh (M), Arnold (M), Sam (M). Requires API key.
- **Kokoro** (local): 7 voices — af_heart, af_bella, af_nicole, am_adam, am_michael, bf_emma, bm_george. ~82MB model downloads once on first use, then runs entirely offline.
- **Browser fallback**: Uses macOS system voices if neither above is configured.
- **Per-speaker assignment**: Each named individual in a multi-speaker character has their own voice dropdown. For example, the 3-judge appellate panel has Judge Chen, Judge Williams, and Judge Patel each with independently assigned voices. SCOTUS has all 9 justices individually assigned.

---

## Practice Characters (Complete List)

### Law & Court
| Character | Type | Named Speakers |
|---|---|---|
| Trial Judge | Single | Judge Patricia Hayes |
| Jury | Multi | Juror 1 Rita (foreperson), Juror 3 Derek, Juror 5 Sandra, Juror 7 Alan, Juror 9 Yara, Juror 11 Frank |
| Appellate Panel (3 Judges) | Multi | Judge Chen (Chief), Judge Williams, Judge Patel |
| Supreme Court (9 Justices) | Multi | Chief Justice Roberts, Thomas, Alito, Sotomayor, Kagan, Gorsuch, Kavanaugh, Barrett, Jackson |

**Bench temperature** (Appellate Panel + SCOTUS only): Cold (polite, minimal questions) / Warm (occasional questions) / Hot (frequent interruptions, rapid hypotheticals, pile-ons)

### Theater
| Character | Type | Named Speakers |
|---|---|---|
| Faculty Performance Jury | Multi | Professor Voss (Acting), Professor Reed (Voice & Speech), Professor Shaw (Directing) |

### Music
| Character | Type | Named Speakers |
|---|---|---|
| Faculty Jury | Multi | Professor Okafor (Technique), Professor Tanaka (Musicality), Professor Vasquez (Performance Practice) |

### Public Speaking
| Character | Type | Named Speakers |
|---|---|---|
| Evaluator Panel | Multi | Evaluator Monroe (Corporate), Evaluator Torres (Academic), Evaluator Kim (Toastmasters) |

### Debate
| Character | Type | Named Speakers |
|---|---|---|
| Opposing Debater | Single | Jordan Park |

### Teaching
| Character | Type | Named Speakers |
|---|---|---|
| Classroom of Students | Multi | Alex, Jordan, Sam, Morgan, Casey, Tyler, Priya |

---

## Technical Notes (for accuracy in copy)
- **Platform**: macOS only (Apple Silicon / arm64). Windows/Linux planned.
- **AI providers**: Anthropic Claude (claude-opus-4-7, claude-sonnet-4-6) and OpenAI GPT (gpt-4o, gpt-4-turbo). Professor enters their own API key — the app does not charge for AI usage.
- **Speech-to-text**: OpenAI Whisper, runs 100% locally via @huggingface/transformers. No audio is sent to the cloud.
- **Pose detection**: TensorFlow.js MoveNet, runs 100% locally.
- **Kokoro TTS**: Runs 100% locally after one-time ~82MB model download.
- **Privacy**: No telemetry. No audio, video, or student data is stored or transmitted except when the professor explicitly uses the AI features (which go to Anthropic or OpenAI via the professor's own API key).
- **Built with**: Electron, React, TypeScript, Vite, Web Audio API.

---

## Key Differentiators (for marketing angles)
1. **Multi-discipline in one tool** — not just for law or just for music. One professor can use it across law clinic, moot court, and a public speaking elective.
2. **Runs offline** — pitch analysis, body tracking, speech transcription, and local TTS all work without internet. Only the AI feedback/practice features need a connection.
3. **Professor-controlled AI** — uses the professor's own API key. No subscription, no student data on third-party servers, no lock-in.
4. **Per-named-speaker voice assignment** — SCOTUS practice sounds like 9 different voices, not one. The appellate panel sounds like 3 different judges. Built for immersive, realistic practice.
5. **Live coach mode** — not just post-session feedback. The AI watches the session in real time and interjects only when there's something specific to fix.
6. **Built by a law professor** — designed from real moot court coaching experience, not generic ed-tech assumptions.

---

## Suggested Tutorial Sequence

1. **Getting started** — import a video, see the pitch and volume graphs, understand what you're looking at
2. **Writing feedback** — timestamped comments, tag categories, using templates
3. **Annotating video** — drawing tools, what annotations look like in the export
4. **AI feedback** — connecting an API key, asking the AI to draft written feedback
5. **Live Practice** — choosing a character, starting a session, voice modes, what the coach does
6. **Exporting a report** — PDF vs DOCX, what's included, sharing with students
7. **Metronome & Timer** — using debate/music presets, tap tempo, bench temperature
8. **Knowledge base** — uploading a rubric, how the AI uses it, per-judge assignment
9. **Domain switching** — how the tool adapts for law vs music vs theater vs debate
10. **Webcam + screen recording** — live session vs importing a recorded video
