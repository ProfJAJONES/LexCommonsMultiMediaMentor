/**
 * useWhisperTranscription
 *
 * Drop-in replacement for useSpeechRecognition that runs Whisper locally
 * via @xenova/transformers — no Google API keys, no network required after
 * the first model download (~40 MB, cached in IndexedDB).
 *
 * Interface is intentionally close to useSpeechRecognition so LivePracticePanel
 * needs no structural changes.
 */

import { useCallback, useRef, useState } from 'react'

type ModelStatus = 'idle' | 'loading' | 'ready'
type Phase = 'idle' | 'recording' | 'transcribing'

// Singleton pipeline — load once, reuse across renders / hook instances
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipelinePromise: Promise<any> | null = null

async function getPipeline() {
  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Dynamic import keeps this out of the initial bundle
      const { pipeline, env } = await import('@xenova/transformers')
      // Allow the model to be fetched from HuggingFace and cached locally
      env.allowLocalModels = false
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en')
    })()
  }
  return pipelinePromise
}

export function useWhisperTranscription() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [modelStatus, setModelStatus] = useState<ModelStatus>('idle')
  const [liveTranscript, setLiveTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const transcriptRef = useRef('')  // final result, readable via getTranscript()

  // isListening = true during recording OR transcribing — matches the old hook's
  // semantics so LivePracticePanel's useEffect auto-send logic is unchanged.
  const isListening = phase !== 'idle'
  const isSupported = true  // always supported — we provide the engine

  /** Warm up the model in the background so first use is faster. */
  const preload = useCallback(async () => {
    if (modelStatus !== 'idle') return
    setModelStatus('loading')
    try {
      await getPipeline()
      setModelStatus('ready')
    } catch (e) {
      setModelStatus('idle')
      console.warn('Whisper model preload failed:', e)
    }
  }, [modelStatus])

  const start = useCallback(async () => {
    setMicError(null)
    transcriptRef.current = ''
    setLiveTranscript('')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
      getPipeline().then(() => setModelStatus('ready')).catch(() => setModelStatus('idle'))
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

        const whisper = await getPipeline()
        setModelStatus('ready')

        const result = await whisper(float32, {
          sampling_rate: 16000,
          chunk_length_s: 30,
          stride_length_s: 5,
          language: 'english',
          task: 'transcribe'
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
    recorder.start()
    setPhase('recording')
    setLiveTranscript('')
  }, [modelStatus])

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
    start,
    stop,
    abort,
    getTranscript,
    preload
  }
}
