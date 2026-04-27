/**
 * elevenLabsTTS
 *
 * Speak text via ElevenLabs API, fall back to browser SpeechSynthesis on any
 * failure (missing key, network error, quota exceeded, etc.). Uses the
 * multilingual v2 model — broadly compatible across free and paid accounts.
 * Higher-tier paid plans can switch to eleven_flash_v2_5 for ~500ms first byte.
 *
 * Maintains module-level singletons so a new utterance cancels the previous
 * one — same semantics as window.speechSynthesis.cancel() + speak().
 */

let currentAudio: HTMLAudioElement | null = null
let currentAbort: AbortController | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null

export interface SpeakOptions {
  text: string
  voiceId: string
  apiKey: string
  /** ElevenLabs voice stability (0-1). Higher = more consistent, less expressive. */
  stability?: number
  /** ElevenLabs similarity boost (0-1). Higher = closer to source voice. */
  similarityBoost?: number
}

export interface SpeakResult {
  /** Which engine actually produced the audio. */
  engine: 'elevenlabs' | 'browser'
  /** Filled when engine === 'browser' and ElevenLabs failed (so callers can surface a toast). */
  fallbackReason?: string
}

export function cancelSpeech(): void {
  if (currentAbort) {
    try { currentAbort.abort() } catch { /* ok */ }
    currentAbort = null
  }
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.src = '' } catch { /* ok */ }
    currentAudio = null
  }
  if (currentUtterance && typeof window !== 'undefined' && window.speechSynthesis) {
    try { window.speechSynthesis.cancel() } catch { /* ok */ }
    currentUtterance = null
  }
}

async function speakBrowser(text: string): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  u.pitch = 1.0
  currentUtterance = u
  return new Promise<void>(resolve => {
    u.onend = () => { if (currentUtterance === u) currentUtterance = null; resolve() }
    u.onerror = () => { if (currentUtterance === u) currentUtterance = null; resolve() }
    window.speechSynthesis.speak(u)
  })
}

async function speakElevenLabs(opts: SpeakOptions): Promise<void> {
  const { text, voiceId, apiKey, stability = 0.5, similarityBoost = 0.75 } = opts

  const controller = new AbortController()
  currentAbort = controller

  // Plain endpoint + default model = compatible with free-tier accounts.
  // optimize_streaming_latency and the flash/turbo v2.5 models are paid-only on
  // many plans and return HTTP 402.
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability, similarity_boost: similarityBoost }
    }),
    signal: controller.signal
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    // Log full payload to console for debugging — toast may be truncated.
    console.error('[ElevenLabs] HTTP', response.status, 'body:', err, 'voiceId:', voiceId, 'model:', 'eleven_multilingual_v2')
    throw new Error(`ElevenLabs ${response.status}: ${err.slice(0, 400) || response.statusText}`)
  }

  const blob = await response.blob()
  const audioUrl = URL.createObjectURL(blob)
  const audio = new Audio(audioUrl)
  currentAudio = audio

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      URL.revokeObjectURL(audioUrl)
      if (currentAudio === audio) currentAudio = null
      if (currentAbort === controller) currentAbort = null
    }
    audio.addEventListener('ended', () => { cleanup(); resolve() })
    audio.addEventListener('error', () => { cleanup(); reject(new Error('Audio playback failed')) })
    controller.signal.addEventListener('abort', () => { cleanup(); resolve() })
    audio.play().catch(err => { cleanup(); reject(err) })
  })
}

/**
 * Speak text. Cancels any previous utterance first.
 * Returns which engine was used so the caller can surface fallback errors.
 */
export async function speak(opts: SpeakOptions): Promise<SpeakResult> {
  cancelSpeech()
  const { text, voiceId, apiKey } = opts
  if (!text.trim()) return { engine: 'browser' }

  // No key → straight to browser TTS.
  if (!apiKey || !voiceId) {
    await speakBrowser(text)
    return { engine: 'browser' }
  }

  try {
    await speakElevenLabs(opts)
    return { engine: 'elevenlabs' }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Caller cancelled — don't fall back to browser TTS, just return.
      return { engine: 'elevenlabs' }
    }
    const reason = err instanceof Error ? err.message : String(err)
    await speakBrowser(text)
    return { engine: 'browser', fallbackReason: reason }
  }
}
