import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Domain } from '../hooks/useDomain'
import { DOMAIN_CONFIG } from '../hooks/useDomain'
import { PRACTICE_CHARACTERS, type PracticeCharacter } from '../config/practiceCharacters'
import { useLivePractice } from '../hooks/useLivePractice'
import { useWhisperTranscription } from '../hooks/useWhisperTranscription'
import { useAIKnowledgeBase } from '../hooks/useAIKnowledgeBase'
import { streamCompletion, type AIProvider } from '../utils/aiClient'

interface Props {
  apiKey: string
  provider: AIProvider
  domain: Domain
}

// ─── TTS helper ───────────────────────────────────────────────────────────────

function speak(text: string) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  utterance.pitch = 1.0
  window.speechSynthesis.speak(utterance)
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LivePracticePanel({ apiKey, provider, domain }: Props) {
  const characters = PRACTICE_CHARACTERS[domain]
  const [character, setCharacter] = useState<PracticeCharacter>(characters[0])
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [input, setInput] = useState('')

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)

  // Conversation
  const practice = useLivePractice(apiKey, provider)
  const speech = useWhisperTranscription()
  const kb = useAIKnowledgeBase(domain)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Bench temperature (appellate / SCOTUS only)
  const [benchTemp, setBenchTemp] = useState<'cold' | 'warm' | 'hot'>('hot')

  // Coach
  const [coachEnabled, setCoachEnabled] = useState(false)
  const [coachNote, setCoachNote] = useState<string | null>(null)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [isCoachAnalyzing, setIsCoachAnalyzing] = useState(false)
  const coachAbortRef = useRef<AbortController | null>(null)

  // Refs for always-fresh values inside effects/callbacks — avoids stale closure bugs
  const characterRef = useRef(character)
  const kbRef = useRef(kb)
  const practiceRef = useRef(practice)
  useEffect(() => { characterRef.current = character }, [character])
  useEffect(() => { kbRef.current = kb }, [kb])
  useEffect(() => { practiceRef.current = practice })

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [practice.messages, practice.streamingText])

  // Sync speech live transcript into input while listening
  useEffect(() => {
    if (speech.isListening) setInput(speech.liveTranscript)
  }, [speech.liveTranscript, speech.isListening])

  // Auto-send when speech recognition stops — reads fresh values via refs, no stale closures
  const wasListeningRef = useRef(false)
  useEffect(() => {
    if (speech.isListening) {
      wasListeningRef.current = true
    } else if (wasListeningRef.current) {
      wasListeningRef.current = false
      const text = speech.getTranscript()
      if (text && !practiceRef.current.isResponding) {
        setInput('')
        // Build effective character with bench temp injected
        const ch = characterRef.current
        const hasBench = ch.id === 'appellate_panel' || ch.id === 'supreme_court'
        const benchInstruction = hasBench
          ? (benchTemp === 'cold'
              ? '\n\nBench temperature: COLD. Let counsel develop their full argument before asking questions. One brief, polite question per turn. Do not interrupt mid-sentence.'
              : benchTemp === 'warm'
              ? '\n\nBench temperature: WARM. Ask focused questions but let counsel finish their point first. One or two questions per turn.'
              : '\n\nBench temperature: HOT. Interrupt often. Ask rapid hypotheticals. Multiple judges pile on. Press hard on every weak point.')
          : ''
        const eff = hasBench ? { ...ch, systemPrompt: ch.systemPrompt + benchInstruction } : ch
        practiceRef.current.sendTurn(text, eff, kbRef.current.toPromptBlock())
      }
    }
  }, [speech.isListening]) // eslint-disable-line react-hooks/exhaustive-deps

  // When domain changes, update character and reload domain-scoped knowledge base
  useEffect(() => {
    setCharacter(PRACTICE_CHARACTERS[domain][0])
    kb.loadDomain(domain)
  }, [domain]) // eslint-disable-line react-hooks/exhaustive-deps

  // TTS: speak each completed character response
  const prevMsgCount = useRef(0)
  useEffect(() => {
    if (!ttsEnabled) return
    if (practice.messages.length > prevMsgCount.current) {
      const latest = practice.messages[practice.messages.length - 1]
      if (latest.speaker === 'character') speak(latest.text)
    }
    prevMsgCount.current = practice.messages.length
  }, [practice.messages, ttsEnabled])

  // Wire stream to video element after React re-renders the <video> into the DOM
  useEffect(() => {
    if (!videoRef.current) return
    if (cameraStream) {
      videoRef.current.srcObject = cameraStream
      videoRef.current.play().catch(() => {})
    } else {
      videoRef.current.srcObject = null
    }
  }, [cameraStream])

  // Camera management
  async function toggleCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        setCameraError(null)
        setCameraStream(stream)
      } catch {
        setCameraError('Camera access denied')
      }
    }
  }

  // Stop camera on unmount or session end
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach(t => t.stop())
      window.speechSynthesis?.cancel()
    }
  }, [cameraStream])

  // Capture a single frame from the live webcam
  function captureWebcamFrame(): string | null {
    const video = videoRef.current
    if (!video || !cameraStream) return null
    const W = 480
    const H = Math.round(W * ((video.videoHeight || 270) / (video.videoWidth || 480)))
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, W, H)
    return canvas.toDataURL('image/jpeg', 0.72)
  }

  // Run coach analysis after a completed exchange
  async function runCoachAnalysis(studentText: string, characterText: string) {
    if (!apiKey.trim()) return
    coachAbortRef.current?.abort()
    const controller = new AbortController()
    coachAbortRef.current = controller
    setIsCoachAnalyzing(true)

    setCoachError(null)
    try {
      const cfg = DOMAIN_CONFIG[domain]
      const frame = captureWebcamFrame()

      const coachPrompt = `You are a live ${cfg.coachTitle} watching a student practice session.

Student just said: "${studentText}"
${characterText ? `The practice partner responded: "${characterText.slice(0, 300)}"` : ''}

Your job: decide if the student needs an immediate coaching pause.

Interrupt ONLY for specific, fixable issues: rushing through key points, unclear argument structure, excessive filler words, weak opening/closing, or a missed opportunity clearly visible in this turn.

Do NOT interrupt to be encouraging or for minor issues.

If coaching is needed, respond with 1–2 sentences of direct, actionable coaching starting with what to fix.
If no coaching is needed, respond with exactly: NO_INTERRUPT`

      const msgContent = frame
        ? [
            { type: 'image' as const, mediaType: 'image/jpeg' as const, base64: frame.replace(/^data:image\/jpeg;base64,/, '') },
            { type: 'text' as const, text: coachPrompt }
          ]
        : coachPrompt

      let coachText = ''
      await streamCompletion(provider, apiKey, {
        system: 'You are a brief, direct coaching assistant. Respond in 1-2 sentences maximum or exactly NO_INTERRUPT.',
        messages: [{ role: 'user', content: msgContent }],
        maxTokens: 120,
        signal: controller.signal,
        fast: true,
        onToken: tok => { coachText += tok }
      })

      const trimmed = coachText.trim()
      if (trimmed && trimmed !== 'NO_INTERRUPT') setCoachNote(trimmed)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      const msg = e instanceof Error ? e.message : String(e)
      setCoachError(`Coach unavailable: ${msg}`)
    } finally {
      setIsCoachAnalyzing(false)
    }
  }

  // Trigger coach after each completed exchange
  const prevIsResponding = useRef(false)
  useEffect(() => {
    if (prevIsResponding.current && !practice.isResponding && coachEnabled && practice.sessionActive) {
      const msgs = practice.messages
      const lastChar = [...msgs].reverse().find(m => m.speaker === 'character')
      const lastStudent = [...msgs].reverse().find(m => m.speaker === 'student')
      if (lastChar && lastStudent) {
        runCoachAnalysis(lastStudent.text, lastChar.text)
      }
    }
    prevIsResponding.current = practice.isResponding
  }, [practice.isResponding]) // eslint-disable-line react-hooks/exhaustive-deps

  // Returns the character with bench temperature injected for appellate/SCOTUS
  function effectiveCharacter(): PracticeCharacter {
    const hasBench = character.id === 'appellate_panel' || character.id === 'supreme_court'
    if (!hasBench) return character
    const instruction =
      benchTemp === 'cold'
        ? '\n\nBench temperature: COLD. Let counsel develop their full argument before asking questions. One brief, polite question per turn. Do not interrupt mid-sentence.'
        : benchTemp === 'warm'
        ? '\n\nBench temperature: WARM. Ask focused questions but let counsel finish their point first. One or two questions per turn.'
        : '\n\nBench temperature: HOT. Interrupt often. Ask rapid hypotheticals. Multiple judges pile on. Press hard on every weak point.'
    return { ...character, systemPrompt: character.systemPrompt + instruction }
  }

  // Save session transcript as HTML
  async function handleSave() {
    if (practice.messages.length === 0) return
    const cfg = DOMAIN_CONFIG[domain]
    const rows = practice.messages.map(m => {
      const isStudent = m.speaker === 'student'
      const label = isStudent ? 'You' : character.label
      const bg = isStudent ? '#eff6ff' : '#f8fafc'
      const border = isStudent ? '#bfdbfe' : '#e2e8f0'
      const timeStr = new Date(m.timestamp).toLocaleTimeString()
      const escaped = m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
      return `<div style="margin-bottom:12px;padding:10px 14px;background:${bg};border:1px solid ${border};border-radius:8px;">
  <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${label} &mdash; ${timeStr}</div>
  <div style="font-size:13px;color:#0f172a;line-height:1.6;">${escaped}</div>
</div>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Practice Session &mdash; ${cfg.label}</title>
<style>
  body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 24px; color: #0f172a; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 12px; margin-bottom: 28px; }
  h2 { font-size: 14px; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin: 24px 0 10px; }
</style>
</head><body>
<h1>${cfg.icon} Practice Session &mdash; ${cfg.label}</h1>
<div class="meta">${character.label} &middot; ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</div>
<h2>Transcript</h2>
${rows}
</body></html>`

    await window.api.saveReport(html)
  }

  // Start session — kick off model preload so it's warm when user first speaks
  function handleStart() {
    practice.startSession(effectiveCharacter())
    speech.preload()
  }

  // End session
  function handleEnd() {
    practice.endSession()
    speech.abort()
    window.speechSynthesis?.cancel()
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    coachAbortRef.current?.abort()
    setCoachNote(null)
    setIsCoachAnalyzing(false)
  }

  // Primary speech button — tap to start, tap again to stop (auto-send handled by useEffect above)
  function handleSpeakButton() {
    if (speech.isListening) {
      speech.stop()
    } else {
      setInput('')
      speech.start()
    }
  }

  // Manual send for typed text
  const handleSend = useCallback(() => {
    const text = input.trim()
    if (!text || practiceRef.current.isResponding) return
    speech.abort()
    setInput('')
    const ch = characterRef.current
    const hasBench = ch.id === 'appellate_panel' || ch.id === 'supreme_court'
    const benchInstruction = hasBench
      ? (benchTemp === 'cold'
          ? '\n\nBench temperature: COLD. Let counsel develop their full argument before asking questions. One brief, polite question per turn. Do not interrupt mid-sentence.'
          : benchTemp === 'warm'
          ? '\n\nBench temperature: WARM. Ask focused questions but let counsel finish their point first. One or two questions per turn.'
          : '\n\nBench temperature: HOT. Interrupt often. Ask rapid hypotheticals. Multiple judges pile on. Press hard on every weak point.')
      : ''
    const eff = hasBench ? { ...ch, systemPrompt: ch.systemPrompt + benchInstruction } : ch
    practiceRef.current.sendTurn(text, eff, kbRef.current.toPromptBlock())
  }, [input, speech, benchTemp]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const noApiKey = !apiKey.trim()

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.panel}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={s.header}>
        <span style={s.title}>Live Practice</span>
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            onClick={() => { setCoachEnabled(v => !v); setCoachNote(null) }}
            title={coachEnabled ? 'Live coach on — click to disable' : 'Live coach off — click to enable'}
            style={hdrBtn(coachEnabled)}
          >
            {isCoachAnalyzing ? '🔍' : '🎓'} Coach
          </button>
          <button
            onClick={() => setTtsEnabled(v => !v)}
            title={ttsEnabled ? 'Voice on — click to mute' : 'Voice off — click to enable'}
            style={hdrBtn(ttsEnabled)}
          >
            {ttsEnabled ? '🔊' : '🔇'}
          </button>
          {practice.sessionActive && (
            <button onClick={handleEnd} style={{ ...hdrBtn(false), color: '#dc2626', borderColor: '#fca5a5' }}>
              ⏹ End
            </button>
          )}
          {!practice.sessionActive && practice.messages.length > 0 && (
            <>
              <button onClick={handleSave} style={hdrBtn(false)} title="Save session transcript">💾 Save</button>
              <button onClick={practice.reset} style={hdrBtn(false)}>↺ Reset</button>
            </>
          )}
        </div>
      </div>

      {/* ── Character selector (only before session starts) ─────── */}
      {!practice.sessionActive && (
        <div style={s.setupBox}>
          <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
            Choose your audience
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {characters.map(c => (
              <button
                key={c.id}
                onClick={() => setCharacter(c)}
                style={{
                  background: character.id === c.id ? '#eff6ff' : '#fff',
                  border: `1.5px solid ${character.id === c.id ? '#3b82f6' : '#e2e8f0'}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  padding: '8px 10px',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                  <div>
                    <div style={{ color: '#0f172a', fontSize: 12, fontWeight: 700, lineHeight: 1.2 }}>{c.label}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 1 }}>{c.description}</div>
                  </div>
                  {character.id === c.id && (
                    <span style={{ marginLeft: 'auto', color: '#3b82f6', fontSize: 14 }}>✓</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Bench temperature selector — appellate panel and SCOTUS only */}
          {(character.id === 'appellate_panel' || character.id === 'supreme_court') && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Bench temperature
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['cold', 'warm', 'hot'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setBenchTemp(t)}
                    style={{
                      flex: 1,
                      background: benchTemp === t ? (t === 'cold' ? '#dbeafe' : t === 'warm' ? '#fef3c7' : '#fee2e2') : '#fff',
                      border: `1.5px solid ${benchTemp === t ? (t === 'cold' ? '#3b82f6' : t === 'warm' ? '#f59e0b' : '#ef4444') : '#e2e8f0'}`,
                      borderRadius: 6,
                      color: benchTemp === t ? (t === 'cold' ? '#1d4ed8' : t === 'warm' ? '#92400e' : '#991b1b') : '#64748b',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '5px 4px',
                      textTransform: 'capitalize'
                    }}
                  >
                    {t === 'cold' ? '🧊 Cold' : t === 'warm' ? '☀️ Warm' : '🔥 Hot'}
                  </button>
                ))}
              </div>
              <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 5 }}>
                {benchTemp === 'cold' ? 'Judges listen; one polite question per turn' : benchTemp === 'warm' ? 'Occasional focused questions, no interruptions' : 'Frequent interruptions, rapid hypotheticals, pile-ons'}
              </div>
            </div>
          )}

          {noApiKey && (
            <div style={{ color: '#dc2626', fontSize: 11, marginTop: 8, padding: '6px 8px', background: '#fef2f2', borderRadius: 5, border: '1px solid #fca5a5' }}>
              Add your API key in the AI Coach tab — click ⚙ Settings and paste your key. Press Enter or click Save.
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={noApiKey}
            style={{
              ...startBtn,
              opacity: noApiKey ? 0.4 : 1,
              cursor: noApiKey ? 'default' : 'pointer',
              marginTop: 10
            }}
          >
            {character.icon} Start Session
          </button>
        </div>
      )}

      {/* ── Active session ─────────────────────────────────────── */}
      {practice.sessionActive && (
        <>
          {/* Camera + controls row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              {cameraStream ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: '100%', maxHeight: 120, borderRadius: 7, background: '#000', display: 'block', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: 80, background: '#0f172a', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: '#475569', fontSize: 11 }}>Camera off</span>
                </div>
              )}
              {cameraError && <div style={{ color: '#dc2626', fontSize: 10, marginTop: 3 }}>{cameraError}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
              <button onClick={toggleCamera} style={camBtn(!!cameraStream)} title={cameraStream ? 'Turn camera off' : 'Turn camera on'}>
                {cameraStream ? '📷 On' : '📷 Off'}
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.3 }}>{character.icon}</div>
                <div style={{ color: '#334155', fontSize: 9, fontWeight: 700, marginTop: 1 }}>{character.label}</div>
              </div>
            </div>
          </div>

          {/* Conversation */}
          <div style={s.chatArea}>
            {practice.messages.map((m, i) => (
              <PracticeMessageBubble key={m.id} message={m} character={character} isFirst={i === 0} />
            ))}
            {practice.streamingText && (
              <PracticeMessageBubble
                message={{ id: 'streaming', speaker: 'character', text: practice.streamingText, timestamp: Date.now() }}
                character={character}
                isFirst={false}
                streaming
              />
            )}
            {practice.isResponding && !practice.streamingText && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                <ThinkingDots />
                <span style={{ color: '#64748b', fontSize: 10 }}>{character.label} is responding…</span>
              </div>
            )}
            {isCoachAnalyzing && !coachNote && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '4px 0' }}>
                <ThinkingDots />
                <span style={{ color: '#92400e', fontSize: 10 }}>🎓 Coach reviewing…</span>
              </div>
            )}
            {coachNote && (
              <div style={{
                background: '#fffbeb',
                border: '1.5px solid #fcd34d',
                borderRadius: 9,
                padding: '10px 12px',
                marginTop: 4
              }}>
                <div style={{ color: '#92400e', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 5 }}>
                  ⏸ Coach — pause and consider
                </div>
                <div style={{ color: '#78350f', fontSize: 12, lineHeight: 1.55, marginBottom: 8 }}>
                  {coachNote}
                </div>
                <button
                  onClick={() => setCoachNote(null)}
                  style={{
                    background: '#f59e0b',
                    border: 'none',
                    borderRadius: 6,
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 14px'
                  }}
                >
                  Got it — continue →
                </button>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Errors */}
          {(practice.error || speech.micError || coachError) && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 5, color: '#dc2626', fontSize: 11, padding: '5px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span>{practice.error || speech.micError || coachError}</span>
              {coachError && !practice.error && !speech.micError && (
                <button onClick={() => setCoachError(null)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0 }}>✕</button>
              )}
            </div>
          )}

          {/* Input area */}
          <div style={s.inputArea}>

            {/* Model loading indicator */}
            {speech.modelStatus === 'loading' && (
              <div style={{ fontSize: 11, color: '#64748b', textAlign: 'center', padding: '4px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <ThinkingDots />
                Downloading speech model (one-time, ~40 MB)…
              </div>
            )}

            {/* Primary: speech button */}
            {!practice.isResponding && !coachNote && (() => {
              const isRecording = speech.isListening && speech.liveTranscript === ''
              const isTranscribing = speech.isListening && speech.liveTranscript === 'Transcribing…'
              const bg = isTranscribing
                ? 'linear-gradient(135deg, #7c3aed, #6d28d9)'
                : isRecording
                  ? 'linear-gradient(135deg, #059669, #047857)'
                  : 'linear-gradient(135deg, #2563eb, #7c3aed)'
              const label = isTranscribing
                ? 'Transcribing…'
                : isRecording
                  ? 'Recording — tap to finish'
                  : 'Speak your argument'
              const icon = isTranscribing ? '⏳' : isRecording ? '⏹' : '🎤'
              return (
                <button
                  onClick={handleSpeakButton}
                  disabled={isTranscribing}
                  style={{
                    alignItems: 'center',
                    background: bg,
                    border: 'none',
                    borderRadius: 9,
                    boxShadow: isRecording ? '0 0 0 3px #34d39940' : 'none',
                    color: '#fff',
                    cursor: isTranscribing ? 'default' : 'pointer',
                    display: 'flex',
                    fontSize: 13,
                    fontWeight: 700,
                    gap: 7,
                    justifyContent: 'center',
                    padding: '11px 14px',
                    width: '100%',
                    marginBottom: 7,
                    opacity: isTranscribing ? 0.85 : 1,
                    transition: 'background 0.15s, box-shadow 0.15s'
                  }}
                >
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </button>
              )
            })()}

            {/* Live transcript / typed input */}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                practice.isResponding
                  ? 'Waiting for response…'
                  : speech.liveTranscript === 'Transcribing…'
                    ? 'Transcribing your speech…'
                    : speech.isListening
                      ? 'Recording…'
                      : 'Or type here and press Enter'
              }
              disabled={practice.isResponding || speech.isListening}
              rows={2}
              style={{
                ...s.textarea,
                opacity: (practice.isResponding || speech.isListening) ? 0.55 : 1,
                borderColor: speech.isListening ? '#34d399' : '#bae6fd',
                boxShadow: speech.isListening ? '0 0 0 2px #34d39940' : 'none'
              }}
            />

            {/* Bottom row: stop AI or manual send */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 5 }}>
              {practice.isResponding ? (
                <button onClick={practice.stopResponse} style={smBtn('#7f1d1d')}>■ Stop</button>
              ) : (
                !speech.isListening && (
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    style={{ ...smBtn('#3b82f6'), opacity: !input.trim() ? 0.3 : 1 }}
                  >
                    Send ↗
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Idle state (after session ended) ───────────────────── */}
      {!practice.sessionActive && practice.messages.length === 0 && (
        <div style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', padding: '16px 0', lineHeight: 1.6 }}>
          Practice your performance live in front of a simulated audience, panel, or opponent.
          <br />The AI responds in character — in real time.
        </div>
      )}

    </div>
  )
}

// ─── Speaker avatar colors — consistent per name within a session ─────────────

const AVATAR_PALETTE = [
  '#0284c7','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#4f46e5','#be185d'
]

const avatarColorCache = new Map<string, string>()
let avatarColorIndex = 0

function avatarColor(name: string): string {
  if (!avatarColorCache.has(name)) {
    avatarColorCache.set(name, AVATAR_PALETTE[avatarColorIndex % AVATAR_PALETTE.length])
    avatarColorIndex++
  }
  return avatarColorCache.get(name)!
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function PracticeMessageBubble({ message: m, character, isFirst, streaming }: {
  message: { id: string; speaker: string; text: string }
  character: PracticeCharacter
  isFirst: boolean
  streaming?: boolean
}) {
  const isStudent = m.speaker === 'student'

  // Parse panel speaker label from "Judge Chen: ..." or "Justice Kagan: ..." etc.
  let speakerLabel: string = isStudent ? 'You' : character.label
  let speakerIcon: string = isStudent ? '🧑‍💻' : character.icon
  let bodyText = m.text

  if (!isStudent) {
    // Match "Judge/Justice/Professor/Evaluator/Juror Name [optional (Nickname)]:"
    const prefixMatch = m.text.match(/^((?:Judge|Justice|Professor|Evaluator|Juror\s+\d+(?:\s+\([^)]+\))?|[\w]+)\s+[\w]+(?:\s+[\w]+)?)\s*:\s*/i)
    if (prefixMatch) {
      speakerLabel = prefixMatch[1]
      bodyText = m.text.slice(prefixMatch[0].length)
    }
  }

  const color = isStudent ? '#3b82f6' : avatarColor(speakerLabel)
  const initials = speakerLabel === 'You'
    ? '👤'
    : speakerLabel.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div style={{
      display: 'flex',
      flexDirection: isStudent ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: 7,
      marginBottom: 10
    }}>
      {/* Avatar */}
      <div style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isStudent ? 14 : 13,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        marginTop: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
      }}>
        {isStudent ? '👤' : (speakerLabel === character.label ? character.icon : initials)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isStudent ? 'flex-end' : 'flex-start', gap: 2, maxWidth: '85%' }}>
        <span style={{ color: color, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {speakerLabel}
        </span>
        <div style={{
          background: isStudent ? '#3b82f6' : '#fff',
          border: isStudent ? 'none' : `1px solid ${color}30`,
          borderRadius: isStudent ? '10px 10px 2px 10px' : '2px 10px 10px 10px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          color: isStudent ? '#fff' : '#1e293b',
          fontSize: 12,
          lineHeight: 1.55,
          padding: '7px 10px',
          whiteSpace: 'pre-wrap'
        }}>
          {renderText(bodyText)}
          {streaming && <span style={{ color: color, animation: 'blink 1s step-end infinite' }}>▌</span>}
        </div>
      </div>
    </div>
  )
}

// Minimal inline bold renderer
function renderText(text: string) {
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} style={{ height: 4 }} />
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    return (
      <div key={i}>
        {parts.map((p, j) =>
          /^\*\*.*\*\*$/.test(p)
            ? <strong key={j}>{p.replace(/\*\*/g, '')}</strong>
            : p
        )}
      </div>
    )
  })
}

// ─── Thinking dots ────────────────────────────────────────────────────────────

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: 5, height: 5, borderRadius: '50%', background: '#94a3b8',
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`
          }}
        />
      ))}
    </div>
  )
}

// ─── Style helpers ────────────────────────────────────────────────────────────

function hdrBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#dbeafe' : '#f1f5f9',
    border: `1px solid ${active ? '#93c5fd' : '#e2e8f0'}`,
    borderRadius: 5,
    color: active ? '#1d4ed8' : '#475569',
    cursor: 'pointer',
    fontSize: 12,
    padding: '3px 8px',
    lineHeight: 1
  }
}

