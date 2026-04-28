import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Domain } from '../hooks/useDomain'
import { DOMAIN_CONFIG } from '../hooks/useDomain'
import { PRACTICE_CHARACTERS, type PracticeCharacter } from '../config/practiceCharacters'
import { useLivePractice, type PracticeMessage } from '../hooks/useLivePractice'
import { useWhisperTranscription } from '../hooks/useWhisperTranscription'
import { useAIKnowledgeBase } from '../hooks/useAIKnowledgeBase'
import { streamCompletion, type AIProvider } from '../utils/aiClient'
import { speak as speakTTS, cancelSpeech } from '../utils/elevenLabsTTS'
import { voiceForCharacter, FREE_VOICES, DEFAULT_VOICE_ID } from '../config/elevenLabsVoices'
import {
  KOKORO_VOICES, DEFAULT_KOKORO_VOICE,
  onKokoroProgress, preloadKokoro, type KokoroProgress
} from '../utils/kokoroTTS'
import { countFillers, calcWpm, mergeFillerStats, type FillerStats } from '../utils/speechStats'

interface Props {
  apiKey: string
  provider: AIProvider
  domain: Domain
  selectedCameraId?: string
  /** ElevenLabs API key for voice synthesis. When empty, falls back to browser TTS. */
  elevenLabsKey?: string
  onSessionData?: (messages: Array<{ speaker: string; text: string; timestamp: number }>) => void
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LivePracticePanel({ apiKey, provider, domain, selectedCameraId, elevenLabsKey, onSessionData }: Props) {
  const characters = PRACTICE_CHARACTERS[domain]
  const [character, setCharacter] = useState<PracticeCharacter>(characters[0])
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [input, setInput] = useState('')

  // Camera
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  // User-resizable camera preview height. Persisted across sessions.
  const cameraBoxRef = useRef<HTMLDivElement>(null)
  const [cameraHeight, setCameraHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('mm_practice_camera_height'))
    return Number.isFinite(saved) && saved >= 80 ? saved : 120
  })

  // Conversation
  const practice = useLivePractice(apiKey, provider)
  const speech = useWhisperTranscription()
  const kb = useAIKnowledgeBase(domain)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ElevenLabs voice overrides — persisted per character ID
  const [voiceOverrides, setVoiceOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('mm_voice_overrides') ?? '{}') } catch { return {} }
  })

  function setVoiceForCharacter(characterId: string, voiceId: string) {
    const next = { ...voiceOverrides, [characterId]: voiceId }
    setVoiceOverrides(next)
    localStorage.setItem('mm_voice_overrides', JSON.stringify(next))
  }

  // Kokoro voice overrides — persisted per character ID
  const [kokoroVoiceOverrides, setKokoroVoiceOverrides] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('mm_kokoro_voice_overrides') ?? '{}') } catch { return {} }
  })

  function setKokoroVoiceForCharacter(characterId: string, voiceId: string) {
    const next = { ...kokoroVoiceOverrides, [characterId]: voiceId }
    setKokoroVoiceOverrides(next)
    localStorage.setItem('mm_kokoro_voice_overrides', JSON.stringify(next))
  }

  // Kokoro loading progress
  const [kokoroProgress, setKokoroProgress] = useState<KokoroProgress>({ pct: 0, status: 'idle' })

  // Input mode: 'voice' shows the mic button; 'text' hides it for instrumentalists
  const [inputMode, setInputMode] = useState<'voice' | 'text'>(() =>
    (localStorage.getItem('mm_input_mode') as 'voice' | 'text' | null) ?? 'voice'
  )

  function toggleInputMode() {
    const next = inputMode === 'voice' ? 'text' : 'voice'
    setInputMode(next)
    localStorage.setItem('mm_input_mode', next)
  }

  // Bench temperature (appellate / SCOTUS only)
  const [benchTemp, setBenchTemp] = useState<'cold' | 'warm' | 'hot'>('hot')

  // Coach
  const [coachEnabled, setCoachEnabled] = useState(false)
  const [coachNote, setCoachNote] = useState<string | null>(null)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [isCoachAnalyzing, setIsCoachAnalyzing] = useState(false)
  const coachAbortRef = useRef<AbortController | null>(null)

  // Speech stats — accumulated across all student turns in the session
  const [sessionStats, setSessionStats] = useState<{
    turnCount: number
    totalWords: number
    totalDurationMs: number
    fillers: FillerStats
  }>({ turnCount: 0, totalWords: 0, totalDurationMs: 0, fillers: { total: 0, breakdown: {} } })

  // Refs for always-fresh values inside effects/callbacks — avoids stale closure bugs
  const characterRef = useRef(character)
  const kbRef = useRef(kb)
  const practiceRef = useRef(practice)
  const benchTempRef = useRef(benchTemp)
  useEffect(() => { characterRef.current = character }, [character])
  useEffect(() => { kbRef.current = kb }, [kb])
  useEffect(() => { practiceRef.current = practice })
  useEffect(() => { benchTempRef.current = benchTemp }, [benchTemp])

  // Warm up the Whisper model when the Practice tab opens so the first
  // tap-to-speak doesn't pay the ~40MB download + load latency.
  useEffect(() => { speech.preload() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [practice.messages, practice.streamingText])

  // Persist user-chosen camera box height. ResizeObserver fires on every
  // resize-handle drag — debounce-via-rAF and write the final height to
  // localStorage so the choice survives across sessions.
  useEffect(() => {
    const el = cameraBoxRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const h = Math.round(entries[0]?.contentRect.height ?? 0)
      if (h >= 80) {
        setCameraHeight(h)
        localStorage.setItem('mm_practice_camera_height', String(h))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [practice.sessionActive])

  // Eagerly sync session messages to the parent so export captures everything,
  // even if the user exports without clicking End or hits End mid-stream.
  // Includes any in-flight streamingText as a synthetic last message so a
  // snapshot taken during streaming still has the latest content.
  useEffect(() => {
    if (practice.messages.length === 0) return
    const exportable = practice.streamingText
      ? [...practice.messages, {
          speaker: 'character',
          text: practice.streamingText,
          timestamp: Date.now()
        }]
      : practice.messages
    onSessionData?.(exportable)
  }, [practice.messages, practice.streamingText]) // eslint-disable-line react-hooks/exhaustive-deps

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
        const wpm = calcWpm(text, speech.lastRecordingDurationMs)
        const fillers = countFillers(text)
        setSessionStats(prev => ({
          turnCount: prev.turnCount + 1,
          totalWords: prev.totalWords + text.trim().split(/\s+/).filter(Boolean).length,
          totalDurationMs: prev.totalDurationMs + speech.lastRecordingDurationMs,
          fillers: mergeFillerStats(prev.fillers, fillers)
        }))
        setInput('')
        const eff = applyBenchTemp(characterRef.current, benchTempRef.current)
        practiceRef.current.sendTurn(text, eff, kbRef.current.toPromptBlock(characterRef.current.id), {
          wpm,
          fillerCount: fillers.total,
          fillerBreakdown: fillers.breakdown
        })
      }
    }
  }, [speech.isListening]) // eslint-disable-line react-hooks/exhaustive-deps

  // When domain changes, update character and reload domain-scoped knowledge base
  useEffect(() => {
    setCharacter(PRACTICE_CHARACTERS[domain][0])
    kb.loadDomain(domain)
  }, [domain]) // eslint-disable-line react-hooks/exhaustive-deps

  // TTS: speak each completed character response. Uses ElevenLabs when a key
  // is configured, otherwise falls back to browser SpeechSynthesis. Voice is
  // selected per-character so different judges sound distinct.
  const prevMsgCount = useRef(0)
  const [ttsFallbackReason, setTtsFallbackReason] = useState<string | null>(null)
  useEffect(() => {
    if (!ttsEnabled) return
    if (practice.messages.length > prevMsgCount.current) {
      const latest = practice.messages[practice.messages.length - 1]
      if (latest.speaker === 'character') {
        // For multi-speaker characters, extract the "Speaker Name: " prefix so each
        // named individual uses their own assigned voice, and TTS skips the prefix.
        let speakerId = character.id
        let textToSpeak = latest.text
        if (character.speakers && character.speakers.length > 0) {
          const prefixMatch = latest.text.match(/^([^:\n]+):\s*/)
          if (prefixMatch) {
            const prefixLabel = prefixMatch[1].trim()
            const matched = character.speakers.find(
              sp => sp.label.toLowerCase() === prefixLabel.toLowerCase()
            )
            if (matched) {
              speakerId = matched.id
              textToSpeak = latest.text.slice(prefixMatch[0].length)
            }
          }
        }
        speakTTS({
          text: textToSpeak,
          voiceId: voiceForCharacter(speakerId, voiceOverrides),
          apiKey: elevenLabsKey ?? '',
          kokoroVoice: kokoroVoiceOverrides[speakerId] ?? DEFAULT_KOKORO_VOICE
        }).then(result => {
          // If we silently fell back to browser TTS, surface the reason once.
          if (result.fallbackReason) setTtsFallbackReason(result.fallbackReason)
          else if (result.engine === 'elevenlabs') setTtsFallbackReason(null)
        }).catch(() => { /* cancellation, ignore */ })
      }
    }
    prevMsgCount.current = practice.messages.length
  }, [practice.messages, ttsEnabled, elevenLabsKey, character.id, character.speakers, voiceOverrides, kokoroVoiceOverrides])

  // Subscribe to Kokoro progress and preload when TTS is on without an ElevenLabs key
  useEffect(() => {
    const unsub = onKokoroProgress(setKokoroProgress)
    return unsub
  }, [])

  useEffect(() => {
    if (ttsEnabled && !elevenLabsKey) preloadKokoro()
  }, [ttsEnabled, elevenLabsKey])

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

  // Open the camera with the currently-selected deviceId. exact (not ideal):
  // otherwise macOS silently swaps in the built-in FaceTime camera even when
  // the user picked an external webcam.
  async function openCamera() {
    console.log('[live-cam] requested deviceId:', selectedCameraId || '(default)')
    let stream: MediaStream | null = null
    let firstErr: unknown = null
    try {
      const vc = selectedCameraId ? { deviceId: { exact: selectedCameraId } } : true
      stream = await navigator.mediaDevices.getUserMedia({ video: vc, audio: false })
    } catch (e) {
      firstErr = e
      console.warn('[live-cam] exact deviceId failed, trying default:', e)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (e2) {
        const errName = e2 instanceof Error ? e2.name : 'UnknownError'
        const perms = await window.api.getMediaPermissions().catch(() => ({ camera: 'unknown', microphone: 'unknown' }))
        const detail = errName === 'NotAllowedError'
          ? 'macOS blocked camera access. Use the Reset Permissions button on the home screen.'
          : errName === 'NotReadableError'
            ? 'Camera is in use by another app or another part of this app.'
            : `${errName}: ${e2 instanceof Error ? e2.message : String(e2)}`
        console.error('[live-cam] both attempts failed:', firstErr, e2)
        setCameraError(`${detail}  |  Camera TCC: ${perms.camera}`)
        return
      }
    }
    if (stream) {
      const t = stream.getVideoTracks()[0]
      console.log('[live-cam] opened track:', { label: t?.label, deviceId: t?.getSettings().deviceId })
      setCameraError(null)
      setCameraStream(stream)
    }
  }

  async function toggleCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop())
      setCameraStream(null)
    } else {
      await openCamera()
    }
  }

  // Auto-restart with the new camera when the user picks a different device
  // mid-session — only when the camera is already on, so we never spin it up
  // unbidden.
  useEffect(() => {
    if (!cameraStream || !selectedCameraId) return
    const active = cameraStream.getVideoTracks()[0]?.getSettings().deviceId
    if (active === selectedCameraId) return
    cameraStream.getTracks().forEach(t => t.stop())
    openCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId])

  // Stop camera on unmount or session end
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach(t => t.stop())
      cancelSpeech()
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

  // Injects bench temperature instructions for appellate/SCOTUS characters.
  // Pure — takes ch and temp explicitly so it works from both event handlers
  // (use state values) and stale-closure-prone effects (use ref values).
  function applyBenchTemp(ch: PracticeCharacter, temp: 'cold' | 'warm' | 'hot'): PracticeCharacter {
    if (ch.id !== 'appellate_panel' && ch.id !== 'supreme_court') return ch
    const instruction = temp === 'cold'
      ? '\n\nBench temperature: COLD. Let counsel develop their full argument before asking questions. One brief, polite question per turn. Do not interrupt mid-sentence.'
      : temp === 'warm'
      ? '\n\nBench temperature: WARM. Ask focused questions but let counsel finish their point first. One or two questions per turn.'
      : '\n\nBench temperature: HOT. Interrupt often. Ask rapid hypotheticals. Multiple judges pile on. Press hard on every weak point.'
    return { ...ch, systemPrompt: ch.systemPrompt + instruction }
  }

  function effectiveCharacter(): PracticeCharacter {
    return applyBenchTemp(character, benchTemp)
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

  function handleStart() {
    practice.startSession(effectiveCharacter())
  }

  function handleEnd() {
    if (practice.messages.length > 0) onSessionData?.(practice.messages)
    practice.endSession()
    speech.abort()
    cancelSpeech()
    cameraStream?.getTracks().forEach(t => t.stop())
    setCameraStream(null)
    coachAbortRef.current?.abort()
    setCoachNote(null)
    setIsCoachAnalyzing(false)
    // Stats persist after session ends so the user can review them
  }

  function handleReset() {
    practice.reset()
    setSessionStats({ turnCount: 0, totalWords: 0, totalDurationMs: 0, fillers: { total: 0, breakdown: {} } })
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
    const fillers = countFillers(text)
    const eff = applyBenchTemp(character, benchTemp)
    practiceRef.current.sendTurn(text, eff, kbRef.current.toPromptBlock(character.id), {
      wpm: 0,
      fillerCount: fillers.total,
      fillerBreakdown: fillers.breakdown
    })
  }, [input, speech, character, benchTemp]) // eslint-disable-line react-hooks/exhaustive-deps

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
          <button
            onClick={toggleInputMode}
            title={inputMode === 'text' ? 'Text-only mode (for instrumentalists) — click for voice' : 'Voice input mode — click for text-only'}
            style={hdrBtn(inputMode === 'text')}
          >
            {inputMode === 'text' ? '⌨️' : '🎤'}
          </button>
          {practice.sessionActive && (
            <button onClick={handleEnd} style={{ ...hdrBtn(false), color: '#dc2626', borderColor: '#fca5a5' }}>
              ⏹ End
            </button>
          )}
          {!practice.sessionActive && practice.messages.length > 0 && (
            <>
              <button onClick={handleSave} style={hdrBtn(false)} title="Save session transcript">💾 Save</button>
              <button onClick={handleReset} style={hdrBtn(false)}>↺ Reset</button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {characters.map(c => {
              const active = character.id === c.id
              return (
                <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <button
                    onClick={() => setCharacter(c)}
                    style={{
                      background: active ? '#eff6ff' : '#fff',
                      border: `1.5px solid ${active ? '#3b82f6' : '#e2e8f0'}`,
                      borderRadius: '10px 10px 0 0',
                      cursor: 'pointer',
                      padding: '14px 12px 12px',
                      textAlign: 'center',
                      position: 'relative',
                      width: '100%'
                    }}
                  >
                    {active && (
                      <span style={{
                        position: 'absolute', top: 6, right: 8,
                        color: '#3b82f6', fontSize: 16, lineHeight: 1
                      }}>✓</span>
                    )}
                    <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 8 }}>{c.icon}</div>
                    <div style={{ color: '#0f172a', fontSize: 13, fontWeight: 700, lineHeight: 1.2 }}>{c.label}</div>
                    <div style={{ color: '#64748b', fontSize: 10, marginTop: 3, lineHeight: 1.35 }}>{c.description}</div>
                  </button>
                  {/* Voice selector — one row per speaker (or one row for single-voice characters) */}
                  <div style={{
                    background: active ? '#e0effe' : '#f8fafc',
                    border: `1.5px solid ${active ? '#3b82f6' : '#e2e8f0'}`,
                    borderTop: 'none',
                    borderRadius: '0 0 10px 10px',
                    overflow: 'hidden'
                  }}>
                    {(c.speakers ?? [{ id: c.id, label: c.label }]).map((sp, spIdx) => (
                      <div key={sp.id} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 8px',
                        borderTop: spIdx > 0 ? '1px solid #e2e8f0' : 'none'
                      }}>
                        <span style={{ color: '#475569', fontSize: 10, minWidth: 0, flex: '0 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          🔊 {c.speakers ? sp.label : '🔊'}
                        </span>
                        <select
                          value={elevenLabsKey
                            ? (voiceOverrides[sp.id] ?? DEFAULT_VOICE_ID)
                            : (kokoroVoiceOverrides[sp.id] ?? DEFAULT_KOKORO_VOICE)}
                          onChange={e => elevenLabsKey
                            ? setVoiceForCharacter(sp.id, e.target.value)
                            : setKokoroVoiceForCharacter(sp.id, e.target.value)}
                          style={{ flex: 1, fontSize: 10, padding: '2px 3px', borderRadius: 4, border: '1px solid #cbd5e1', background: '#fff', color: '#0f172a', cursor: 'pointer', minWidth: 0 }}
                        >
                          {elevenLabsKey
                            ? FREE_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                            : KOKORO_VOICES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)
                          }
                        </select>
                      </div>
                    ))}
                    <div style={{ padding: '2px 8px 4px', color: '#94a3b8', fontSize: 9 }}>
                      {elevenLabsKey ? 'ElevenLabs · saved per speaker' : 'Kokoro · saved per speaker'}
                    </div>
                  </div>
                </div>
              )
            })}
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

          {/* Kokoro model download progress — shown globally when loading */}
          {!elevenLabsKey && kokoroProgress.status === 'loading' && (
            <div style={{ padding: '6px 10px', background: '#f8fafc', borderRadius: 7, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: 10, marginBottom: 2 }}>
                <span>Downloading Kokoro voice model…</span>
                <span>{kokoroProgress.pct}%</span>
              </div>
              <div style={{ background: '#e2e8f0', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                <div style={{ background: '#3b82f6', height: '100%', width: `${kokoroProgress.pct}%`, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
          {!elevenLabsKey && kokoroProgress.status === 'error' && (
            <div style={{ color: '#dc2626', fontSize: 10, padding: '4px 8px', background: '#fef2f2', borderRadius: 5, border: '1px solid #fca5a5' }}>
              Voice model failed to load — browser voice will be used instead.
            </div>
          )}
          {!elevenLabsKey && kokoroProgress.status !== 'loading' && kokoroProgress.status !== 'error' && (
            <div style={{ color: '#94a3b8', fontSize: 10, textAlign: 'center' }}>
              {kokoroProgress.status === 'ready' ? '🟢 Kokoro voice model ready' : 'Kokoro voices · ~82 MB download on first use'}
            </div>
          )}

          {noApiKey && (
            <div style={{ color: '#dc2626', fontSize: 11, marginTop: 8, padding: '6px 8px', background: '#fef2f2', borderRadius: 5, border: '1px solid #fca5a5' }}>
              Add your API key in ⚙ Settings &amp; AI Keys (bottom of sidebar) — paste your key and it saves automatically.
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
              <div
                ref={cameraBoxRef}
                title="Drag bottom-right corner to resize"
                style={{
                  width: '100%',
                  height: cameraHeight,
                  minHeight: 80,
                  maxHeight: 600,
                  borderRadius: 7,
                  background: '#0f172a',
                  overflow: 'hidden',
                  resize: 'vertical',
                  position: 'relative'
                }}
              >
                {cameraStream ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{ width: '100%', height: '100%', background: '#000', display: 'block', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#475569', fontSize: 11 }}>Camera off</span>
                  </div>
                )}
              </div>
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
                message={{ id: 'streaming', speaker: 'character', text: practice.streamingText }}
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

          {/* ElevenLabs TTS fallback notice — informational, not an error */}
          {ttsFallbackReason && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 5, color: '#92400e', fontSize: 10, padding: '4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ flex: 1, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>Using browser voice — ElevenLabs failed: {ttsFallbackReason}</span>
              <button onClick={() => setTtsFallbackReason(null)} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, flexShrink: 0 }}>✕</button>
            </div>
          )}

          {/* Input area */}
          <div style={s.inputArea}>

            {/* Primary: speech button (voice mode only) */}
            {inputMode === 'voice' && !practice.isResponding && !coachNote && (() => {
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
                      : inputMode === 'text'
                        ? 'Type your response and press Enter'
                        : 'Or type here and press Enter'
              }
              disabled={practice.isResponding || speech.isListening}
              rows={inputMode === 'text' ? 3 : 2}
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

      {/* ── Speech stats bar — shown during and after session ──── */}
      {sessionStats.turnCount > 0 && (() => {
        const avgWpm = sessionStats.totalDurationMs > 0
          ? Math.round(sessionStats.totalWords / (sessionStats.totalDurationMs / 60000))
          : 0
        const top3 = Object.entries(sessionStats.fillers.breakdown)
          .sort((a, b) => b[1] - a[1]).slice(0, 3)
        return (
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 9px', fontSize: 10, color: '#475569', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#0284c7' }}>📊</span>
            {avgWpm > 0 && (
              <span><span style={{ fontWeight: 700 }}>{avgWpm}</span> WPM avg</span>
            )}
            {sessionStats.fillers.total > 0 && (
              <span>
                <span style={{ fontWeight: 700, color: '#dc2626' }}>{sessionStats.fillers.total}</span> filler{sessionStats.fillers.total !== 1 ? 's' : ''}
                {top3.length > 0 && (
                  <span style={{ color: '#94a3b8' }}>
                    {' '}({top3.map(([k, v]) => `"${k}" ×${v}`).join(', ')})
                  </span>
                )}
              </span>
            )}
            {sessionStats.fillers.total === 0 && avgWpm > 0 && (
              <span style={{ color: '#34d399', fontWeight: 600 }}>No fillers detected</span>
            )}
            <span style={{ color: '#cbd5e1' }}>{sessionStats.turnCount} turn{sessionStats.turnCount !== 1 ? 's' : ''}</span>
          </div>
        )
      })()}

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
  message: PracticeMessage | { id: string; speaker: string; text: string }
  character: PracticeCharacter
  isFirst: boolean
  streaming?: boolean
}) {
  const isStudent = m.speaker === 'student'
  const msgWpm = 'wpm' in m ? m.wpm : undefined
  const msgFillerCount = 'fillerCount' in m ? m.fillerCount : undefined
  const msgFillerBreakdown = 'fillerBreakdown' in m ? m.fillerBreakdown : undefined

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
        {isStudent && (msgWpm !== undefined || msgFillerCount !== undefined) && (
          <div style={{ display: 'flex', gap: 6, fontSize: 9, color: '#94a3b8', marginTop: 1, flexWrap: 'wrap' }}>
            {msgWpm !== undefined && msgWpm > 0 && (
              <span style={{ color: '#0284c7', fontWeight: 600 }}>⚡ {msgWpm} wpm</span>
            )}
            {msgFillerCount !== undefined && msgFillerCount > 0 && (
              <span style={{ color: '#f87171', fontWeight: 600 }}>
                {msgFillerCount} filler{msgFillerCount !== 1 ? 's' : ''}
                {msgFillerBreakdown && Object.keys(msgFillerBreakdown).length > 0 && (
                  <span style={{ color: '#94a3b8', fontWeight: 400 }}>
                    {' '}({Object.entries(msgFillerBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `"${k}" ×${v}`).join(', ')})
                  </span>
                )}
              </span>
            )}
            {msgFillerCount === 0 && msgWpm !== undefined && msgWpm > 0 && (
              <span style={{ color: '#34d399', fontWeight: 600 }}>✓ no fillers</span>
            )}
          </div>
        )}
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
