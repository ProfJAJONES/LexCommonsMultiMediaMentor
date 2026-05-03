/**
 * elevenLabsTTS
 *
 * Speak text via ElevenLabs API when a key is set.
 * When no key is configured, falls back to local Kokoro TTS (first use
 * triggers a ~82 MB one-time model download).
 * Final fallback is browser SpeechSynthesis if Kokoro fails.
 */

import { speakKokoro, cancelKokoro } from './kokoroTTS'

let currentAudio: HTMLAudioElement | null = null
let currentAbort: AbortController | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null

export interface SpeakOptions {
  text: string
  voiceId: string
  apiKey: string
  /** Kokoro voice ID (used when apiKey is empty). */
  kokoroVoice?: string
  /** ElevenLabs voice stability (0-1). */
  stability?: number
  /** ElevenLabs similarity boost (0-1). */
  similarityBoost?: number
}

export interface SpeakResult {
  engine: 'elevenlabs' | 'kokoro' | 'browser'
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
  cancelKokoro()
}

async function speakBrowser(text: string): Promise<void> {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = 1.05
  u.pitch = 1.0
  currentUtterance = u
  return new Promise<void>(resolve => {
    u.onend  = () => { if (currentUtterance === u) currentUtterance = null; resolve() }
    u.onerror = () => { if (currentUtterance === u) currentUtterance = null; resolve() }
    window.speechSynthesis.speak(u)
  })
}

async function speakElevenLabs(opts: SpeakOptions): Promise<void> {
  const { text, voiceId, apiKey, stability = 0.5, similarityBoost = 0.75 } = opts
  const controller = new AbortController()
  currentAbort = controller

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability, similarity_boost: similarityBoost }
    }),
    signal: controller.signal
  })

  if (!response.ok) {
    const err = await response.text().catch(() => '')
    console.error('[ElevenLabs] HTTP', response.status, err, 'voiceId:', voiceId)
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

// Rachel — original ElevenLabs pre-made voice, available on all plan tiers
const FREE_FALLBACK_VOICE = '21m00Tcm4TlvDq8ikWAM'

function isLibraryVoiceError(reason: string): boolean {
  return reason.includes('paid_plan_required') || reason.includes('library voices')
}

export async function speak(opts: SpeakOptions): Promise<SpeakResult> {
  cancelSpeech()
  const { text, voiceId, apiKey, kokoroVoice } = opts
  if (!text.trim()) return { engine: 'browser' }

  // ── ElevenLabs path ───────────────────────────────────────────────────────
  if (apiKey && voiceId) {
    try {
      await speakElevenLabs(opts)
      return { engine: 'elevenlabs' }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return { engine: 'elevenlabs' }
      const reason = err instanceof Error ? err.message : String(err)

      // Library-voice 402: the configured voice requires an ElevenLabs paid plan.
      // Auto-retry with Rachel (a free pre-made voice) so the user still gets
      // ElevenLabs audio quality rather than silently dropping to browser TTS.
      if (isLibraryVoiceError(reason) && voiceId !== FREE_FALLBACK_VOICE) {
        try {
          await speakElevenLabs({ ...opts, voiceId: FREE_FALLBACK_VOICE })
          return { engine: 'elevenlabs', fallbackReason: `library-voice:${voiceId}` }
        } catch { /* fall through */ }
      }

      // Fall through to Kokoro
      try {
        await speakKokoro(text, kokoroVoice)
        return { engine: 'kokoro', fallbackReason: reason }
      } catch {
        await speakBrowser(text)
        return { engine: 'browser', fallbackReason: reason }
      }
    }
  }

  // ── Kokoro path (no ElevenLabs key) ───────────────────────────────────────
  try {
    await speakKokoro(text, kokoroVoice)
    return { engine: 'kokoro' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    await speakBrowser(text)
    return { engine: 'browser', fallbackReason: reason }
  }
}