function smBtn(bg: string): React.CSSProperties {
  const isDark = bg === '#1e293b'
  return {
    background: isDark ? '#f1f5f9' : bg,
    border: `1px solid ${isDark ? '#e2e8f0' : 'transparent'}`,
    borderRadius: 5,
    color: isDark ? '#334155' : '#fff',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    padding: '4px 10px',
    whiteSpace: 'nowrap'
  }
}

function camBtn(active: boolean): React.CSSProperties {
  return {
    background: active ? '#f0fdf4' : '#f8fafc',
    border: `1px solid ${active ? '#86efac' : '#e2e8f0'}`,
    borderRadius: 5,
    color: active ? '#166534' : '#64748b',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    padding: '4px 7px',
    whiteSpace: 'nowrap'
  }
}

const startBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  display: 'block',
  fontSize: 13,
  fontWeight: 700,
  padding: '11px 14px',
  textAlign: 'center',
  width: '100%'
}

const s: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: 8, height: '100%' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: '#64748b', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  setupBox: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 9, padding: 12, display: 'flex', flexDirection: 'column', gap: 0 },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 60, paddingRight: 2 },
  inputArea: { borderTop: '1px solid #e2e8f0', paddingTop: 8 },
  textarea: { background: '#fff', border: '1px solid #bae6fd', borderRadius: 6, color: '#0f172a', fontSize: 12, fontFamily: 'inherit', outline: 'none', padding: '7px 10px', resize: 'none', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s' }
}
