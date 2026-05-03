/**
 * useWhisperTranscription
 *
 * Drop-in replacement for useSpeechRecognition that runs Whisper locally
 * via @huggingface/transformers — no Google API keys, no network required after
 * the first model download (~40 MB, cached in IndexedDB).
 *
 * Interface is intentionally close to useSpeechRecognition so LivePracticePanel
 * needs no structural changes.
 */

import { useCallback, useRef, useState } from 'react'

type ModelStatus = 'idle' | 'loading' | 'ready'
type Phase = 'idle' | 'recording' | 'transcribing'

export type WhisperModelSize = 'tiny' | 'base'

// Per-model singleton pipelines — keyed by model size so switching sizes
// doesn't discard an already-loaded model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pipelinePromises: Partial<Record<WhisperModelSize, Promise<any>>> = {}

const MODEL_IDS: Record<WhisperModelSize, string> = {
  tiny: 'Xenova/whisper-tiny.en',
  base: 'Xenova/whisper-base.en',
}

async function getPipeline(size: WhisperModelSize = 'tiny') {
  if (!pipelinePromises[size]) {
    pipelinePromises[size] = (async () => {
      // Dynamic import keeps this out of the initial bundle
      const { pipeline, env } = await import('@huggingface/transformers')
      // Allow the model to be fetched from HuggingFace and cached locally
      env.allowLocalModels = false
      // Pin dtype to fp32 (string form, applies to ALL model components).
      // The default/auto path picks q4-quantized weights for whisper-tiny.en, which
      // fail ORT session creation: "Missing required scale: …weight_merged_0_scale
      // … TransposeDQWeightsForMatMulNBits". The per-component object form
      // (dtype: { encoder_model: ..., decoder_model_merged: ... }) silently falls
      // through to device defaults when filename keys don't match — string form
      // bypasses that and forces unquantized files (~150MB total, cached after
      // first run, fully offline thereafter).
      return pipeline('automatic-speech-recognition', MODEL_IDS[size], {
        dtype: 'fp32'
      })
    })()
  }
  return pipelinePromises[size]
}

export function useWhisperTranscription(modelSize: WhisperModelSize = 'tiny') {
  const [phase, setPhase] = useState<Phase>('idle')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef('')  // final result, readable via getTranscript()
  const recordingStartRef = useRef<number>(0)
  const [lastRecordingDurationMs, setLastRecordingDurationMs] = useState(0)

  // isListening = true during recording OR transcribing — matches the old hook's
  // semantics so LivePracticePanel's useEffect auto-send logic is unchanged.
  const isListening = phase !== 'idle'
  const isSupported = true  // always supported — we provide the engine

  /** Warm up the model in the background so first use is faster. */
  const preload = useCallback(async () => {
    if (modelStatus !== 'idle') return
    setModelStatus('loading')
    try {
      await getPipeline(modelSize)
      setModelStatus('ready')
    } catch (e) {
      setModelStatus('idle')
      console.warn('Whisper model preload failed:', e)
    }
  }, [modelStatus, modelSize])

  const start = useCallback(async (micDeviceId?: string) => {
    setMicError(null)
    transcriptRef.current = ''
    setLiveTranscript('')

    let stream: MediaStream
    try {
      const audioConstraint = micDeviceId
        ? { deviceId: { exact: micDeviceId } }
        : true
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint })
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Microphone access denied. Open System Settings → Privacy & Security → Microphone and enable this app, then restart it.')
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setMicError('No microphone found. Plug in a microphone and try again.')
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setMicError('Microphone is in use by another app (Zoom, FaceTime, etc.). Close it and try again.')
      } else {
        setMicError(`Microphone unavailable: ${err.message}`)
      }
      return
    }

    const liveTracks = stream.getAudioTracks().filter(t => t.readyState === 'live')
    if (liveTracks.length === 0) {
      stream.getTracks().forEach(t => t.stop())
      setMicError('Microphone opened but no audio tracks are active. Check System Settings → Sound → Input volume.')
      return
    }

    // Warm up model while user is speaking (hides latency)
    if (modelStatus === 'idle') {
      setModelStatus('loading')
      getPipeline(modelSize).then(() => setModelStatus('ready')).catch(() => setModelStatus('idle'))
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const recorder = new MediaRecorder(stream, { mimeType })
    chunksRef.current = []

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const durationMs = Date.now() - recordingStartRef.current
      setLastRecordingDurationMs(durationMs)
      stream.getTracks().forEach(t => t.stop())
      setPhase('transcribing')
      setLiveTranscript('Transcribing…')

      try {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const arrayBuffer = await blob.arrayBuffer()

        // Decode audio and resample to 16 kHz mono (what Whisper expects)
        const audioCtx = new AudioContext({ sampleRate: 16000 })
        const decoded = await audioCtx.decodeAudioData(arrayBuffer)
        audioCtx.close()
        const float32 = decoded.getChannelData(0)

        const whisper = await getPipeline(modelSize)
        setModelStatus('ready')

        const result = await whisper(float32, {
          sampling_rate: 16000,
          chunk_length_s: 30,
          stride_length_s: 5
          // No `language` / `task` — whisper-tiny.en is English-only and rejects those.
        })

        const text: string = Array.isArray(result)
          ? result.map((r: { text: string }) => r.text).join(' ').trim()
          : (result as { text: string }).text.trim()

        transcriptRef.current = text
        setLiveTranscript(text)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        setMicError(`Transcription failed: ${msg}`)
        transcriptRef.current = ''
        setLiveTranscript('')
      } finally {
        setPhase('idle')
      }
    }

    mediaRecorderRef.current = recorder
    recordingStartRef.current = Date.now()
    recorder.start()
    setPhase('recording')
    setLiveTranscript('')
  }, [modelStatus, modelSize])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      // phase transitions to 'transcribing' inside onstop
    }
  }, [])

  const abort = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
    transcriptRef.current = ''
    setPhase('idle')
    setLiveTranscript('')
    setMicError(null)
  }, [])

  const getTranscript = useCallback(() => transcriptRef.current.trim(), [])

  return {
    isListening,
    isSupported,
    liveTranscript,
    micError,
    modelStatus,
    lastRecordingDurationMs,
    start,
    stop,
    abort,
    getTranscript,
    preload
  }
}
